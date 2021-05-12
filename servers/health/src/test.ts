import ClientV1 from "clientv1";
import { Client as ClientV2, CLIENT_EVENTS } from "clientv2";
import Timestamp from "@pedrouid/timestamp";

import { formatJsonRpcResult } from "@json-rpc-tools/utils";
import { PairingTypes, SessionTypes, AppMetadata } from "walletconnect-types-v2";

const chainId = "eip155:1";
const method = "personal_sign";
const params = ["0xdeadbeaf", "0x1d85568eEAbad713fBB5293B45ea066e552A90De"];
const request = { method, params };
const result =
  "0xa3f20717a250c2b0b729b7e5becbff67fdaef7e0699da4de7ca5895b02a170a12d887fd3b17bfdce3481f10bea41f45ba9f709d39ce8325427b57afcfc994cee1b";

const permissions: SessionTypes.BasePermissions = {
  blockchain: {
    chains: [chainId],
  },
  jsonrpc: {
    methods: [method],
  },
};

const metadata: AppMetadata = {
  name: "App Name",
  description: "Description of App",
  url: "https://walletconnect.org",
  icons: ["https://walletconnect.org/walletconnect-logo.png"],
};

const state: SessionTypes.State = {
  accounts: ["0x1d85568eEAbad713fBB5293B45ea066e552A90De@eip155:1"],
};

let received: any = undefined;

export async function testRelayProvider(relayProvider: string) {
  // setup clients
  const clients = {
    a: await ClientV2.init({ name: "A", relayProvider, metadata }),
    b: await ClientV2.init({ name: "B", relayProvider, metadata, controller: true }),
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

const connectorParams = {
  accounts: ["0x1d85568eEAbad713fBB5293B45ea066e552A90De"],
  chainId: 1,
};

export async function testLegacyBridge(bridgeProvider: string) {
  const connectorA = new ClientV1({
    bridge: bridgeProvider,
    clientMeta: metadata,
  });
  let connectorB: ClientV1 | undefined;

  const time = new Timestamp();
  time.start("total");

  await Promise.all([
    new Promise<void>((resolve, reject) => {
      connectorA.on("connect", error => {
        if (error) {
          reject(error);
        }
        resolve();
      });
    }),
    new Promise<void>((resolve, reject) => {
      connectorA.on("display_uri", (error, payload) => {
        time.start("session");
        if (error) {
          reject(error);
        }
        const uri = payload.params[0];
        connectorB = new ClientV1({ uri });

        connectorB.on("session_request", error => {
          if (error) {
            reject(error);
          }
          if (typeof connectorB === "undefined") {
            throw new Error("Peer connector is undefined");
          }
          connectorB.approveSession(connectorParams);
          time.stop("session");
          resolve();
        });
      });
    }),
    new Promise<void>(async (resolve, reject) => {
      await connectorA.createSession(connectorParams);
      resolve();
    }),
  ]);

  if (typeof connectorB === "undefined") {
    throw new Error("Peer connector is undefined");
  }

  // request & respond a JSON-RPC request
  await Promise.all([
    new Promise<void>(async (resolve, reject) => {
      connectorB?.on(request.method, (error, payload) => {
        if (error) {
          throw error;
        }
        if (payload) connectorB?.approveRequest({ id: 1, result });
        resolve();
      });
    }),
    new Promise<void>(async (resolve, reject) => {
      time.start("request");
      received = await connectorA.sendCustomRequest({ id: 1, ...request });
      time.stop("request");
      resolve();
    }),
  ]);

  time.stop("total");

  const test = {
    session: time.get("session"),
    request: time.get("request"),
    total: time.get("total"),
  };

  if (!received || received !== result) {
    throw new Error("Incorrect result when checking");
  }

  return { success: true, test };
}
