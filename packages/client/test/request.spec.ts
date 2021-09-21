import "mocha";
import sinon from "sinon";
import { fromMiliseconds, generateRandomBytes32 } from "@walletconnect/utils";
import { formatJsonRpcError, formatJsonRpcResult } from "@walletconnect/jsonrpc-utils";

import {
  expect,
  testJsonRpcRequest,
  setupClientsForTesting,
  testApproveSession,
  TEST_ETHEREUM_ACCOUNTS,
  TEST_ETHEREUM_REQUEST,
  TEST_RANDOM_REQUEST,
  TEST_TIMEOUT_DURATION,
} from "./shared";

describe("Request", function() {
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
    const promise = clients.a.request({ topic, chainId, request, timeout: TEST_TIMEOUT_DURATION });
    await expect(promise).to.eventually.be.rejectedWith(
      `No matching session settled with topic: ${topic}`,
    );
  });
  it("A requests unauthorized method and error is thrown", async () => {
    const { setup, clients } = await setupClientsForTesting();
    const topic = await testApproveSession(setup, clients);
    const request = TEST_RANDOM_REQUEST;
    const chainId = setup.a.permissions.blockchain.chains[0];
    const promise = clients.a.request({ topic, chainId, request, timeout: TEST_TIMEOUT_DURATION });
    await expect(promise).to.eventually.be.rejectedWith(
      `Unauthorized JSON-RPC Method Requested: ${request.method}`,
    );
  });
});

describe("Request (with timeout)", function() {
  this.timeout(TEST_TIMEOUT_DURATION);
  let clock: sinon.SinonFakeTimers;
  beforeEach(function() {
    clock = sinon.useFakeTimers(Date.now());
  });
  afterEach(function() {
    clock.restore();
  });
  it("A requests method and B fails to return response in time", async () => {
    const { setup, clients } = await setupClientsForTesting();
    const topic = await testApproveSession(setup, clients);
    const request = TEST_ETHEREUM_REQUEST;
    const chainId = setup.a.permissions.blockchain.chains[0];
    clients.a
      .request({ topic, chainId, request, timeout: TEST_TIMEOUT_DURATION })
      .then(() => {
        throw new Error("Should not receive result");
      })
      .catch(e => {
        expect(e.message).to.equal(
          `JSON-RPC Request timeout after ${fromMiliseconds(TEST_TIMEOUT_DURATION)} seconds: ${
            request.method
          }`,
        );
      });
    clock.tick(TEST_TIMEOUT_DURATION);
  });
});
