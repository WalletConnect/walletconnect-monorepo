import "mocha";
import { expect } from "chai";
import { formatJsonRpcRequest, formatJsonRpcResult, isJsonRpcRequest } from "rpc-json-utils";

import { SessionTypes, ConnectionTypes, SubscriptionEvent } from "@walletconnect/types";

import Client, { CLIENT_EVENTS, SUBSCRIPTION_EVENTS } from "../src";
import {
  TEST_CLIENT_OPTIONS,
  TEST_PERMISSIONS_CHAIN_IDS,
  TEST_PERMISSIONS_JSONRPC_METHODS,
  TEST_PERMISSIONS,
  TEST_APP_METADATA_A,
  TEST_APP_METADATA_B,
  TEST_ETHEREUM_ACCOUNTS,
  TEST_SESSION_ACCOUNT_IDS,
  TEST_SESSION_STATE,
} from "./shared";

describe("Client", () => {
  it("instantiate successfully", async () => {
    const client = await Client.init(TEST_CLIENT_OPTIONS);
    expect(client).to.be.exist;
  });
  it("connect two clients and resolve a JSON-RPC request", async () => {
    // testing data points
    let sessionA: SessionTypes.Created | undefined;
    let sessionB: SessionTypes.Created | undefined;
    let result: string[] = [];

    // timestamps & elapsed time
    const timestamps = {
      connection: { started: 0, elapsed: 0 },
      session: { started: 0, elapsed: 0 },
      connect: { started: 0, elapsed: 0 },
      request: { started: 0, elapsed: 0 },
    };

    // init clients
    const clientA = await Client.init({ ...TEST_CLIENT_OPTIONS, overrideContext: "clientA" });
    const clientB = await Client.init({ ...TEST_CLIENT_OPTIONS, overrideContext: "clientB" });

    // connect two clients
    await Promise.all([
      new Promise(async (resolve, reject) => {
        timestamps.connect.started = Date.now();
        await clientA.connect({
          metadata: TEST_APP_METADATA_A,
          permissions: TEST_PERMISSIONS,
        });
        timestamps.connect.elapsed = Date.now() - timestamps.connect.started;
        resolve();
      }),
      new Promise(async (resolve, reject) => {
        // Client A shares connection proposal out-of-band with Client B
        clientA.on(
          CLIENT_EVENTS.connection.proposal,
          async (proposal: ConnectionTypes.Proposal) => {
            clientA.logger.warn(`TEST >> Connection Proposal`);
            await clientB.respond({ approved: true, uri: proposal.signal.params.uri });
            clientA.logger.warn(`TEST >> Connection Responded`);
            resolve();
          },
        );
      }),
      new Promise(async (resolve, reject) => {
        clientB.on(CLIENT_EVENTS.session.proposal, async (proposal: SessionTypes.Proposal) => {
          clientB.logger.warn(`TEST >> Session Proposal`);
          const response = { state: TEST_SESSION_STATE, metadata: TEST_APP_METADATA_B };
          await clientB.respond({ approved: true, proposal, response });
          clientB.logger.warn(`TEST >> Session Responded`);
          resolve();
        });
      }),

      new Promise(async (resolve, reject) => {
        clientA.on(CLIENT_EVENTS.session.created, async (session: SessionTypes.Created) => {
          clientA.logger.warn(`TEST >> Session Created`);
          sessionA = session;
          resolve();
        });
      }),
      new Promise(async (resolve, reject) => {
        clientB.on(CLIENT_EVENTS.session.created, async (session: SessionTypes.Created) => {
          clientB.logger.warn(`TEST >> Session Created`);
          sessionB = session;
          resolve();
        });
      }),
      new Promise(async (resolve, reject) => {
        clientA.connection.pending.on(SUBSCRIPTION_EVENTS.created, async () => {
          clientA.logger.warn(`TEST >> Connection Proposed`);
          timestamps.connection.started = Date.now();
          resolve();
        });
      }),
      new Promise(async (resolve, reject) => {
        clientB.connection.pending.on(SUBSCRIPTION_EVENTS.deleted, async () => {
          clientB.logger.warn(`TEST >> Connection Acknowledged`);
          timestamps.connection.elapsed = Date.now() - timestamps.connection.started;
          resolve();
        });
      }),
      new Promise(async (resolve, reject) => {
        clientA.session.pending.on(SUBSCRIPTION_EVENTS.created, async () => {
          clientA.logger.warn(`TEST >> Session Proposed`);
          timestamps.session.started = Date.now();
          resolve();
        });
      }),
      new Promise(async (resolve, reject) => {
        clientB.session.pending.on(SUBSCRIPTION_EVENTS.deleted, async () => {
          clientB.logger.warn(`TEST >> Session Acknowledged`);
          timestamps.session.elapsed = Date.now() - timestamps.session.started;
          resolve();
        });
      }),
    ]);

    // request & resolve a JSON-RPC request
    await Promise.all([
      new Promise(async (resolve, reject) => {
        clientB.on(
          CLIENT_EVENTS.session.payload,
          async (payloadEvent: SubscriptionEvent.Payload) => {
            if (typeof sessionB === "undefined") throw new Error("Missing session for client B");
            if (isJsonRpcRequest(payloadEvent.payload) && payloadEvent.topic === sessionB.topic) {
              clientB.logger.warn(`TEST >> JSON-RPC Request Received`);
              await clientB.resolve({
                topic: sessionB.topic,
                response: formatJsonRpcResult(payloadEvent.payload.id, TEST_ETHEREUM_ACCOUNTS),
              });
              clientB.logger.warn(`TEST >> JSON-RPC Response Sent`);
              resolve();
            }
          },
        );
      }),
      new Promise(async (resolve, reject) => {
        clientA.logger.warn(`TEST >> JSON-RPC Request Sent`);
        if (typeof sessionA === "undefined") throw new Error("Missing session for client A");
        timestamps.request.started = Date.now();
        result = await clientA.request({
          topic: sessionA.topic,
          request: formatJsonRpcRequest("eth_accounts", []),
        });
        clientA.logger.warn(`TEST >> JSON-RPC Response Received`);
        timestamps.request.elapsed = Date.now() - timestamps.request.started;

        resolve();
      }),
    ]);

    if (typeof sessionA === "undefined") throw new Error("Missing session for client A");
    if (typeof sessionB === "undefined") throw new Error("Missing session for client B");
    clientB.logger.warn(`TEST >> Connection Elapsed Time: ${timestamps.connection.elapsed}ms`);
    clientB.logger.warn(`TEST >> Session Elapsed Time: ${timestamps.session.elapsed}ms`);
    clientB.logger.warn(`TEST >> Connect Elapsed Time: ${timestamps.connect.elapsed}ms`);
    clientB.logger.warn(`TEST >> Request Elapsed Time: ${timestamps.request.elapsed}ms`);
    // session data
    expect(sessionA.topic).to.eql(sessionB.topic);
    expect(sessionA.relay.protocol).to.eql(sessionB.relay.protocol);
    expect(sessionA.peer.publicKey).to.eql(sessionB.self.publicKey);
    expect(sessionA.self.publicKey).to.eql(sessionB.peer.publicKey);
    expect(sessionA.peer.metadata).to.eql(TEST_APP_METADATA_B);
    expect(sessionB.peer.metadata).to.eql(TEST_APP_METADATA_A);
    // blockchain state
    expect(sessionA.state.accountIds).to.eql(TEST_SESSION_ACCOUNT_IDS);
    expect(sessionA.state.accountIds).to.eql(sessionB.state.accountIds);
    expect(sessionA.state.controller.publicKey).to.eql(sessionB.self.publicKey);
    expect(sessionB.state.controller.publicKey).to.eql(sessionB.self.publicKey);
    // blockchain permissions
    expect(sessionA.permissions.blockchain.chainIds).to.eql(TEST_PERMISSIONS_CHAIN_IDS);
    expect(sessionA.permissions.blockchain.chainIds).to.eql(
      sessionB.permissions.blockchain.chainIds,
    );
    // jsonrpc permmissions
    expect(sessionA.permissions.jsonrpc.methods).to.eql(TEST_PERMISSIONS_JSONRPC_METHODS);
    expect(sessionA.permissions.jsonrpc.methods).to.eql(sessionB.permissions.jsonrpc.methods);
    // jsonrpc request & response
    expect(result).to.eql;
  });
});
