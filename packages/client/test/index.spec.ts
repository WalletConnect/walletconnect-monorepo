import "mocha";
import { expect } from "chai";
import { formatJsonRpcRequest, formatJsonRpcResult, isJsonRpcRequest } from "@json-rpc-tools/utils";

import { SessionTypes, ConnectionTypes } from "@walletconnect/types";

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
  Time,
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
    const time = new Time();

    // init clients
    const clientA = await Client.init({ ...TEST_CLIENT_OPTIONS, overrideContext: "clientA" });
    const clientB = await Client.init({ ...TEST_CLIENT_OPTIONS, overrideContext: "clientB" });

    // connect two clients
    await Promise.all([
      new Promise(async (resolve, reject) => {
        time.start("connect");
        await clientA.connect({
          metadata: TEST_APP_METADATA_A,
          permissions: TEST_PERMISSIONS,
        });
        time.stop("connect");
        resolve();
      }),
      new Promise(async (resolve, reject) => {
        // Client A shares connection proposal out-of-band with Client B
        clientA.on(
          CLIENT_EVENTS.connection.proposal,
          async (proposal: ConnectionTypes.Proposal) => {
            clientB.logger.warn(`TEST >> Connection Proposal`);
            await clientB.tether({ uri: proposal.signal.params.uri });
            clientB.logger.warn(`TEST >> Connection Responded`);
            resolve();
          },
        );
      }),
      new Promise(async (resolve, reject) => {
        clientB.on(CLIENT_EVENTS.session.proposal, async (proposal: SessionTypes.Proposal) => {
          clientB.logger.warn(`TEST >> Session Proposal`);
          const response: SessionTypes.Response = {
            state: TEST_SESSION_STATE,
            metadata: TEST_APP_METADATA_B,
          };
          await clientB.approve({ proposal, response });
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
          time.start("connection");
          resolve();
        });
      }),
      new Promise(async (resolve, reject) => {
        clientB.connection.pending.on(SUBSCRIPTION_EVENTS.deleted, async () => {
          clientB.logger.warn(`TEST >> Connection Acknowledged`);
          time.stop("connection");
          resolve();
        });
      }),
      new Promise(async (resolve, reject) => {
        clientA.session.pending.on(SUBSCRIPTION_EVENTS.created, async () => {
          clientA.logger.warn(`TEST >> Session Proposed`);
          time.start("session");
          resolve();
        });
      }),
      new Promise(async (resolve, reject) => {
        clientB.session.pending.on(SUBSCRIPTION_EVENTS.deleted, async () => {
          clientB.logger.warn(`TEST >> Session Acknowledged`);
          time.stop("session");
          resolve();
        });
      }),
    ]);

    // request & resolve a JSON-RPC request
    await Promise.all([
      new Promise(async (resolve, reject) => {
        clientB.on(
          CLIENT_EVENTS.session.payload,
          async (payloadEvent: SessionTypes.PayloadEvent) => {
            if (typeof sessionB === "undefined") throw new Error("Missing session for client B");
            if (
              isJsonRpcRequest(payloadEvent.payload) &&
              payloadEvent.topic === sessionB.topic &&
              payloadEvent.chainId === TEST_PERMISSIONS_CHAIN_IDS[0]
            ) {
              clientB.logger.warn(`TEST >> JSON-RPC Request Received`);
              await clientB.respond({
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
        time.start("request");
        result = await clientA.request({
          topic: sessionA.topic,
          chainId: TEST_PERMISSIONS_CHAIN_IDS[0],
          request: formatJsonRpcRequest("eth_accounts", []),
        });
        clientA.logger.warn(`TEST >> JSON-RPC Response Received`);
        time.stop("request");
        resolve();
      }),
    ]);

    if (typeof sessionA === "undefined") throw new Error("Missing session for client A");
    if (typeof sessionB === "undefined") throw new Error("Missing session for client B");
    clientB.logger.warn(`TEST >> Connection Elapsed Time: ${time.elapsed("connection")}ms`);
    clientB.logger.warn(`TEST >> Session Elapsed Time: ${time.elapsed("session")}ms`);
    clientB.logger.warn(`TEST >> Connect Elapsed Time: ${time.elapsed("connect")}ms`);
    clientB.logger.warn(`TEST >> Request Elapsed Time: ${time.elapsed("request")}ms`);
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
    // blockchain permissions
    expect(sessionA.permissions.state.controller.publicKey).to.eql(sessionB.self.publicKey);
    expect(sessionB.permissions.state.controller.publicKey).to.eql(sessionB.self.publicKey);
    expect(sessionA.permissions.notifications.controller.publicKey).to.eql(sessionB.self.publicKey);
    expect(sessionB.permissions.notifications.controller.publicKey).to.eql(sessionB.self.publicKey);
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
