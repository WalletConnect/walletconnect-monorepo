import "mocha";
import Timestamp from "@walletconnect/timestamp";
import { AppMetadata, PairingTypes } from "@walletconnect/types";

import { CLIENT_EVENTS, SESSION_JSONRPC, SUBSCRIPTION_EVENTS } from "../../src";

import { expect } from "./chai";
import { InitializedClients } from "./types";

export async function testPairingWithoutSession(clients: InitializedClients): Promise<string> {
  // testing data points
  let pairingA: PairingTypes.Created | undefined;
  let pairingB: PairingTypes.Created | undefined;
  let metadataA: AppMetadata | undefined;
  let metadataB: AppMetadata | undefined;

  // timestamps & elapsed time
  const time = new Timestamp();

  // pair two clients
  await Promise.all([
    new Promise<void>(async (resolve, reject) => {
      await clients.a.pairing.create();
      resolve();
    }),
    new Promise<void>(async (resolve, reject) => {
      // Client A shares pairing proposal out-of-band with Client B
      clients.a.on(CLIENT_EVENTS.pairing.proposal, async (proposal: PairingTypes.Proposal) => {
        clients.b.logger.warn(`TEST >> Pairing Proposal`);
        await clients.b.pair({ uri: proposal.signal.params.uri });
        clients.b.logger.warn(`TEST >> Pairing Responded`);
        resolve();
      });
    }),
    new Promise<void>(async (resolve, reject) => {
      clients.a.pairing.pending.on(SUBSCRIPTION_EVENTS.created, async () => {
        clients.a.logger.warn(`TEST >> Pairing Proposed`);
        time.start("pairing");
        resolve();
      });
    }),
    new Promise<void>(async (resolve, reject) => {
      clients.b.pairing.pending.on(SUBSCRIPTION_EVENTS.deleted, async () => {
        clients.b.logger.warn(`TEST >> Pairing Acknowledged`);
        time.stop("pairing");
        resolve();
      });
    }),
    new Promise<void>(async (resolve, reject) => {
      clients.a.on(CLIENT_EVENTS.pairing.created, async (pairing: PairingTypes.Created) => {
        clients.a.logger.warn(`TEST >> Pairing Created`);
        pairingA = pairing;
        resolve();
      });
    }),
    new Promise<void>(async (resolve, reject) => {
      clients.b.on(CLIENT_EVENTS.pairing.created, async (pairing: PairingTypes.Created) => {
        clients.b.logger.warn(`TEST >> Pairing Created`);
        pairingB = pairing;
        resolve();
      });
    }),
    new Promise<void>(async (resolve, reject) => {
      clients.a.on(CLIENT_EVENTS.pairing.updated, async (pairing: PairingTypes.Created) => {
        clients.a.logger.warn(`TEST >> Pairing Updated`);
        pairingA = pairing;
        resolve();
      });
    }),
    new Promise<void>(async (resolve, reject) => {
      clients.b.on(CLIENT_EVENTS.pairing.updated, async (pairing: PairingTypes.Created) => {
        clients.b.logger.warn(`TEST >> Pairing Updated`);
        pairingB = pairing;
        resolve();
      });
    }),
  ]);

  clients.b.logger.warn(`TEST >> Pairing Elapsed Time: ${time.elapsed("pairing")}ms`);
  // pairing data
  expect(pairingA?.topic).to.eql(pairingB?.topic);
  expect(pairingA?.relay.protocol).to.eql(pairingB?.relay.protocol);
  expect(pairingA?.peer.publicKey).to.eql(pairingB?.self.publicKey);
  expect(pairingA?.self.publicKey).to.eql(pairingB?.peer.publicKey);
  // pairing state
  expect(pairingA?.state.metadata).to.eql(clients.b.metadata);
  expect(pairingA?.state.metadata).to.eql(pairingB?.state.metadata);
  // jsonrpc permmissions
  expect(pairingA?.permissions.jsonrpc.methods).to.eql([SESSION_JSONRPC.propose]);
  expect(pairingA?.permissions.jsonrpc.methods).to.eql(pairingB?.permissions.jsonrpc.methods);

  return pairingA?.topic || "";
}
