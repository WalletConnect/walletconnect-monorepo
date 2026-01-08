/* eslint-disable no-console */

import { expect, describe, it, beforeAll, afterEach } from "vitest";
import { Core } from "@walletconnect/core";
import { formatJsonRpcResult } from "@walletconnect/jsonrpc-utils";
import { getSdkError, parseUri } from "@walletconnect/utils";
import { SignClient } from "@walletconnect/sign-client";
import { ISignClient, SessionTypes } from "@walletconnect/types";

import { POSClient, IPOSClient, POSClientTypes, RPC_ERROR_CODES } from "../src/index.js";
import { TEST_METADATA } from "./shared/values.js";
import { TEST_CORE_OPTIONS } from "./shared/index.js";

const connectSession = async ({
  pos,
  wallet,
  address,
}: {
  pos: IPOSClient;
  wallet: ISignClient;
  address: string;
}) => {
  await Promise.all([
    new Promise<void>((resolve) => {
      pos.once("qr_ready", async ({ uri }) => {
        await wallet.pair({ uri });
        resolve();
      });
    }),
    new Promise<void>((resolve) => {
      wallet.events.once("session_proposal", async (sessionProposal) => {
        const optionalNamespaces = sessionProposal.params.optionalNamespaces;
        await wallet.approve({
          id: sessionProposal.id,
          namespaces: Object.entries(optionalNamespaces).reduce((acc, [key, value]) => {
            acc[key] = {
              ...value,
              accounts: value.chains?.map((chain) => `${chain}:${address}`),
            };
            return acc;
          }, {}),
        });
        resolve();
      });
    }),
  ]);
};

const getValidTokens = () => {
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
  return tokens;
};

