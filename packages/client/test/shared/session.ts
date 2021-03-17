import "mocha";
import Timestamp from "@pedrouid/timestamp";
import { SessionTypes, PairingTypes, SignalTypes } from "@walletconnect/types";

import { CLIENT_EVENTS, SUBSCRIPTION_EVENTS } from "../../src";

import { expect } from "./chai";
import { InitializedClients, InitializedSetup } from "./types";

export async function testApproveSession(
  setup: InitializedSetup,
  clients: InitializedClients,
  pairing?: SignalTypes.ParamsPairing,
): Promise<string> {
  // testing data points
  let sessionA: SessionTypes.Created | undefined;
  let sessionB: SessionTypes.Created | undefined;

  // timestamps & elapsed time
  const time = new Timestamp();

  // connect two clients
  await Promise.all([
    new Promise<void>(async (resolve, reject) => {
      time.start("connect");
      await clients.a.connect({
        metadata: setup.a.metadata,
        permissions: setup.a.permissions,
        pairing,
      });
      time.stop("connect");
      resolve();
    }),
    new Promise<void>(async (resolve, reject) => {
      if (typeof pairing !== "undefined") {
        return resolve();
      }
      // Client A shares pairing proposal out-of-band with Client B
      clients.a.on(CLIENT_EVENTS.pairing.proposal, async (proposal: PairingTypes.Proposal) => {
        clients.b.logger.warn(`TEST >> Pairing Proposal`);
        await clients.b.pair({ uri: proposal.signal.params.uri });
        clients.b.logger.warn(`TEST >> Pairing Responded`);
        resolve();
      });
    }),
    new Promise<void>(async (resolve, reject) => {
      clients.b.on(CLIENT_EVENTS.session.proposal, async (proposal: SessionTypes.Proposal) => {
        clients.b.logger.warn(`TEST >> Session Proposal`);
        const response: SessionTypes.Response = {
          state: setup.b.state,
          metadata: setup.b.metadata,
        };
        await clients.b.approve({ proposal, response });
        clients.b.logger.warn(`TEST >> Session Responded`);
        resolve();
      });
    }),

    new Promise<void>(async (resolve, reject) => {
      clients.a.on(CLIENT_EVENTS.session.created, async (session: SessionTypes.Created) => {
        clients.a.logger.warn(`TEST >> Session Created`);
        sessionA = session;
        resolve();
      });
    }),
    new Promise<void>(async (resolve, reject) => {
      clients.b.on(CLIENT_EVENTS.session.created, async (session: SessionTypes.Created) => {
        clients.b.logger.warn(`TEST >> Session Created`);
        sessionB = session;
        resolve();
      });
    }),
    new Promise<void>(async (resolve, reject) => {
      if (typeof pairing !== "undefined") {
        return resolve();
      }
      clients.a.pairing.pending.on(SUBSCRIPTION_EVENTS.created, async () => {
        clients.a.logger.warn(`TEST >> Pairing Proposed`);
        time.start("pairing");
        resolve();
      });
    }),
    new Promise<void>(async (resolve, reject) => {
      if (typeof pairing !== "undefined") {
        return resolve();
      }
      clients.b.pairing.pending.on(SUBSCRIPTION_EVENTS.deleted, async () => {
        clients.b.logger.warn(`TEST >> Pairing Acknowledged`);
        time.stop("pairing");
        resolve();
      });
    }),
    new Promise<void>(async (resolve, reject) => {
      clients.a.session.pending.on(SUBSCRIPTION_EVENTS.created, async () => {
        clients.a.logger.warn(`TEST >> Session Proposed`);
        time.start("session");
        resolve();
      });
    }),
    new Promise<void>(async (resolve, reject) => {
      clients.b.session.pending.on(SUBSCRIPTION_EVENTS.deleted, async () => {
        clients.b.logger.warn(`TEST >> Session Acknowledged`);
        time.stop("session");
        resolve();
      });
    }),
  ]);

  // log elapsed times
  if (typeof pairing === "undefined") {
    clients.b.logger.warn(`TEST >> Pairing Elapsed Time: ${time.elapsed("pairing")}ms`);
  }
  clients.b.logger.warn(`TEST >> Session Elapsed Time: ${time.elapsed("session")}ms`);
  clients.b.logger.warn(`TEST >> Connect Elapsed Time: ${time.elapsed("connect")}ms`);

  // session data
  expect(sessionA?.topic).to.eql(sessionB?.topic);
  expect(sessionA?.relay.protocol).to.eql(sessionB?.relay.protocol);
  expect(sessionA?.peer.publicKey).to.eql(sessionB?.self.publicKey);
  expect(sessionA?.self.publicKey).to.eql(sessionB?.peer.publicKey);
  expect(sessionA?.peer.metadata).to.eql(setup.b.metadata);
  expect(sessionB?.peer.metadata).to.eql(setup.a.metadata);
  // blockchain state
  expect(sessionA?.state.accounts).to.eql(setup.b.state.accounts);
  expect(sessionA?.state.accounts).to.eql(sessionB?.state.accounts);
  // blockchain permissions
  expect(sessionA?.permissions.controller.publicKey).to.eql(sessionB?.self.publicKey);
  expect(sessionB?.permissions.controller.publicKey).to.eql(sessionB?.self.publicKey);
  expect(sessionA?.permissions.blockchain.chains).to.eql(setup.b.permissions.blockchain.chains);
  expect(sessionA?.permissions.blockchain.chains).to.eql(sessionB?.permissions.blockchain.chains);
  // jsonrpc permmissions
  expect(sessionA?.permissions.jsonrpc.methods).to.eql(setup.b.permissions.jsonrpc.methods);
  expect(sessionA?.permissions.jsonrpc.methods).to.eql(sessionB?.permissions.jsonrpc.methods);

  return sessionA?.topic || "";
}

export async function testRejectSession(
  setup: InitializedSetup,
  clients: InitializedClients,
  pairing?: SignalTypes.ParamsPairing,
): Promise<string> {
  await Promise.all([
    new Promise<void>(async (resolve, reject) => {
      const promise = clients.a.connect({
        metadata: setup.a.metadata,
        permissions: setup.a.permissions,
        pairing,
      });
      await expect(promise).to.eventually.be.rejectedWith("Session not approved");
      resolve();
    }),
    new Promise<void>(async (resolve, reject) => {
      if (typeof pairing !== "undefined") {
        return resolve();
      }
      // Client A shares pairing proposal out-of-band with Client B
      clients.a.on(CLIENT_EVENTS.pairing.proposal, async (proposal: PairingTypes.Proposal) => {
        clients.b.logger.warn(`TEST >> Pairing Proposal`);
        await clients.b.pair({ uri: proposal.signal.params.uri });
        clients.b.logger.warn(`TEST >> Pairing Responded`);
        resolve();
      });
    }),
    // Client B receives session proposal and rejects it
    new Promise<void>(async (resolve, reject) => {
      clients.b.on(CLIENT_EVENTS.session.proposal, async (proposal: SessionTypes.Proposal) => {
        clients.b.logger.warn(`TEST >> Session Proposal`);
        await clients.b.reject({ proposal });
        clients.b.logger.warn(`TEST >> Session Responded`);
        resolve();
      });
    }),
  ]);

  return "";
}
