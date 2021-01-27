import "mocha";
import sinon from "sinon";
import { generateRandomBytes32 } from "@walletconnect/utils";
import { formatJsonRpcError, formatJsonRpcResult } from "@json-rpc-tools/utils";

import {
  expect,
  testJsonRpcRequest,
  setupClientsForTesting,
  testApproveSession,
  TEST_ETHEREUM_ACCOUNTS,
  TEST_ETHEREUM_REQUEST,
  TEST_RANDOM_REQUEST,
} from "./shared";

describe("Request", function() {
  this.timeout(30_000);
  let clock: sinon.SinonFakeTimers;
  beforeEach(function() {
    clock = sinon.useFakeTimers();
  });
  afterEach(function() {
    clock.restore();
  });
  it("A requests method and B responds result", async () => {
    const { setup, clients } = await setupClientsForTesting();
    const topic = await testApproveSession(setup, clients);
    const request = TEST_ETHEREUM_REQUEST;
    const response = formatJsonRpcResult(1, TEST_ETHEREUM_ACCOUNTS);
    await testJsonRpcRequest(setup, clients, topic, request, response);
  });
  it("A requests method and B responds error", async () => {
    const { setup, clients } = await setupClientsForTesting();
    const topic = await testApproveSession(setup, clients);
    const request = TEST_ETHEREUM_REQUEST;
    const response = formatJsonRpcError(1, "Something went wrong");
    await testJsonRpcRequest(setup, clients, topic, request, response);
  });
  it("A requests with invalid topic and error is thrown", async () => {
    const { setup, clients } = await setupClientsForTesting();
    const topic = generateRandomBytes32();
    const request = TEST_ETHEREUM_REQUEST;
    const chainId = setup.a.permissions.blockchain.chains[0];
    const promise = clients.a.request({ topic, chainId, request });
    await expect(promise).to.eventually.be.rejectedWith(
      `No matching session settled with topic: ${topic}`,
    );
  });
  it("A requests unauthorized method and error is thrown", async () => {
    const { setup, clients } = await setupClientsForTesting();
    const topic = await testApproveSession(setup, clients);
    const request = TEST_RANDOM_REQUEST;
    const chainId = setup.a.permissions.blockchain.chains[0];
    const promise = clients.a.request({ topic, chainId, request });
    await expect(promise).to.eventually.be.rejectedWith(
      `Unauthorized JSON-RPC Method Requested: ${request.method}`,
    );
  });
  it("A requests method and B fails to return response in time (30 secs)", async () => {
    const { setup, clients } = await setupClientsForTesting();
    const topic = await testApproveSession(setup, clients);
    const request = TEST_ETHEREUM_REQUEST;
    const chainId = setup.a.permissions.blockchain.chains[0];
    const promise = clients.a.request({ topic, chainId, request });
    clock.tick(30_000);
    await expect(promise).to.eventually.be.rejectedWith(
      `JSON-RPC Request timeout after 30s: ${request.method}`,
    );
  });
});
