import "mocha";
import { expect } from "chai";
import Timestamp from "@pedrouid/timestamp";
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
} from "./shared";
import { testSessionScenarios } from "./shared/session";

describe("Client", () => {
  it("instantiate successfully", async () => {
    const client = await Client.init(TEST_CLIENT_OPTIONS);
    expect(client).to.be.exist;
  });
  it("connect two clients and resolve a JSON-RPC request", async function() {
    // TODO the localhost value needs to be set with OPS
    if (TEST_CLIENT_OPTIONS.relayProvider !== "ws://localhost:5555") {
      this.timeout(10000);
    }
    // testing data points
    let sessionA: SessionTypes.Created | undefined;
    let sessionB: SessionTypes.Created | undefined;
    let result: string[] = [];

    // timestamps & elapsed time
    const time = new Timestamp();

    // test session scenario & get clients
    const {
      clients: { a: clientA, b: clientB },
    } = await testSessionScenarios();

    // request & resolve a JSON-RPC request
    await Promise.all([
      new Promise<void>(async (resolve, reject) => {
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
      new Promise<void>(async (resolve, reject) => {
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

    // jsonrpc request & response
    expect(result).to.eql;
  });
});
