import Timestamp from "@walletconnect/timestamp";
import { formatJsonRpcResult } from "@walletconnect/jsonrpc-utils";
import { Client, CLIENT_EVENTS } from "@walletconnect/client";
import { PairingTypes, SessionTypes } from "@walletconnect/types";

import { metadata, permissions, state, chainId, request, result } from "../constants";
import { getWsUrl } from "../utils";

export async function testRelayProvider(url: string, url2?: string) {
  // client opts
  const clientAOpts = { name: "A", relayProvider: getWsUrl(url), metadata };
  const clientBOpts = {
    ...clientAOpts,
    name: "B",
    relayProvider: typeof url2 !== "undefined" ? getWsUrl(url2) : clientAOpts.relayProvider,
    controller: true,
  };

  // setup clients
  const clients = {
    a: await Client.init(clientAOpts),
    b: await Client.init(clientBOpts),
  };

  // timestamps & elapsed time
  const time = new Timestamp();

  let topic = "";

  time.start("total");

  // connect two clients
  await Promise.all([
    new Promise<void>(async (resolve, reject) => {
      time.start("session");
      const session = await clients.a.connect({ permissions });
      topic = session.topic;
      time.stop("session");
      resolve();
    }),
    new Promise<void>(async (resolve, reject) => {
      clients.a.on(CLIENT_EVENTS.pairing.proposal, async (proposal: PairingTypes.Proposal) => {
        await clients.b.pair({ uri: proposal.signal.params.uri });
        resolve();
      });
    }),
    new Promise<void>(async (resolve, reject) => {
      clients.b.on(CLIENT_EVENTS.session.proposal, async (proposal: SessionTypes.Proposal) => {
        await clients.b.approve({ proposal, response: { state } });
        resolve();
      });
    }),
  ]);

  if (!topic) {
    throw new Error("Missing or invalid topic when checking");
  }

  let received: any = undefined;

  // request & respond a JSON-RPC request
  await Promise.all([
    new Promise<void>(async (resolve, reject) => {
      clients.b.on(
        CLIENT_EVENTS.session.request,
        async (requestEvent: SessionTypes.RequestEvent) => {
          if (requestEvent.topic === topic && requestEvent.chainId === chainId) {
            await clients.b.respond({
              topic,
              response: formatJsonRpcResult(requestEvent.request.id, result),
            });
            resolve();
          }
        },
      );
    }),
    new Promise<void>(async (resolve, reject) => {
      time.start("request");
      received = await clients.a.request({ topic, chainId, request });
      time.stop("request");
      resolve();
    }),
  ]);

  if (!received || received !== result) {
    throw new Error("Incorrect result when checking");
  }

  time.stop("total");

  const test = {
    session: time.get("session"),
    request: time.get("request"),
    total: time.get("total"),
  };

  return { success: true, test };
}
