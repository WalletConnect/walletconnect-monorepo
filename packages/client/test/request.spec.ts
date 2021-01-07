import "mocha";
import { expect } from "chai";

import {
  testJsonRpcRequest,
  setupClientsForTesting,
  testApproveSession,
  TEST_ETHEREUM_ACCOUNTS,
} from "./shared";
import { formatJsonRpcError, formatJsonRpcResult } from "@json-rpc-tools/utils";

describe("Request", () => {
  it("A requests method and B responds result", async () => {
    const { setup, clients } = await setupClientsForTesting();
    const topic = await testApproveSession(setup, clients);
    const request = { method: "eth_accounts" };
    const response = formatJsonRpcResult(1, TEST_ETHEREUM_ACCOUNTS);
    await testJsonRpcRequest(setup, clients, topic, request, response);
  });
  it("A requests method and B responds error", async () => {
    const { setup, clients } = await setupClientsForTesting();
    const topic = await testApproveSession(setup, clients);
    const request = { method: "eth_accounts" };
    const response = formatJsonRpcError(1, "Something went wrong");
    await testJsonRpcRequest(setup, clients, topic, request, response);
  });
  // FIXME: "Timeout of 2000ms exceeded. For async tests and hooks, ensure "done()" is called;"
  // it("A requests unauthorized method and error is thrown", async () => {
  //   const { setup, clients } = await setupClientsForTesting();
  //   const topic = await testApproveSession(setup, clients);
  //   const request = { method: "cosmos_sign" };
  //   const chainId = setup.a.permissions.blockchain.chainIds[0];
  //   const promise = clients.a.request({ topic, chainId, request });
  //   // TODO: chai-as-promised assertions are not typed hence need to be ignored
  //   // @ts-ignore
  //   await expect(promise).to.eventually.be.rejectedWith(
  //     `Unauthorized JSON-RPC Method Requested: ${request.method}`,
  //   );
  // });
});
