import { parseUri } from "@walletconnect/utils";
import {
  EngineTypes,
  PairingTypes,
  RelayerTypes,
  ProposalTypes,
  SessionTypes,
} from "@walletconnect/types";
import { throttle } from "./../shared";
import {
  TEST_RELAY_OPTIONS,
  TEST_NAMESPACES,
  TEST_REQUIRED_NAMESPACES,
  TEST_OPTIONAL_NAMESPACES,
  TEST_SESSION_PROPERTIES,
  TEST_SESSION_PROPERTIES_APPROVE,
} from "./values";
import { Clients } from "./init";
import { expect } from "vitest";

export interface TestConnectParams {
  requiredNamespaces?: ProposalTypes.RequiredNamespaces;
  optionalNamespaces?: ProposalTypes.OptionalNamespaces;
  namespaces?: SessionTypes.Namespaces;
  sessionProperties?: ProposalTypes.SessionProperties;
  relays?: RelayerTypes.ProtocolOptions[];
  pairingTopic?: string;
  qrCodeScanLatencyMs?: number;
}

export async function testConnectMethod(clients: Clients, params?: TestConnectParams) {
  const start = Date.now();
  const { A, B } = clients;

  const connectParams: EngineTypes.ConnectParams = {
    requiredNamespaces: params?.requiredNamespaces || TEST_REQUIRED_NAMESPACES,
    optionalNamespaces: params?.optionalNamespaces || TEST_OPTIONAL_NAMESPACES,
    sessionProperties: params?.sessionProperties || TEST_SESSION_PROPERTIES,
    relays: params?.relays || undefined,
    pairingTopic: params?.pairingTopic || undefined,
  };

  const approveParams: Omit<EngineTypes.ApproveParams, "id"> = {
    namespaces: params?.namespaces || TEST_NAMESPACES,
    sessionProperties: TEST_SESSION_PROPERTIES_APPROVE,
  };

  // We need to kick off the promise that binds the listener for `session_proposal` before `A.connect()`
  // is called, to avoid race conditions.
  const resolveSessionProposal = new Promise<void>((resolve, reject) => {
    B.once("session_proposal", async (proposal) => {
      try {
        expect(proposal.params.requiredNamespaces).to.eql(connectParams.requiredNamespaces);
        expect(proposal.params.optionalNamespaces).to.eql(connectParams.optionalNamespaces);
        expect(proposal.params.sessionProperties).to.eql(TEST_SESSION_PROPERTIES);
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
  });

  const connect: Promise<{
    uri?: string | undefined;
    approval: () => Promise<SessionTypes.Struct>;
  }> = new Promise(async function (resolve, reject) {
    const connectTimeoutMs = 800_000;
    const timeout = setTimeout(() => {
      return reject(new Error(`Connect timed out after ${connectTimeoutMs}ms - ${A.core.name}`));
    }, connectTimeoutMs);
    const result = await A.connect(connectParams);
    clearTimeout(timeout);
    return resolve(result);
  });

  const { uri, approval } = await connect;
  const clientAConnectLatencyMs = Date.now() - start;

  let pairingA: PairingTypes.Struct | undefined;
  let pairingB: PairingTypes.Struct | undefined;

  if (!connectParams.pairingTopic) {
    // This is a new pairing. Let's apply a timeout to mimic
    // QR code scanning
    if (!uri) throw new Error("uri is missing");
    if (params?.qrCodeScanLatencyMs) await throttle(params?.qrCodeScanLatencyMs);

    const uriParams = parseUri(uri);

    pairingA = A.pairing.get(uriParams.topic);
    expect(pairingA.topic).to.eql(uriParams.topic);
    expect(pairingA.relay).to.eql(uriParams.relay);
  } else {
    pairingA = A.pairing.get(connectParams.pairingTopic);
    pairingB = B.pairing.get(connectParams.pairingTopic);
  }

  if (!pairingA) throw new Error("expect pairing A to be defined");

  let sessionA: SessionTypes.Struct | undefined;
  let sessionB: SessionTypes.Struct | undefined;

  const pair: (uri: string) => Promise<PairingTypes.Struct> = (uri: string) =>
    new Promise(async function (resolve, reject) {
      const pairTimeoutMs = 800_000;
      const timeout = setTimeout(() => {
        return reject(new Error(`Pair timed out after ${pairTimeoutMs}ms`));
      }, pairTimeoutMs);
      const result = await B.pair({ uri });
      clearTimeout(timeout);
      return resolve(result);
    });
  await Promise.all([
    resolveSessionProposal,
    new Promise<void>(async (resolve, reject) => {
      // immediately resolve if pairingTopic is provided
      if (connectParams.pairingTopic) return resolve();
      try {
        if (uri) {
          pairingB = await pair(uri);
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
  expect(sessionA.sessionProperties).to.eql(TEST_SESSION_PROPERTIES_APPROVE);
  // testing expiry is not reliable as on slow networks we take longer to settle
  // expect(Math.abs(sessionA.expiry - sessionB.expiry)).to.be.lessThanOrEqual(5);
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

  if (!pairingA) throw new Error("expect pairing A to be defined");
  if (!pairingB) throw new Error("expect pairing B to be defined");

  // update pairing state beforehand
  pairingA = A.pairing.get(pairingA.topic);
  pairingB = B.pairing.get(pairingB.topic);

  // topic
  expect(pairingA.topic).to.eql(pairingB.topic);
  // relay
  expect(pairingA.relay).to.eql(TEST_RELAY_OPTIONS);
  expect(pairingA.relay).to.eql(pairingB.relay);
  // active
  expect(pairingA.active).to.eql(true);
  expect(pairingA.active).to.eql(pairingB.active);
  // metadata
  expect(pairingA.peerMetadata).to.eql(sessionA.peer.metadata);
  expect(pairingB.peerMetadata).to.eql(sessionB.peer.metadata);
  await throttle(200); // allow for relay to update
  return { pairingA, sessionA, clientAConnectLatencyMs, settlePairingLatencyMs };
}

export function batchArray(array: any[], size: number) {
  const result: any[] = [];
  for (let i = 0; i < array.length; i += size) {
    const batch: any = array.slice(i, i + size);
    result.push(batch);
  }
  return result;
}
