import { expect, describe, it, beforeEach, afterEach } from "vitest";
import { createServer, IncomingMessage, Server, ServerResponse } from "http";
import { AddressInfo } from "net";
import { JsonRpcPayload } from "@walletconnect/jsonrpc-utils";
import { generateRandomBytes32 } from "@walletconnect/utils";

import { HttpConnection, toHttpUrl } from "../src/controllers/http-connection";

type Poll = { body: any; headers: IncomingMessage["headers"]; res: ServerResponse };

const line = (value: unknown) => JSON.stringify(value) + "\n";
const config = { t: 1, config: { heartbeats_ms: 3000, foreground_stale_ms: 6000 } };

describe("HttpConnection", () => {
  let server: Server;
  let url: string;
  let polls: Poll[];
  let posts: { path: string; body: any }[];
  let onPoll: (poll: Poll) => void;
  let onPost: (path: string, res: ServerResponse) => void;
  let topics: string[];
  let connection: HttpConnection;

  const nextPoll = () => new Promise<Poll>((resolve) => (onPoll = resolve));
  const nextPayload = (match: (payload: any) => boolean) =>
    new Promise<any>((resolve) => {
      const onPayload = (payload: JsonRpcPayload) => {
        if (!match(payload)) return;
        connection.off("payload", onPayload);
        resolve(payload);
      };
      connection.on("payload", onPayload);
    });
  const request = (id: number, method: string, params: unknown) => {
    const response = nextPayload((payload) => payload.id === id);
    connection.send({ id, jsonrpc: "2.0", method, params });
    return response;
  };

  beforeEach(async () => {
    polls = [];
    posts = [];
    topics = [];
    onPoll = () => undefined;
    onPost = (_path, res) => res.writeHead(202).end();
    server = createServer((req, res) => {
      let raw = "";
      req.on("data", (chunk) => (raw += chunk));
      req.on("end", () => {
        const path = (req.url as string).split("?")[0];
        const body = JSON.parse(raw);
        if (path === "/v3/events") {
          res.writeHead(200, { "Content-Type": "application/x-ndjson" });
          res.write(line(config));
          const poll = { body, headers: req.headers, res };
          polls.push(poll);
          return onPoll(poll);
        }
        posts.push({ path, body });
        onPost(path, res);
      });
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    url = `ws://127.0.0.1:${(server.address() as AddressInfo).port}`;
    connection = new HttpConnection({
      url,
      query: { projectId: "project", bundleId: undefined },
      auth: () => Promise.resolve("jwt"),
      topics: () => topics,
    });
  });

  afterEach(async () => {
    await connection.close();
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  });

  it("rewrites websocket urls to http", () => {
    expect(toHttpUrl("wss://relay.walletconnect.org")).to.equal("https://relay.walletconnect.org");
    expect(toHttpUrl("ws://0.0.0.0:5555")).to.equal("http://0.0.0.0:5555");
    expect(toHttpUrl("https://relay.walletconnect.org")).to.equal(
      "https://relay.walletconnect.org",
    );
  });

  it("opens on the first line of the poll and authenticates with a bearer token", async () => {
    topics = [generateRandomBytes32()];
    await connection.open();
    expect(connection.connected).to.be.true;
    expect(polls[0].headers.authorization).to.equal("Bearer jwt");
    expect(polls[0].body.topics).to.eql(topics);
  });

  it("doesn't send an empty topic list on its first poll", async () => {
    await connection.open();
    expect(polls[0].body).to.not.have.property("topics");
  });

  it("turns poll events into irn_subscription payloads and acknowledges with the cursor", async () => {
    const topic = generateRandomBytes32();
    topics = [topic];
    await connection.open();
    const inbound = nextPayload((payload) => payload.method === "irn_subscription");
    const secondPoll = nextPoll();
    polls[0].res.end(
      line({
        events: [
          { type: "connection.closed", connectionId: "1" },
          { type: "message_v2.received", topic, message: "envelope", publishedAt: 10, tag: 1108 },
        ],
        cursor: "cursor-1",
      }),
    );
    expect((await inbound).params).to.eql({
      id: topic,
      data: { topic, message: "envelope", publishedAt: 10_000, tag: 1108, attestation: undefined },
    });
    const { body } = await secondPoll;
    expect(body.cursor).to.equal("cursor-1");
    // the list was accepted by a completed poll, so it isn't sent again
    expect(body).to.not.have.property("topics");
  });

  it("replaces the open poll to subscribe to a topic", async () => {
    const existing = generateRandomBytes32();
    topics = [existing];
    await connection.open();
    const topic = generateRandomBytes32();
    topics = [existing, topic];
    const secondPoll = nextPoll();
    const response = await request(1, "irn_subscribe", { topic });
    expect(response.result).to.equal(topic);
    expect((await secondPoll).body.topics).to.eql([existing, topic].sort());
  });

  it("publishes with the plaintext copy and without the topic in the body", async () => {
    const topic = generateRandomBytes32();
    topics = [topic];
    await connection.open();
    const params = { topic, message: "envelope", plaintext: "{}", ttl: 300, tag: 1108 };
    const response = await request(2, "irn_publish", params);
    expect(response.result).to.be.true;
    expect(posts).to.eql([
      {
        path: `/topics/${topic}/messages`,
        body: { message: "envelope", plaintext: "{}", ttl: 300, tag: 1108 },
      },
    ]);
  });

  it("joins a topic it isn't subscribed to before publishing on it", async () => {
    await connection.open();
    const topic = generateRandomBytes32();
    const secondPoll = nextPoll();
    const response = await request(3, "irn_publish", { topic, message: "m", plaintext: "{}" });
    expect((await secondPoll).body.topics).to.eql([topic]);
    expect(response.result).to.be.true;
  });

  it("keeps at most four publishes in flight", async () => {
    const topic = generateRandomBytes32();
    topics = [topic];
    await connection.open();
    let inFlight = 0;
    let maxInFlight = 0;
    onPost = (_path, res) => {
      maxInFlight = Math.max(maxInFlight, ++inFlight);
      setTimeout(() => {
        inFlight--;
        res.writeHead(202).end();
      }, 20);
    };
    const responses = await Promise.all(
      Array.from({ length: 12 }, (_, i) =>
        request(100 + i, "irn_publish", { topic, message: `m${i}`, plaintext: "{}" }),
      ),
    );
    expect(responses.every((response) => response.result === true)).to.be.true;
    expect(posts.map(({ body }) => body.message)).to.eql(responses.map((_, i) => `m${i}`));
    expect(maxInFlight).to.equal(4);
  });

  it("reports a blocked message with the relay's reason", async () => {
    const topic = generateRandomBytes32();
    topics = [topic];
    await connection.open();
    onPost = (_path, res) =>
      res.writeHead(403).end(JSON.stringify({ error: "blocked", reason: "over limit" }));
    const response = await request(4, "irn_publish", { topic, message: "m", plaintext: "{}" });
    expect(response.error).to.eql({ code: 403, message: "blocked", data: "over limit" });
    expect(posts.length).to.equal(1);
  });

  it("emits close when the poll keeps failing", async () => {
    await connection.open();
    const closed = new Promise<void>((resolve) => connection.on("close", resolve));
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
    await closed;
    expect(connection.connected).to.be.false;
  });
});