const getPaymentIntents = () => {
  const paymentIntents: POSClientTypes.PaymentIntent[] = [
    {
      token: {
        network: { name: "Ethereum", chainId: "eip155:8453" },
        symbol: "USDC",
        standard: "ERC20",
        address: `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`,
      },
      amount: "1",
      recipient: `eip155:8453:0x13A2Ff792037AA2cd77fE1f4B522921ac59a9C52`,
    },
  ];
  return paymentIntents;
};
describe("Sign Integration", () => {
  let wallet: ISignClient;
  let pos: IPOSClient;

  const projectId = TEST_CORE_OPTIONS.projectId;
  const deviceId = "test device id";
  const merchantName = "test merchant name";
  const url = "example.com";
  const description = "test description";
  const logoIcon = "https://example.com/logo.png";

  beforeAll(async () => {
    pos = await POSClient.init({
      projectId,
      deviceId,
      metadata: {
        merchantName,
        url,
        description,
        logoIcon,
      },
      loggerOptions: {
        posLevel: "debug",
      },
    });
    wallet = await SignClient.init({
      core: new Core(TEST_CORE_OPTIONS),
      name: "wallet",
      metadata: TEST_METADATA,
    });
  });

  afterEach(async (meta) => {
    console.log(
      meta.task.name,
      meta.task.result?.state,
      meta.task.result?.state === "pass" ? "✅" : "❌",
    );
    for (const session of pos.sessions) {
      await pos.disconnect({ sessionTopic: session.topic });
    }
  });

  it("should initialize a POS client", async () => {
    expect(pos).to.exist;
    expect(pos.engine.signClient).to.exist;
    expect(pos.engine.signClient.core).to.exist;
    expect(pos.engine.signClient.core.projectId).to.be.equal(projectId);
    expect(pos.metadata.merchantName).to.be.equal(merchantName);
    expect(pos.metadata.url).to.be.equal(url);
    expect(pos.metadata.description).to.be.equal(description);
    expect(pos.metadata.logoIcon).to.be.equal(logoIcon);
  });

  it("should set tokens", async () => {
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

    expect(pos.engine.tokens).to.exist;
    expect(pos.engine.tokens.length).to.be.equal(tokens.length);
    expect(pos.engine.tokens).to.deep.equal(tokens);
    expect(pos.engine.tokens[0]).to.deep.equal(tokens[0]);
    expect(pos.engine.tokens[1]).to.deep.equal(tokens[1]);
    expect(pos.engine.tokens[2]).to.deep.equal(tokens[2]);
  });

  it("should reject tokens with invalid chainId", async () => {
    const networks: Record<string, POSClientTypes.Network> = {
      ethereum: { name: "Ethereum", chainId: "eip155" },
      arbitrum: { name: "Arbitrum", chainId: "42161" },
      avalanche: { name: "Avalanche", chainId: "43114" },
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
    await expect(pos.setTokens({ tokens })).rejects.toThrow();
  });

  it("should reject tokens with unsupported namespace", async () => {
    const network: POSClientTypes.Network = { name: "something", chainId: "something" };
    const token: POSClientTypes.Token = {
      network,
      symbol: "SOL",
      standard: "SOL",
      address: "0x13A2Ff792037AA2cd77fE1f4B522921ac59a9C52",
    };
    await expect(pos.setTokens({ tokens: [token] })).rejects.toThrow();
  });

  it("should create a payment intent", async () => {
    const network: POSClientTypes.Network = { name: "Ethereum", chainId: "eip155:1" };
    const token: POSClientTypes.Token = {
      network,
      symbol: "ETH",
      standard: "ERC20",
      address: "0x13A2Ff792037AA2cd77fE1f4B522921ac59a9C52",
    };

    const paymentIntents: POSClientTypes.PaymentIntent[] = [
      {
        token,
        amount: "1",
        recipient: "0x13A2Ff792037AA2cd77fE1f4B522921ac59a9C52",
      },
    ];

    await Promise.all([
      new Promise<void>((resolve) => {
        pos.once("qr_ready", ({ uri }) => {
          // validate the uri
          parseUri(uri);
          resolve();
        });
      }),
      connectSession({
        pos,
        wallet,
        address: "0x13A2Ff792037AA2cd77fE1f4B522921ac59a9C52",
      }),
      pos.createPaymentIntent({ paymentIntents }),
    ]);
    await new Promise((resolve) => setTimeout(resolve, 1000));
  });

  it("should reject payment intents with invalid amount", async () => {
    const network: POSClientTypes.Network = { name: "Ethereum", chainId: "eip155" };
    const token: POSClientTypes.Token = {
      network,
      symbol: "ETH",
      standard: "ERC20",
      address: "0x13A2Ff792037AA2cd77fE1f4B522921ac59a9C52",
    };

    const paymentIntents: POSClientTypes.PaymentIntent[] = [
      {
        token,
        amount: "",
        recipient: "0x13A2Ff792037AA2cd77fE1f4B522921ac59a9C52",
      },
    ];
    await expect(pos.createPaymentIntent({ paymentIntents })).rejects.toThrow();
  });

  it("should establish a session, prepare transaction, send to wallet, receive response and await confirmation", async () => {
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

    await Promise.all([
      new Promise<void>((resolve) => {
        pos.once("payment_successful", () => {
          console.log("payment_successful");
          resolve();
        });
      }),
      new Promise<void>((resolve) => {
        pos.once("payment_requested", () => {
          console.log("payment_requested");
          resolve();
        });
      }),
      new Promise<void>((resolve) => {
        pos.once("payment_broadcasted", (result) => {
          console.log("payment_broadcasted", JSON.stringify(result, null, 2));
          resolve();
        });
      }),
      new Promise<void>((resolve) => {
        wallet.events.once("session_request", async (sessionRequest) => {
          console.log("session_request", JSON.stringify(sessionRequest, null, 2));
          await wallet.respond({
            topic: sessionRequest.topic,
            response: formatJsonRpcResult(
              sessionRequest.id,
              "0xff16b7197277088039a45f9e23ccbb32077ebeec1e56e49b24b2f3731e1bd452",
            ),
          });
          resolve();
        });
      }),
      new Promise<void>((resolve) => {
        wallet.events.once("session_proposal", async (sessionProposal) => {
          console.log("session_proposal", JSON.stringify(sessionProposal, null, 2));
          await wallet.approve({
            id: sessionProposal.id,
            namespaces: {
              eip155: {
                ...sessionProposal.params.optionalNamespaces.eip155,
                accounts: [`${tokenChainId}:0x13A2Ff792037AA2cd77fE1f4B522921ac59a9C52`],
              },
            },
          });
          resolve();
        });
      }),
      new Promise<void>((resolve) => {
        pos.once("connected", () => {
          console.log("connected");
          resolve();
        });
      }),
      new Promise<void>((resolve) => {
        pos.once("qr_ready", async ({ uri }) => {
          console.log("qr_ready", uri);
          await wallet.pair({ uri });
          resolve();
        });
      }),
      pos.createPaymentIntent({ paymentIntents }),
    ]);
  });

  it("should accept multiple payment intents, establish a session, prepare transactions, send all requests to wallet, receive responses and await confirmations", async () => {
    const evmChainId = "eip155:8453";
    const solanaChainId = "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp";

    const evmToken: POSClientTypes.Token = {
      network: { name: "Ethereum", chainId: evmChainId },
      symbol: "USDC",
      standard: "ERC20",
      address: `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`,
    };
    const solanaToken: POSClientTypes.Token = {
      network: { name: "Solana", chainId: solanaChainId },
      symbol: "USDC",
      standard: "token",
      address: `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v`,
    };

    pos.setTokens({ tokens: [evmToken, solanaToken] });

    const paymentIntents: POSClientTypes.PaymentIntent[] = [
      {
        token: evmToken,
        amount: "1",
        recipient: `${evmChainId}:0x13A2Ff792037AA2cd77fE1f4B522921ac59a9C52`,
      },
      {
        token: solanaToken,
        amount: "1",
        recipient: `${solanaChainId}:4r33xEKAD2cNMrC9NyJy8nb4XmruUKebZ6LZZm65PVUZ`,
      },
    ];
    let numPaymentSuccessful = 0;
    let numPaymentRequested = 0;
    let numPaymentBroadcasted = 0;
    await Promise.all([
      new Promise<void>((resolve) => {
        pos.on("payment_successful", ({ transaction, result }) => {
          expect(transaction).to.exist;
          expect(result).to.exist;
          console.log("payment_successful");
          numPaymentSuccessful++;
          if (numPaymentSuccessful === paymentIntents.length) {
            resolve();
          }
        });
      }),
      new Promise<void>((resolve) => {
        pos.on("payment_requested", ({ paymentIntent, transaction }) => {
          expect(paymentIntent).to.exist;
          expect(transaction).to.exist;
          console.log("payment_requested");
          numPaymentRequested++;
          if (numPaymentRequested === paymentIntents.length) {
            resolve();
          }
        });
      }),
      new Promise<void>((resolve) => {
        pos.on("payment_broadcasted", ({ paymentIntent, transaction, result }) => {
          expect(paymentIntent).to.exist;
          expect(transaction).to.exist;
          expect(result).to.exist;
          console.log("payment_broadcasted", JSON.stringify(result, null, 2));
          numPaymentBroadcasted++;
          if (numPaymentBroadcasted === paymentIntents.length) {
            resolve();
          }
        });
      }),
      new Promise<void>((resolve) => {
        wallet.events.on("session_request", async (sessionRequest) => {
          console.log("session_request", JSON.stringify(sessionRequest, null, 2));
          if (sessionRequest.params.chainId === evmChainId) {
            await wallet.respond({
              topic: sessionRequest.topic,
              response: formatJsonRpcResult(
                sessionRequest.id,
                "0xff16b7197277088039a45f9e23ccbb32077ebeec1e56e49b24b2f3731e1bd452",
              ),
            });
          } else if (sessionRequest.params.chainId === solanaChainId) {
            await wallet.respond({
              topic: sessionRequest.topic,
              response: formatJsonRpcResult(sessionRequest.id, {
                signature:
                  "2P1voPUU3txxMXpdFqyX4ggEQcthsvimmnoRNJV2tdKM9iiE2mUjMzFjpX3SJKEJaFG5QXKGABG2AebRihUVYx6z",
              }),
            });
          }
          resolve();
        });
      }),
      new Promise<void>((resolve) => {
        wallet.events.once("session_proposal", async (sessionProposal) => {
          console.log("session_proposal", JSON.stringify(sessionProposal, null, 2));
          await wallet.approve({
            id: sessionProposal.id,
            namespaces: {
              eip155: {
                ...sessionProposal.params.optionalNamespaces.eip155,
                accounts: [`${evmChainId}:0x13A2Ff792037AA2cd77fE1f4B522921ac59a9C52`],
              },
              solana: {
                ...sessionProposal.params.optionalNamespaces.solana,
                accounts: [`${solanaChainId}:4r33xEKAD2cNMrC9NyJy8nb4XmruUKebZ6LZZm65PVUZ`],
              },
            },
          });
          resolve();
        });
      }),
      new Promise<void>((resolve) => {
        pos.once("connected", ({ session }) => {
          expect(session).to.exist;
          const walletSession = wallet.session.get(session.topic);
          expect(walletSession).to.exist;
          expect(walletSession.topic).to.be.equal(session.topic);
          expect(walletSession.pairingTopic).to.be.equal(session.pairingTopic);
          console.log("connected");
          resolve();
        });
      }),
      new Promise<void>((resolve) => {
        pos.once("qr_ready", async ({ uri }) => {
          console.log("qr_ready", uri);
          await wallet.pair({ uri });
          resolve();
        });
      }),
      pos.createPaymentIntent({ paymentIntents }),
    ]);
    expect(paymentIntents.length).to.be.greaterThan(0);
    expect(numPaymentSuccessful).to.be.equal(paymentIntents.length);
    expect(numPaymentRequested).to.be.equal(paymentIntents.length);
    expect(numPaymentBroadcasted).to.be.equal(paymentIntents.length);
  });

  it("should set tokens", async () => {
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
    const paymentIntents: POSClientTypes.PaymentIntent[] = [
      {
        token: tokens[0],
        amount: "1",
        recipient: "0x13A2Ff792037AA2cd77fE1f4B522921ac59a9C52",
      },
    ];
    await pos.setTokens({ tokens });

    await Promise.all([
      new Promise<void>((resolve) => {
        pos.on("payment_failed", (result) => {
          expect(result.error?.code).to.be.equal(-18902);
          resolve();
        });
      }),
      connectSession({
        pos,
        wallet,
        address: `0x13A2Ff792037AA2cd77fE1f4B522921ac59a9C52`,
      }),
      pos.createPaymentIntent({ paymentIntents }),
    ]);
    await new Promise((resolve) => setTimeout(resolve, 2000));
  });

  it("should establish a session, prepare transaction, send to wallet, receive response and await confirmation - manual control", async () => {
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

    await Promise.all([
      new Promise<void>((resolve) => {
        pos.once("payment_successful", () => {
          console.log("payment_successful");
          resolve();
        });
      }),
      new Promise<void>((resolve) => {
        pos.once("payment_requested", () => {
          console.log("payment_requested");
          resolve();
        });
      }),
      new Promise<void>((resolve) => {
        pos.once("payment_broadcasted", (result) => {
          console.log("payment_broadcasted", JSON.stringify(result, null, 2));
          resolve();
        });
      }),
      new Promise<void>((resolve) => {
        wallet.events.once("session_request", async (sessionRequest) => {
          console.log("session_request", JSON.stringify(sessionRequest, null, 2));
          await wallet.respond({
            topic: sessionRequest.topic,
            response: formatJsonRpcResult(
              sessionRequest.id,
              "0xff16b7197277088039a45f9e23ccbb32077ebeec1e56e49b24b2f3731e1bd452",
            ),
          });
          resolve();
        });
      }),
      new Promise<void>((resolve) => {
        wallet.events.once("session_proposal", async (sessionProposal) => {
          console.log("session_proposal", JSON.stringify(sessionProposal, null, 2));
          await wallet.approve({
            id: sessionProposal.id,
            namespaces: {
              eip155: {
                ...sessionProposal.params.optionalNamespaces.eip155,
                accounts: [`${tokenChainId}:0x13A2Ff792037AA2cd77fE1f4B522921ac59a9C52`],
              },
            },
          });
          resolve();
        });
      }),
      new Promise<void>((resolve) => {
        pos.once("connected", async ({ session }) => {
          console.log("connected");
          expect(session).to.exist;
          await pos.sendPaymentsToWallet();
          resolve();
        });
      }),
      new Promise<void>((resolve) => {
        pos.once("qr_ready", async ({ uri }) => {
          console.log("qr_ready", uri);
          await wallet.pair({ uri });
          resolve();
        });
      }),
      pos.createPaymentIntent({ paymentIntents, manualControl: true }),
    ]);
  });
  it("should create payment intent with manual control", async () => {
    const paymentIntents: POSClientTypes.PaymentIntent[] = [
      {
        token: {
          network: { name: "Ethereum", chainId: "eip155:8453" },
          symbol: "USDC",
          standard: "ERC20",
          address: `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`,
        },
        amount: "1",
        recipient: `eip155:8453:0x13A2Ff792037AA2cd77fE1f4B522921ac59a9C52`,
      },
    ];

    let connectedSession: SessionTypes.Struct | undefined;

    pos.once("connected", ({ session }) => {
      connectedSession = session;
    });
    await Promise.all([
      connectSession({
        pos,
        wallet,
        address: `0x13A2Ff792037AA2cd77fE1f4B522921ac59a9C52`,
      }),
      pos.createPaymentIntent({ paymentIntents, manualControl: true }),
    ]);
    // @ts-expect-error - private property
    expect(pos.engine.manualControl[connectedSession.topic]).to.be.true;
    pos.disconnect();
  });

  it("should reject multiple calls to send payments to wallet", async () => {
    // @ts-expect-error - testing private property
    pos.engine.paymentsSendingInProgress[pos.session?.topic] = true;
    await expect(pos.sendPaymentsToWallet()).rejects.toThrow();
    // @ts-expect-error - testing private property
    pos.engine.paymentsSendingInProgress[pos.session?.topic] = false;
  });

  it("should connect multiple sessions and send payments to wallet", async () => {
    const tokens = getValidTokens();
    await pos.setTokens({ tokens });
    const paymentIntents = getPaymentIntents();

    const connectedSessions: SessionTypes.Struct[] = [];
    pos.on("connected", ({ session }) => {
      console.log("connected", session.topic);
      connectedSessions.push(session);
    });
    // connect first session
    await Promise.all([
      connectSession({
        pos,
        wallet,
        address: `0x13A2Ff792037AA2cd77fE1f4B522921ac59a9C52`,
      }),
      pos.createPaymentIntent({ paymentIntents, manualControl: true }),
    ]);
    // await new Promise((resolve) => setTimeout(resolve, 1000));
    // connect second session
    await Promise.all([
      connectSession({
        pos,
        wallet,
        address: `0x13A2Ff792037AA2cd77fE1f4B522921ac59a9C52`,
      }),
      pos.createPaymentIntent({ paymentIntents, manualControl: true }),
    ]);
    // await new Promise((resolve) => setTimeout(resolve, 5000));

    // not exact match because of the other tests that connect a session
    expect(connectedSessions.length).to.be.greaterThanOrEqual(2);
    expect(
      pos.sessions.find((session) => session.topic === connectedSessions[0].topic)?.topic,
    ).to.be.equal(wallet.session.get(connectedSessions[0].topic)?.topic);
    expect(
      pos.sessions.find((session) => session.topic === connectedSessions[1].topic)?.topic,
    ).to.be.equal(wallet.session.get(connectedSessions[1].topic)?.topic);

    const sessionRequestsReceived: string[] = [];
    wallet.events.on("session_request", async (sessionRequest) => {
      console.log("session_request", JSON.stringify(sessionRequest, null, 2));
      sessionRequestsReceived.push(sessionRequest.topic);
      await wallet.respond({
        topic: sessionRequest.topic,
        response: formatJsonRpcResult(
          sessionRequest.id,
          "0xff16b7197277088039a45f9e23ccbb32077ebeec1e56e49b24b2f3731e1bd452",
        ),
      });
    });

    await pos.createPaymentIntent({
      paymentIntents,
      manualControl: true,
      sessionTopic: connectedSessions[0].topic,
    });
    await pos.sendPaymentsToWallet({ sessionTopic: connectedSessions[0].topic });
    await pos.createPaymentIntent({
      paymentIntents,
      manualControl: true,
      sessionTopic: connectedSessions[1].topic,
    });
    await pos.sendPaymentsToWallet({ sessionTopic: connectedSessions[1].topic });
    expect(sessionRequestsReceived.length).to.be.equal(2);
    expect(sessionRequestsReceived[0]).to.be.equal(connectedSessions[0].topic);
    expect(sessionRequestsReceived[1]).to.be.equal(connectedSessions[1].topic);
  });

  it("should establish a session via connect method", async () => {
    const tokens = getValidTokens();
    await pos.setTokens({ tokens });

    const testUserId = "test user id";
    pos.once("qr_ready", async ({ uri, userId }) => {
      expect(userId).to.be.equal(testUserId);

      wallet.events.once("session_proposal", async (sessionProposal) => {
        await wallet.approve({
          id: sessionProposal.id,
          namespaces: {
            eip155: {
              ...sessionProposal.params.optionalNamespaces.eip155,
              accounts: [`eip155:8453:0x13A2Ff792037AA2cd77fE1f4B522921ac59a9C52`],
            },
          },
        });
      });
      await wallet.pair({ uri });
    });
    let connectedSession: SessionTypes.Struct | undefined;
    pos.once("connected", ({ session, userId }) => {
      connectedSession = session;
      expect(session).to.exist;
      expect(session.topic).to.be.equal(wallet.session.get(session.topic)?.topic);
      expect(session.topic).to.be.equal(
        pos.sessions.find((posSession) => posSession.topic === session.topic)?.topic,
      );
      expect(userId).to.be.equal(testUserId);
    });
    const session = await pos.connect({ userId: testUserId });
    expect(connectedSession).to.exist;
    expect(connectedSession?.topic).to.be.equal(session.topic);
  });

  it("should reject connect call if wallet rejects session proposal", async () => {
    const tokens = getValidTokens();
    await pos.setTokens({ tokens });

    const testUserId = "test user id";
    pos.once("qr_ready", async ({ uri, userId }) => {
      expect(userId).to.be.equal(testUserId);

      wallet.events.once("session_proposal", async (sessionProposal) => {
        await wallet.reject({
          id: sessionProposal.id,
          reason: getSdkError("USER_REJECTED"),
        });
      });
      await wallet.pair({ uri });
    });

    await expect(pos.connect({ userId: testUserId })).rejects.toThrow();
  });

  it("should establish a session via connect method, prepare transaction, send to wallet, receive response and await confirmation", async () => {
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

    pos.setTokens({ tokens: getValidTokens() });
    const testUserId = "test user id" + Math.random();

    let connectEventReceived = false;
    pos.once("connected", ({ userId }) => {
      expect(userId).to.be.equal(testUserId);
      console.log("connected");
      connectEventReceived = true;
    });

    pos.once("qr_ready", async ({ uri, userId }) => {
      expect(userId).to.be.equal(testUserId);
      console.log("qr_ready", uri);
      await wallet.pair({ uri });
    });

    wallet.events.once("session_proposal", async (sessionProposal) => {
      console.log("session_proposal", JSON.stringify(sessionProposal, null, 2));
      await wallet.approve({
        id: sessionProposal.id,
        namespaces: {
          eip155: {
            ...sessionProposal.params.optionalNamespaces.eip155,
            accounts: [`${tokenChainId}:0x13A2Ff792037AA2cd77fE1f4B522921ac59a9C52`],
          },
        },
      });
    });

    const session = await pos.connect({ userId: testUserId });
    expect(connectEventReceived).to.be.true;
    expect(pos.session?.topic).to.be.equal(session.topic);

    await Promise.all([
      new Promise<void>((resolve) => {
        pos.once("payment_successful", ({ userId }) => {
          expect(userId).to.be.equal(testUserId);
          console.log("payment_successful");
          resolve();
        });
      }),
      new Promise<void>((resolve) => {
        pos.once("payment_requested", ({ userId }) => {
          expect(userId).to.be.equal(testUserId);
          console.log("payment_requested");
          resolve();
        });
      }),
      new Promise<void>((resolve) => {
        pos.once("payment_broadcasted", (result) => {
          expect(result.userId).to.be.equal(testUserId);
          console.log("payment_broadcasted", JSON.stringify(result, null, 2));
          resolve();
        });
      }),
      new Promise<void>((resolve) => {
        wallet.events.once("session_request", async (sessionRequest) => {
          console.log("session_request", JSON.stringify(sessionRequest, null, 2));
          await wallet.respond({
            topic: sessionRequest.topic,
            response: formatJsonRpcResult(
              sessionRequest.id,
              "0xff16b7197277088039a45f9e23ccbb32077ebeec1e56e49b24b2f3731e1bd452",
            ),
          });
          resolve();
        });
      }),
      pos.createPaymentIntent({ paymentIntents, sessionTopic: session.topic, userId: testUserId }),
    ]);
    await new Promise((resolve) => setTimeout(resolve, 2000));
    expect(pos.session).to.not.exist;
  });
});
