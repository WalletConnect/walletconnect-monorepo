import "mocha";
// import { expect } from "chai";

import { parseUri } from "@walletconnect/utils";
import { EngineTypes, PairingTypes, RelayerTypes, SessionTypes } from "@walletconnect/types";

import { expect } from "./chai";
import {
  TEST_CHAINS,
  TEST_METHODS,
  TEST_EVENTS,
  TEST_ACCOUNTS,
  TEST_RELAY_OPTIONS,
} from "./values";

import { Clients } from "./init";

export interface TestConnectParams extends EngineTypes.ConnectParams {
  accounts?: string[];
  relays?: RelayerTypes.ProtocolOptions[];
}

export async function testConnectMethod(clients: Clients, params?: TestConnectParams) {
  const { A, B } = clients;

  const connectParams: EngineTypes.ConnectParams = {
    methods: params?.methods || TEST_METHODS,
    chains: params?.chains || TEST_CHAINS,
    events: params?.events || TEST_EVENTS,
    relays: params?.relays || undefined,
    pairingTopic: params?.pairingTopic || undefined,
  };

  const approveParams: Omit<EngineTypes.ApproveParams, "id"> = {
    accounts: params?.accounts || TEST_ACCOUNTS,
    methods: params?.methods || TEST_METHODS,
    events: params?.events || TEST_EVENTS,
  };

  const { uri, approval } = await A.connect(connectParams);

  let pairingA: PairingTypes.Struct | undefined;
  let pairingB: PairingTypes.Struct | undefined;

  if (!connectParams.pairingTopic) {
    if (!uri) throw new Error("uri is missing");

    const uriParams = parseUri(uri);

    pairingA = await A.pairing.get(uriParams.topic);
    expect(pairingA.topic).to.eql(uriParams.topic);
    expect(pairingA.relay).to.eql(uriParams.relay);
  }

  let sessionA: SessionTypes.Struct | undefined;
  let sessionB: SessionTypes.Struct | undefined;

  await Promise.all([
    new Promise<void>((resolve, reject) => {
      B.on("session_proposal", async proposal => {
        try {
          expect(proposal.chains).to.eql(connectParams.chains);
          expect(proposal.methods).to.eql(connectParams.methods);
          expect(proposal.events).to.eql(connectParams.events);

          const { acknowledged } = await B.approve({
            id: proposal.id,
            ...approveParams,
          });
          if (!sessionB) {
            sessionB = await acknowledged();
          }
          resolve();
        } catch (e) {
          reject(e);
        }
      });
    }),
    new Promise<void>(async (resolve, reject) => {
      // immediatelly resolve if pairingTopic is provided
      if (connectParams.pairingTopic) return resolve();
      try {
        if (uri) {
          pairingB = await B.pair({ uri });
          if (!pairingA) throw new Error("pairingA is missing");
          expect(pairingB.topic).to.eql(pairingA.topic);
          expect(pairingB.relay).to.eql(pairingA.relay);

          resolve();
        } else {
          reject(new Error("missing uri"));
        }
      } catch (error) {
        reject(error);
      }
    }),
    new Promise<void>(async (resolve, reject) => {
      try {
        if (!sessionA) {
          sessionA = await approval();
        }
        resolve();
      } catch (error) {
        reject(error);
      }
    }),
  ]);

  if (!sessionA) throw new Error("expect session A to be defined");
  if (!sessionB) throw new Error("expect session B to be defined");

  expect(sessionA.topic).to.eql(sessionB.topic);
  // relay
  expect(sessionA.relay).to.eql(TEST_RELAY_OPTIONS);
  expect(sessionA.relay).to.eql(sessionB.relay);
  // accounts
  expect(sessionA.accounts).to.eql(approveParams.accounts);
  expect(sessionA.accounts).to.eql(sessionB.accounts);
  // methods
  expect(sessionA.methods).to.eql(approveParams.methods);
  expect(sessionA.methods).to.eql(sessionB.methods);
  // events
  expect(sessionA.events).to.eql(approveParams.events);
  expect(sessionA.events).to.eql(sessionB.events);
  // expiry
  expect(sessionA.expiry).to.eql(sessionB.expiry);
  // acknowledged
  expect(sessionA.acknowledged).to.eql(sessionB.acknowledged);
  // participants
  expect(sessionA.self).to.eql(sessionB.peer);
  expect(sessionA.peer).to.eql(sessionB.self);
  // controller
  expect(sessionA.controller).to.eql(sessionB.controller);
  expect(sessionA.controller).to.eql(sessionA.peer.publicKey);
  expect(sessionB.controller).to.eql(sessionB.self.publicKey);
}
