import { Core, RELAYER_EVENTS } from "@walletconnect/core";
import {
  JsonRpcPayload,
  formatJsonRpcResult,
  isJsonRpcRequest,
} from "@walletconnect/jsonrpc-utils";
import { SignClient } from "@walletconnect/sign-client";
import { CoreTypes, ICore, ISignClient, SessionTypes } from "@walletconnect/types";
import { getSdkError } from "@walletconnect/utils";
import { Wallet as CryptoWallet } from "@ethersproject/wallet";

import { expect, describe, it, beforeEach, vi, beforeAll, afterAll } from "vitest";
import { Web3Wallet, IWeb3Wallet } from "../src";
import {
  disconnect,
  TEST_CORE_OPTIONS,
  TEST_ETHEREUM_CHAIN,
  TEST_NAMESPACES,
  TEST_REQUIRED_NAMESPACES,
  TEST_UPDATED_NAMESPACES,
} from "./shared";

describe("Sign Integration", () => {
  let core: ICore;
  let wallet: IWeb3Wallet;
  let dapp: ISignClient;
  let uriString: string;
  let sessionApproval: () => Promise<any>;
  let session: SessionTypes.Struct;
  let cryptoWallet: CryptoWallet;

  beforeAll(() => {
    cryptoWallet = CryptoWallet.createRandom();
  });

  afterAll(async () => {
    await disconnect(core);
  });

  beforeEach(async () => {
    core = new Core(TEST_CORE_OPTIONS);
    dapp = await SignClient.init({ ...TEST_CORE_OPTIONS, name: "Dapp" });
    const { uri, approval } = await dapp.connect({
      requiredNamespaces: TEST_REQUIRED_NAMESPACES,
    });
    uriString = uri || "";
    sessionApproval = approval;
    wallet = await Web3Wallet.init({ core, name: "wallet", metadata: {} as any });
    expect(wallet).to.be.exist;
    expect(dapp).to.be.exist;
    expect(core).to.be.exist;
    expect(wallet.metadata.redirect).to.not.exist;
    expect(dapp.metadata.redirect).to.not.exist;
  });

  it("should approve session proposal", async () => {
    await Promise.all([
      new Promise((resolve) => {
        wallet.on("session_proposal", async (sessionProposal) => {
          const { id, params, verifyContext } = sessionProposal;
          expect(verifyContext.verified.validation).to.eq("UNKNOWN");
          expect(verifyContext.verified.isScam).to.eq(undefined);
          session = await wallet.approveSession({
            id,
            namespaces: TEST_NAMESPACES,
          });
          expect(params.requiredNamespaces).to.toMatchObject(TEST_REQUIRED_NAMESPACES);
          resolve(session);
        });
      }),
      new Promise(async (resolve) => {
        resolve(await sessionApproval());
      }),
      wallet.pair({ uri: uriString }),
    ]);
  });
  it("should reject session proposal", async () => {
    const rejectionError = getSdkError("USER_REJECTED");
    await Promise.all([
      new Promise<void>((resolve) => {
        wallet.on("session_proposal", async (sessionProposal) => {
          const { params } = sessionProposal;
          expect(params.requiredNamespaces).to.toMatchObject(TEST_REQUIRED_NAMESPACES);
          await wallet.rejectSession({
            id: params.id,
            reason: rejectionError,
          });
          resolve();
        });
      }),
      new Promise<void>(async (resolve) => {
        // catch the rejection and compare
        try {
          await sessionApproval();
        } catch (err) {
          expect(err).to.toMatchObject(rejectionError);
        }
        resolve();
      }),
      wallet.pair({ uri: uriString }),
    ]);
  });
  it("should update session", async () => {
    // first pair and approve session
    await Promise.all([
      new Promise((resolve) => {
        wallet.on("session_proposal", async (sessionProposal) => {
          const { id, params, verifyContext } = sessionProposal;
          expect(verifyContext.verified.validation).to.eq("UNKNOWN");
          session = await wallet.approveSession({
            id,
            namespaces: TEST_NAMESPACES,
          });
          expect(params.requiredNamespaces).to.toMatchObject(TEST_REQUIRED_NAMESPACES);
          resolve(session);
        });
      }),
      sessionApproval(),
      wallet.pair({ uri: uriString }),
    ]);

    expect(TEST_NAMESPACES).not.toMatchObject(TEST_UPDATED_NAMESPACES);
    // update the session
    await Promise.all([
      new Promise((resolve) => {
        dapp.events.on("session_update", (session) => {
          const { params } = session;
          expect(params.namespaces).to.toMatchObject(TEST_UPDATED_NAMESPACES);
          resolve(session);
        });
      }),
      wallet.updateSession({ topic: session.topic, namespaces: TEST_UPDATED_NAMESPACES }),
    ]);
  });
  it("should extend session", async () => {
    // first pair and approve session
    await Promise.all([
      new Promise((resolve) => {
        wallet.on("session_proposal", async (sessionProposal) => {
          const { id, params } = sessionProposal;
          session = await wallet.approveSession({
            id,
            namespaces: TEST_NAMESPACES,
          });
          expect(params.requiredNamespaces).to.toMatchObject(TEST_REQUIRED_NAMESPACES);
          resolve(session);
        });
      }),
      sessionApproval(),
      wallet.pair({ uri: uriString }),
    ]);

    const prevExpiry = session.expiry;
    const topic = session.topic;
    vi.useFakeTimers();
    // Fast-forward system time by 60 seconds after expiry was first set.
    vi.setSystemTime(Date.now() + 60_000);
    await wallet.extendSession({ topic });
    const updatedExpiry = wallet.engine.signClient.session.get(topic).expiry;
    expect(updatedExpiry).to.be.greaterThan(prevExpiry);
    vi.useRealTimers();
  });

  it("should respond to session request", async () => {
    // first pair and approve session
    await Promise.all([
      new Promise((resolve) => {
        wallet.on("session_proposal", async (sessionProposal) => {
          const { id, params } = sessionProposal;
          session = await wallet.approveSession({
            id,
            namespaces: {
              eip155: {
                ...TEST_NAMESPACES.eip155,
                accounts: [`${TEST_ETHEREUM_CHAIN}:${cryptoWallet.address}`],
              },
            },
          });
          expect(params.requiredNamespaces).to.toMatchObject(TEST_REQUIRED_NAMESPACES);
          resolve(session);
        });
      }),
      sessionApproval(),
      wallet.pair({ uri: uriString }),
    ]);

    await Promise.all([
      new Promise((resolve) => {
        wallet.on("session_request", async (sessionRequest) => {
          const { id, params, verifyContext } = sessionRequest;
          expect(verifyContext.verified.validation).to.eq("UNKNOWN");
          const signTransaction = params.request.params[0];
          const signature = await cryptoWallet.signTransaction(signTransaction);
          const response = await wallet.respondSessionRequest({
            topic: session.topic,
            response: formatJsonRpcResult(id, signature),
          });
          resolve(response);
        });
      }),
      new Promise<void>(async (resolve) => {
        const result = await dapp.request({
          topic: session.topic,
          request: {
            method: "eth_signTransaction",
            params: [
              {
                from: cryptoWallet.address,
                to: cryptoWallet.address,
                data: "0x",
                nonce: "0x01",
                gasPrice: "0x020a7ac094",
                gasLimit: "0x5208",
                value: "0x00",
              },
            ],
          },
          chainId: TEST_ETHEREUM_CHAIN,
        });
        expect(result).to.be.exist;
        expect(result).to.be.a("string");
        resolve();
      }),
    ]);
  });

  it("should disconnect from session", async () => {
    // first pair and approve session
    await Promise.all([
      new Promise((resolve) => {
        wallet.on("session_proposal", async (sessionProposal) => {
          const { id, params } = sessionProposal;
          session = await wallet.approveSession({
            id,
            namespaces: {
              eip155: {
                ...TEST_NAMESPACES.eip155,
                accounts: [`${TEST_ETHEREUM_CHAIN}:${cryptoWallet.address}`],
              },
            },
          });
          expect(params.requiredNamespaces).to.toMatchObject(TEST_REQUIRED_NAMESPACES);
          resolve(session);
        });
      }),
      sessionApproval(),
      wallet.pair({ uri: uriString }),
    ]);

    const reason = getSdkError("USER_DISCONNECTED");
    await Promise.all([
      new Promise<void>((resolve) => {
        dapp.events.on("session_delete", (sessionDelete) => {
          const { topic } = sessionDelete;
          expect(topic).to.be.eq(session.topic);
          resolve();
        });
      }),
      wallet.disconnectSession({ topic: session.topic, reason }),
    ]);
  });

  it("should receive session_disconnect", async () => {
    // first pair and approve session
    await Promise.all([
      new Promise((resolve) => {
        wallet.on("session_proposal", async (sessionProposal) => {
          const { id, params } = sessionProposal;
          session = await wallet.approveSession({
            id,
            namespaces: {
              eip155: {
                ...TEST_NAMESPACES.eip155,
                accounts: [`${TEST_ETHEREUM_CHAIN}:${cryptoWallet.address}`],
              },
            },
          });
          expect(params.requiredNamespaces).to.toMatchObject(TEST_REQUIRED_NAMESPACES);
          resolve(session);
        });
      }),
      sessionApproval(),
      wallet.pair({ uri: uriString }),
    ]);

    const reason = getSdkError("USER_DISCONNECTED");
    await Promise.all([
      new Promise<void>((resolve) => {
        wallet.on("session_delete", (sessionDelete) => {
          const { topic } = sessionDelete;
          expect(topic).to.be.eq(session.topic);
          resolve();
        });
      }),
      dapp.disconnect({ topic: session.topic, reason }),
    ]);
  });

  it("should emit session event", async () => {
    // first pair and approve session
    await Promise.all([
      new Promise((resolve) => {
        wallet.on("session_proposal", async (sessionProposal) => {
          const { id, params } = sessionProposal;
          session = await wallet.approveSession({
            id,
            namespaces: {
              eip155: {
                ...TEST_NAMESPACES.eip155,
                accounts: [`${TEST_ETHEREUM_CHAIN}:${cryptoWallet.address}`],
              },
            },
          });
          expect(params.requiredNamespaces).to.toMatchObject(TEST_REQUIRED_NAMESPACES);
          resolve(session);
        });
      }),
      sessionApproval(),
      wallet.pair({ uri: uriString }),
    ]);
    const sessionEvent = {
      topic: session.topic,
      event: {
        name: "chainChanged",
      },
      chainId: TEST_REQUIRED_NAMESPACES.eip155.chains[0],
    };
    await Promise.all([
      new Promise<void>((resolve) => {
        dapp.events.on("session_event", (eventPayload) => {
          const { topic, params } = eventPayload;
          expect(topic).to.be.eq(sessionEvent.topic);
          expect(params.event).to.toMatchObject(sessionEvent.event);
          resolve();
        });
      }),
      wallet.emitSessionEvent(sessionEvent),
    ]);
  });

  it("should get active sessions", async () => {
    // first pair and approve session
    await Promise.all([
      new Promise((resolve) => {
        wallet.on("session_proposal", async (sessionProposal) => {
          const { id, params } = sessionProposal;
          session = await wallet.approveSession({
            id,
            namespaces: {
              eip155: {
                ...TEST_NAMESPACES.eip155,
                accounts: [`${TEST_ETHEREUM_CHAIN}:${cryptoWallet.address}`],
              },
            },
          });
          expect(params.requiredNamespaces).to.toMatchObject(TEST_REQUIRED_NAMESPACES);
          resolve(session);
        });
      }),
      sessionApproval(),
      wallet.pair({ uri: uriString }),
    ]);

    const sessions = wallet.getActiveSessions();
    expect(sessions).to.be.exist;
    expect(Object.values(sessions).length).to.be.eq(1);
    expect(Object.keys(sessions)[0]).to.be.eq(session.topic);
  });

  it("should get pending session proposals", async () => {
    // first pair and approve session
    await Promise.all([
      new Promise<void>((resolve) => {
        wallet.on("session_proposal", () => {
          const proposals = wallet.getPendingSessionProposals();
          expect(proposals).to.be.exist;
          expect(Object.values(proposals).length).to.be.eq(1);
          expect(proposals[0].requiredNamespaces).to.toMatchObject(TEST_REQUIRED_NAMESPACES);
          resolve();
        });
      }),
      wallet.pair({ uri: uriString }),
    ]);
  });

  it("should get pending session requests", async () => {
    // first pair and approve session
    await Promise.all([
      new Promise((resolve) => {
        wallet.on("session_proposal", async (sessionProposal) => {
          const { id, params } = sessionProposal;
          session = await wallet.approveSession({
            id,
            namespaces: {
              eip155: {
                ...TEST_NAMESPACES.eip155,
                accounts: [`${TEST_ETHEREUM_CHAIN}:${cryptoWallet.address}`],
              },
            },
          });
          expect(params.requiredNamespaces).to.toMatchObject(TEST_REQUIRED_NAMESPACES);
          resolve(session);
        });
      }),
      sessionApproval(),
      wallet.pair({ uri: uriString }),
    ]);

    const requestParams = {
      method: "eth_signTransaction",
      params: [
        {
          from: cryptoWallet.address,
          to: cryptoWallet.address,
          data: "0x",
          nonce: "0x01",
          gasPrice: "0x020a7ac094",
          gasLimit: "0x5208",
          value: "0x00",
        },
      ],
    };

    await Promise.all([
      new Promise((resolve) => {
        wallet.on("session_request", async () => {
          const pendingRequests = wallet.getPendingSessionRequests();
          const request = pendingRequests[0];
          const signTransaction = request.params.request.params[0];
          const signature = await cryptoWallet.signTransaction(signTransaction);
          const response = await wallet.respondSessionRequest({
            topic: session.topic,
            response: formatJsonRpcResult(request.id, signature),
          });
          resolve(response);
          resolve(pendingRequests);
        });
      }),
      new Promise<void>(async (resolve) => {
        const result = await dapp.request({
          topic: session.topic,
          request: requestParams,
          chainId: TEST_ETHEREUM_CHAIN,
        });
        expect(result).to.be.exist;
        expect(result).to.be.a("string");
        resolve();
        resolve();
      }),
    ]);
  });

  describe("Decrypted notifications", () => {
    it("should get session metadata", async () => {
      const dappMetadata: CoreTypes.Metadata = {
        name: "Test Dapp",
        description: "Test Dapp Description",
        url: "https://walletconnect.com",
        icons: ["https://walletconnect.com/walletconnect-logo.png"],
      };
      const dappTable = "./test/tmp/dapp";
      const walletTable = "./test/tmp/wallet";
      const dapp = await SignClient.init({
        ...TEST_CORE_OPTIONS,
        name: "Dapp",
        metadata: dappMetadata,
        storageOptions: {
          database: dappTable,
        },
      });
      const wallet = await Web3Wallet.init({
        core: new Core({
          ...TEST_CORE_OPTIONS,
          storageOptions: { database: walletTable },
        }),
        name: "wallet",
        metadata: {} as any,
      });

      const { uri: uriString, approval } = await dapp.connect({});
      let session: SessionTypes.Struct;
      await Promise.all([
        new Promise((resolve) => {
          wallet.on("session_proposal", async (sessionProposal) => {
            const { id, params, verifyContext } = sessionProposal;
            expect(verifyContext.verified.validation).to.eq("UNKNOWN");
            expect(verifyContext.verified.isScam).to.eq(undefined);
            session = await wallet.approveSession({
              id,
              namespaces: TEST_NAMESPACES,
            });
            resolve(session);
          });
        }),
        new Promise(async (resolve) => {
          resolve(await approval());
        }),
        wallet.pair({ uri: uriString! }),
      ]);

      const metadata = await Web3Wallet.notifications.getMetadata({
        topic: session?.topic,
        storageOptions: { database: walletTable },
      });

      expect(metadata).to.be.exist;
      expect(metadata).to.be.a("object");
      expect(metadata).to.toMatchObject(dappMetadata);
    });

    it("should decrypt payload with pairing topic", async () => {
      const dappMetadata: CoreTypes.Metadata = {
        name: "Test Dapp",
        description: "Test Dapp Description",
        url: "https://walletconnect.com",
        icons: ["https://walletconnect.com/walletconnect-logo.png"],
      };
      const dappTable = "./test/tmp/dapp";
      const walletTable = "./test/tmp/wallet";
      const dapp = await SignClient.init({
        ...TEST_CORE_OPTIONS,
        name: "Dapp",
        metadata: dappMetadata,
        storageOptions: {
          database: dappTable,
        },
      });
      const wallet = await Web3Wallet.init({
        core: new Core({
          ...TEST_CORE_OPTIONS,
          storageOptions: { database: walletTable },
        }),
        name: "wallet",
        metadata: {} as any,
      });

      const { uri: uriString = "", approval } = await dapp.connect({});
      let encryptedMessage = "";
      let decryptedMessage: JsonRpcPayload = {} as any;
      let pairingTopic = "";
      await Promise.all([
        new Promise<void>((resolve) => {
          wallet.core.relayer.on(RELAYER_EVENTS.message, async (payload) => {
            const { topic, message } = payload;
            const decrypted = await wallet.core.crypto.decode(topic, message);
            expect(decrypted).to.be.exist;
            if (decrypted?.method === "wc_sessionPropose" && isJsonRpcRequest(decrypted)) {
              encryptedMessage = message;
              decryptedMessage = decrypted;
              pairingTopic = topic;
              resolve();
            }
          });
        }),
        new Promise<void>((resolve) => {
          wallet.on("session_proposal", async (sessionProposal) => {
            const { id, params, verifyContext } = sessionProposal;
            expect(verifyContext.verified.validation).to.eq("UNKNOWN");
            expect(verifyContext.verified.isScam).to.eq(undefined);
            await wallet.approveSession({
              id,
              namespaces: TEST_NAMESPACES,
            });
            resolve();
          });
        }),
        new Promise(async (resolve) => {
          resolve(await approval());
        }),
        wallet.pair({ uri: uriString }),
      ]);

      const decrypted = await Web3Wallet.notifications.decryptMessage({
        topic: pairingTopic,
        encryptedMessage,
        storageOptions: { database: walletTable },
      });
      expect(decrypted).to.be.exist;
      expect(decrypted).to.be.a("object");
      expect(decrypted).to.toMatchObject(decryptedMessage);
    });
    it("should decrypt payload with session topic", async () => {
      const dappMetadata: CoreTypes.Metadata = {
        name: "Test Dapp",
        description: "Test Dapp Description",
        url: "https://walletconnect.com",
        icons: ["https://walletconnect.com/walletconnect-logo.png"],
      };
      const dappTable = "./test/tmp/dapp";
      const walletTable = "./test/tmp/wallet";
      const dapp = await SignClient.init({
        ...TEST_CORE_OPTIONS,
        name: "Dapp",
        metadata: dappMetadata,
        storageOptions: {
          database: dappTable,
        },
      });
      const wallet = await Web3Wallet.init({
        core: new Core({
          ...TEST_CORE_OPTIONS,
          storageOptions: { database: walletTable },
        }),
        name: "wallet",
        metadata: {} as any,
      });

      const { uri: uriString = "", approval } = await dapp.connect({});

      let session: SessionTypes.Struct = {} as any;
      // pair and approve session
      await Promise.all([
        new Promise<void>((resolve) => {
          wallet.on("session_proposal", async (sessionProposal) => {
            const { id, params, verifyContext } = sessionProposal;
            expect(verifyContext.verified.validation).to.eq("UNKNOWN");
            expect(verifyContext.verified.isScam).to.eq(undefined);
            session = await wallet.approveSession({
              id,
              namespaces: TEST_NAMESPACES,
            });
            resolve();
          });
        }),
        new Promise(async (resolve) => {
          resolve(await approval());
        }),
        wallet.pair({ uri: uriString }),
      ]);

      let encryptedMessage = "";
      let decryptedMessage: JsonRpcPayload = {} as any;
      await Promise.all([
        new Promise<void>((resolve) => {
          wallet.core.relayer.on(RELAYER_EVENTS.message, async (payload) => {
            const { topic, message } = payload;
            const decrypted = await wallet.core.crypto.decode(topic, message);
            expect(decrypted).to.be.exist;
            if (decrypted?.method === "wc_sessionRequest" && isJsonRpcRequest(decrypted)) {
              encryptedMessage = message;
              decryptedMessage = decrypted;
              resolve();
            }
          });
        }),
        new Promise<void>((resolve) => {
          wallet.on("session_request", async (payload) => {
            const { id, params, topic, verifyContext } = payload;
            await wallet.respondSessionRequest({
              topic,
              response: formatJsonRpcResult(id, "0x"),
            });
            resolve();
          });
        }),
        dapp.request({
          topic: session.topic,
          request: {
            method: "eth_signTransaction",
            params: [
              {
                from: cryptoWallet.address,
                to: cryptoWallet.address,
                data: "0x",
                nonce: "0x01",
                gasPrice: "0x020a7ac094",
                gasLimit: "0x5208",
                value: "0x00",
              },
            ],
          },
          chainId: TEST_ETHEREUM_CHAIN,
        }),
      ]);
      const decrypted = await Web3Wallet.notifications.decryptMessage({
        topic: session.topic,
        encryptedMessage,
        storageOptions: { database: walletTable },
      });
      expect(decrypted).to.be.exist;
      expect(decrypted).to.be.a("object");
      expect(decrypted).to.toMatchObject(decryptedMessage);
    });
  });
});
