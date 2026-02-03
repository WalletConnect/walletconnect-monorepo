/* eslint-disable no-console */

import { expect, describe, it, afterEach } from "vitest";
import { Core } from "@walletconnect/core";
import { formatJsonRpcResult } from "@walletconnect/jsonrpc-utils";
import { generateRandomBytes32 } from "@walletconnect/utils";
import { SignClient } from "@walletconnect/sign-client";

import { POSClient, POSClientTypes } from "../src/index.js";
import { TEST_METADATA } from "./shared/values.js";
import { TEST_CORE_OPTIONS } from "./shared/index.js";

const generateDatabaseName = () => {
  return `./test/tmp/test_${generateRandomBytes32()}.db`;
};

describe("Sign Integration", () => {
  const projectId = TEST_CORE_OPTIONS.projectId;
  const deviceId = "test device id";
  const merchantName = "test merchant name";
  const url = "example.com";
  const description = "test description";
  const logoIcon = "https://example.com/logo.png";

  afterEach((meta) => {
    console.log(
      meta.task.name,
      meta.task.result?.state,
      meta.task.result?.state === "pass" ? "✅" : "❌",
    );
  });

  it("should reuse existing session to send multiple payments", async () => {
    const databaseName = generateDatabaseName();
    const pos = await POSClient.init({
      projectId,
      deviceId,
      metadata: {
        merchantName,
        url,
        description,
        logoIcon,
      },
      loggerOptions: {
        posLevel: "error",
      },
      storageOptions: {
        databaseName,
      },
    });
    const networks: Record<string, POSClientTypes.Network> = {
      ethereum: { name: "Ethereum", chainId: "eip155:1" },
      arbitrum: { name: "Arbitrum", chainId: "eip155:42161" },
      avalanche: { name: "Avalanche", chainId: "eip155:43114" },
    };
    const tokens: POSClientTypes.Token[] = [
      {
        network: networks.ethereum,
        symbol: "ETH",
        standard: "ERC20",
        address: "0x13A2Ff792037AA2cd77fE1f4B522921ac59a9C52",
      },
      {
        network: networks.arbitrum,
        symbol: "ARB",
        standard: "ERC20",
        address: "0x13A2Ff792037AA2cd77fE1f4B522921ac59a9C52",
      },
      {
        network: networks.avalanche,
        symbol: "AVAX",
        standard: "ERC20",
        address: "0x13A2Ff792037AA2cd77fE1f4B522921ac59a9C52",
      },
    ];
    await pos.setTokens({ tokens });

    const wallet = await SignClient.init({
      core: new Core(TEST_CORE_OPTIONS),
      name: "wallet",
      metadata: TEST_METADATA,
    });

    const tokenChainId = "eip155:8453";

    const paymentIntents: POSClientTypes.PaymentIntent[] = [
      {
        token: {
          network: { name: "Ethereum", chainId: tokenChainId },
          symbol: "USDC",
          standard: "ERC20",
          address: `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`,
        },
        amount: "1",
        recipient: `${tokenChainId}:0x13A2Ff792037AA2cd77fE1f4B522921ac59a9C52`,
      },
    ];

    expect(pos.session).to.not.exist;

    let numConnected = 0;
    let numQrReady = 0;
    let numSessionProposal = 0;
    let numSessionRequest = 0;
    let numPaymentSuccessful = 0;

    const onSessionRequest = async (sessionRequest) => {
      numSessionRequest++;
      console.log("session request received", numSessionRequest);
      await wallet.respond({
        topic: sessionRequest.topic,
        response: formatJsonRpcResult(
          sessionRequest.id,
          "0xff16b7197277088039a45f9e23ccbb32077ebeec1e56e49b24b2f3731e1bd452",
        ),
      });
    };

    const onSessionProposal = async (sessionProposal) => {
      numSessionProposal++;
      console.log("session proposal", numSessionProposal);
      await wallet.approve({
        id: sessionProposal.id,
        namespaces: {
          eip155: {
            ...sessionProposal.params.optionalNamespaces.eip155,
            accounts: [`${tokenChainId}:0x13A2Ff792037AA2cd77fE1f4B522921ac59a9C52`],
          },
        },
      });
    };

    wallet.events.on("session_request", onSessionRequest);
    wallet.events.on("session_proposal", onSessionProposal);

    // #given - first payment flow with proper event waiting
    const firstPaymentSuccessful = new Promise<void>((resolve) => {
      pos.once("payment_successful", () => {
        numPaymentSuccessful++;
        console.log("first payment_successful");
        resolve();
      });
    });

    pos.once("connected", () => {
      numConnected++;
      console.log("connected");
    });

    pos.once("qr_ready", async ({ uri }) => {
      numQrReady++;
      console.log("qr_ready");
      await wallet.pair({ uri });
    });

    // #when - trigger first payment
    await pos.createPaymentIntent({ paymentIntents, manualControl: true });
    console.log("created payment intent 1");
    await pos.sendPaymentsToWallet();

    // #then - wait for first payment to complete
    await firstPaymentSuccessful;
    console.log("first payment completed");

    // simulate restart by closing transport
    await pos.engine.signClient.core.relayer.transportClose();
    console.log("transport closed");

    // allow relay to stabilize after transport close
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // #given - restart POS client with same database to reuse session
    const posAfterRestart = await POSClient.init({
      projectId,
      deviceId,
      metadata: {
        merchantName,
        url,
        description,
        logoIcon,
      },
      storageOptions: {
        databaseName,
      },
    });

    await posAfterRestart.setTokens({ tokens });

    expect(posAfterRestart.session).to.exist;
    const persistedSessionTopic = posAfterRestart.session?.topic;
    expect(persistedSessionTopic).to.exist;

    console.log(
      "relayer connected after restart:",
      posAfterRestart.engine.signClient.core.relayer.connected,
    );

    // #given - second payment flow with proper event waiting
    const secondPaymentSuccessful = new Promise<void>((resolve) => {
      posAfterRestart.once("payment_successful", () => {
        numPaymentSuccessful++;
        console.log("second payment_successful");
        resolve();
      });
    });

    // #when - trigger second payment using persisted session
    await posAfterRestart.createPaymentIntent({
      paymentIntents,
      manualControl: true,
      sessionTopic: persistedSessionTopic,
    });
    await posAfterRestart.sendPaymentsToWallet();

    // #then - wait for second payment to complete
    await secondPaymentSuccessful;
    console.log("second payment completed");

    expect(numSessionProposal).to.equal(1);
    expect(numConnected).to.equal(1);
    expect(numQrReady).to.equal(1);
    expect(numSessionRequest).to.equal(2);
    expect(numPaymentSuccessful).to.equal(2);

    // cleanup
    wallet.events.off("session_request", onSessionRequest);
    wallet.events.off("session_proposal", onSessionProposal);

    await posAfterRestart.disconnect();
    expect(posAfterRestart.session).to.not.exist;
  }, 90_000);
});
