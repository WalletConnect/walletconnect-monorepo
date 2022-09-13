import { parseUri } from "@walletconnect/utils";
import {
  EngineTypes,
  PairingTypes,
  RelayerTypes,
  ProposalTypes,
  SessionTypes,
} from "@walletconnect/types";
import { throttle } from "./../shared";
import { TEST_RELAY_OPTIONS, TEST_NAMESPACES, TEST_REQUIRED_NAMESPACES } from "./values";
import { Clients } from "./init";
import { expect } from "vitest";

export interface TestConnectParams {
  requiredNamespaces?: ProposalTypes.RequiredNamespaces;
  namespaces?: SessionTypes.Namespaces;
  relays?: RelayerTypes.ProtocolOptions[];
  pairingTopic?: string;
  qrCodeScanLatencyMs?: number;
}

export async function testConnectMethod(clients: Clients, params?: TestConnectParams) {
  const { A, B } = clients;

  const connectParams: EngineTypes.ConnectParams = {
    requiredNamespaces: params?.requiredNamespaces || TEST_REQUIRED_NAMESPACES,
    relays: params?.relays || undefined,
    pairingTopic: params?.pairingTopic || undefined,
  };

  const approveParams: Omit<EngineTypes.ApproveParams, "id"> = {
    namespaces: params?.namespaces || TEST_NAMESPACES,
  };

  // We need to kick off the promise that binds the listener for `session_proposal` before `A.connect()`
  // is called, to avoid race conditions.
  const resolveSessionProposal = new Promise<void>((resolve, reject) => {
    B.once("session_proposal", async (proposal) => {
      try {
        expect(proposal.params.requiredNamespaces).to.eql(connectParams.requiredNamespaces);

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

  const { uri, approval } = await A.connect(connectParams);

  let pairingA: PairingTypes.Struct | undefined;
  let pairingB: PairingTypes.Struct | undefined;

  if (!connectParams.pairingTopic) {
    // This is a new pairing. Let's apply a timeout to mimick
    // QR code scanning
    if (!uri) throw new Error("uri is missing");
    if (params?.qrCodeScanLatencyMs) await throttle(params?.qrCodeScanLatencyMs);

    const uriParams = parseUri(uri);

    pairingA = A.pairing.get(uriParams.topic);
    expect(pairingA.topic).to.eql(uriParams.topic);
    expect(pairingA.relay).to.eql(uriParams.relay);
  } else {
    // This is a new pairing. Let's apply a timeout to mimick
    // QR code scanning
    if (params?.qrCodeScanLatencyMs) await throttle(params?.qrCodeScanLatencyMs);
    pairingA = A.pairing.get(connectParams.pairingTopic);
    pairingB = B.pairing.get(connectParams.pairingTopic);
  }

  if (!pairingA) throw new Error("expect pairing A to be defined");

  let sessionA: SessionTypes.Struct | undefined;
  let sessionB: SessionTypes.Struct | undefined;

  await Promise.all([
    resolveSessionProposal,
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

  // topic
  expect(sessionA.topic).to.eql(sessionB.topic);
  // relay
  expect(sessionA.relay).to.eql(TEST_RELAY_OPTIONS);
  expect(sessionA.relay).to.eql(sessionB.relay);
  // namespaces
  expect(sessionA.namespaces).to.eql(approveParams.namespaces);
  expect(sessionA.namespaces).to.eql(sessionB.namespaces);
  // expiry
  expect(Math.abs(sessionA.expiry - sessionB.expiry)).to.be.lessThan(5);
  // acknowledged
  expect(sessionA.acknowledged).to.eql(sessionB.acknowledged);
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

  return { pairingA, sessionA };
}

export function batchArray(array: any[], size: number) {
  const result: any[] = [];
  for (let i = 0; i < array.length; i += size) {
    const batch: any = array.slice(i, i + size);
    result.push(batch);
  }
  return result;
}
