/* eslint-disable no-console */

import { expect, describe, it, beforeAll, afterEach } from "vitest";
import { Core } from "@walletconnect/core";
import { formatJsonRpcResult } from "@walletconnect/jsonrpc-utils";
import { generateRandomBytes32, parseUri } from "@walletconnect/utils";
import { SignClient } from "@walletconnect/sign-client";
import { ISignClient } from "@walletconnect/types";

import { POSClient, IPOSClient, POSClientTypes, RPC_ERROR_CODES } from "../src/index.js";
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
    let numPaymentSuccessful = 0;
    let numPaymentRequested = 0;
    let numPaymentBroadcasted = 0;
    let numConnected = 0;
    let numQrReady = 0;
    let numSessionRequest = 0;
    let numSessionProposal = 0;
    pos.on("payment_successful", () => {
      numPaymentSuccessful++;
    });
    pos.on("payment_requested", () => {
      numPaymentRequested++;
    });
    pos.on("payment_broadcasted", (result) => {
      numPaymentBroadcasted++;
    });
    pos.on("connected", () => {
      numConnected++;
    });
    pos.on("qr_ready", async ({ uri }) => {
      numQrReady++;
      await wallet.pair({ uri });
    });
    const onSessionRequest = async (sessionRequest) => {
      numSessionRequest++;
      console.log("session request", numSessionRequest);
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
    await pos.createPaymentIntent({ paymentIntents, manualControl: true });
    console.log("created payment intent 1");
    await pos.sendPaymentsToWallet();
    await new Promise((resolve) => setTimeout(resolve, 5000));
    await pos.engine.signClient.core.relayer.transportClose();

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

    posAfterRestart.on("payment_successful", () => {
      numPaymentSuccessful++;
    });
    posAfterRestart.on("payment_requested", () => {
      numPaymentRequested++;
    });
    posAfterRestart.on("payment_broadcasted", (result) => {
      numPaymentBroadcasted++;
    });
    posAfterRestart.on("connected", () => {
      numConnected++;
    });
    posAfterRestart.on("qr_ready", async ({ uri }) => {
      numQrReady++;
      await wallet.pair({ uri });
    });

    await posAfterRestart.setTokens({ tokens });

    expect(posAfterRestart.session).to.exist;
    await posAfterRestart.createPaymentIntent({
      paymentIntents,
      manualControl: true,
      sessionTopic: pos.session?.topic,
    });
    await posAfterRestart.sendPaymentsToWallet();
    await new Promise((resolve) => setTimeout(resolve, 5000));

    expect(numSessionRequest).to.equal(2);
    expect(numPaymentSuccessful).to.equal(2);
    expect(numPaymentRequested).to.equal(2);
    expect(numPaymentBroadcasted).to.equal(2);
    expect(numConnected).to.equal(1);
    expect(numQrReady).to.equal(1);

    wallet.events.off("session_request", onSessionRequest);
    wallet.events.off("session_proposal", onSessionProposal);

    await pos.disconnect();
    expect(pos.session).to.not.exist;
  });
});
