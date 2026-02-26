import { parseUri } from "@walletconnect/utils";
import {
  EngineTypes,
  PairingTypes,
  RelayerTypes,
  ProposalTypes,
  SessionTypes,
} from "@walletconnect/types";
import {
  TEST_RELAY_OPTIONS,
  TEST_NAMESPACES,
  TEST_REQUIRED_NAMESPACES,
  TEST_OPTIONAL_NAMESPACES,
} from "./constants";
import { expect } from "vitest";
import UniversalProvider from "../../src/UniversalProvider";

export interface TestConnectParams {
  requiredNamespaces?: ProposalTypes.RequiredNamespaces;
  optionalNamespaces?: ProposalTypes.OptionalNamespaces;
  namespaces?: SessionTypes.Namespaces;
  relays?: RelayerTypes.ProtocolOptions[];
  pairingTopic?: string;
  qrCodeScanLatencyMs?: number;
  sessionProperties?: SessionTypes.Struct["sessionProperties"];
  scopedProperties?: SessionTypes.Struct["scopedProperties"];
}

export async function testConnectMethod(
  providers: { dapp: UniversalProvider; wallet: UniversalProvider },
  params?: TestConnectParams,
) {
  const start = Date.now();
  const { dapp, wallet } = providers;
  const dappClient = dapp;
  const walletClient = wallet.client;

  const connectParams: EngineTypes.ConnectParams = {
    requiredNamespaces: params?.requiredNamespaces || TEST_REQUIRED_NAMESPACES,
    optionalNamespaces: params?.optionalNamespaces || TEST_OPTIONAL_NAMESPACES,
    relays: params?.relays || undefined,
    pairingTopic: params?.pairingTopic || undefined,
  };
  const approveParams: Omit<EngineTypes.ApproveParams, "id"> = {
    namespaces: params?.namespaces || TEST_NAMESPACES,
    sessionProperties: params?.sessionProperties,
    scopedProperties: params?.scopedProperties,
  };

  // We need to kick off the promise that binds the listener for `session_proposal` before `A.connect()`
  // is called, to avoid race conditions.
  const resolveSessionProposal = new Promise<void>((resolve, reject) => {
    walletClient.once("session_proposal", async (proposal) => {
      try {
        expect(proposal.params.requiredNamespaces).to.eql({});
        const { acknowledged } = await walletClient.approve({
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
  });

  const clientAConnectLatencyMs = Date.now() - start;

  let pairingA: PairingTypes.Struct | undefined;
  let pairingB: PairingTypes.Struct | undefined;

  let sessionA: SessionTypes.Struct | undefined;
  let sessionB: SessionTypes.Struct | undefined;

  const pair: (uri: string) => Promise<PairingTypes.Struct> = (uri: string) =>
    new Promise(async function (resolve, reject) {
      const pairTimeoutMs = 15_000;
      const timeout = setTimeout(() => {
        return reject(new Error(`Pair timed out after ${pairTimeoutMs}ms`));
      }, pairTimeoutMs);
      const result = await walletClient.pair({ uri });
      clearTimeout(timeout);
      return resolve(result);
    });

  await Promise.all([
    resolveSessionProposal,
    new Promise<void>(async (resolve, reject) => {
      try {
        dapp.on("display_uri", async (uri: string) => {
          const uriParams = parseUri(uri);

          pairingA = dappClient.client?.pairing.get(uriParams.topic);
          expect(pairingA.topic).to.eql(uriParams.topic);
          expect(pairingA.relay).to.eql(uriParams.relay);

          if (uri) {
            pairingB = await pair(uri);

            if (!pairingA) throw new Error("expect pairing A to be defined");
            expect(pairingB.topic).to.eql(pairingA.topic);
            expect(pairingB.relay).to.eql(pairingA.relay);

            resolve();
          } else {
            reject(new Error("missing uri"));
          }
        });
      } catch (error) {
        reject(error);
      }
    }),
    new Promise<void>(async (resolve, reject) => {
      try {
        const namespaces = connectParams.requiredNamespaces;
        const optionalNamespaces = connectParams.optionalNamespaces;
        const session = await dapp.connect({
          namespaces,
          optionalNamespaces,
        });
        if (!session) throw new Error();
        const lastKeyIndex = dapp.client.session.keys.length - 1;
        sessionA = dapp.client.session.get(dapp.client.session.keys[lastKeyIndex]);
        resolve();
      } catch (error) {
        reject(error);
      }
    }),
  ]);

  const settlePairingLatencyMs = Date.now() - start - (params?.qrCodeScanLatencyMs || 0);

  if (!sessionA) throw new Error("expect session A to be defined");
  if (!sessionB) throw new Error("expect session B to be defined");

  // topic
  expect(sessionA.topic).to.eql(sessionB.topic);
  // relay
  expect(sessionA.relay).to.eql(TEST_RELAY_OPTIONS);
  expect(sessionA.relay).to.eql(sessionB.relay);
  // namespaces
  expect(sessionA.namespaces).to.eql(approveParams.namespaces);
  expect(sessionA.namespaces).to.eql(sessionB.namespaces);
  // testing expiry is not reliable as on slow networks we take longer to settle
  // expect(Math.abs(sessionA.expiry - sessionB.expiry)).to.be.lessThan(5);

  // participants
  expect(sessionA.self).to.eql(sessionB.peer);
  expect(sessionA.peer).to.eql(sessionB.self);
  // controller
  expect(sessionA.controller).to.eql(sessionB.controller);
  expect(sessionA.controller).to.eql(sessionA.peer.publicKey);
  expect(sessionB.controller).to.eql(sessionB.self.publicKey);
  // metadata
  expect(sessionA.self.metadata).to.eql(sessionB.peer.metadata);
  expect(sessionB.self.metadata).to.eql(sessionA.peer.metadata);

  return { sessionA, clientAConnectLatencyMs, settlePairingLatencyMs };
}

export function batchArray(array: any[], size: number) {
  const result: any[] = [];
  for (let i = 0; i < array.length; i += size) {
    const batch: any = array.slice(i, i + size);
    result.push(batch);
  }
  return result;
}
