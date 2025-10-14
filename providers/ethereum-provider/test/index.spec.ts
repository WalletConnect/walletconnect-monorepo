import { afterAll, beforeAll, describe, expect, it } from "vitest";
import Web3 from "web3";
import { ContractFactory, ethers, toBeHex } from "ethers";

import { SESSION_REQUEST_EXPIRY_BOUNDARIES, SignClient } from "@walletconnect/sign-client";
import { parseChainId } from "@walletconnect/utils";

import { WalletClient } from "./shared";
import EthereumProvider, { OPTIONAL_EVENTS, OPTIONAL_METHODS } from "../src";
import ERC20Artifact from "./shared/TestToken.json";
import {
  CHAIN_ID,
  RPC_URL,
  ACCOUNTS,
  TEST_WALLET_CLIENT_OPTS,
  TEST_ETH_TRANSFER,
  TEST_SIGN_TRANSACTION,
  TEST_ETHEREUM_METHODS_REQUIRED,
  TEST_ETHEREUM_METHODS_OPTIONAL,
  TEST_WALLET_METADATA,
  TEST_APP_METADATA_A,
} from "./shared/constants";
import { EthereumProviderOptions } from "../src/EthereumProvider";

describe("EthereumProvider", function () {
  let provider: EthereumProvider;
  let walletClient: WalletClient;
  let walletAddress: string;
  let receiverAddress: string;

  beforeAll(async () => {
    provider = await EthereumProvider.init({
      projectId: process.env.TEST_PROJECT_ID || "",
      chains: [1],
      methods: TEST_ETHEREUM_METHODS_REQUIRED,
      optionalMethods: TEST_ETHEREUM_METHODS_OPTIONAL,
      showQrModal: false,
      qrModalOptions: {
        themeMode: "dark",
        themeVariables: {
          "--wcm-z-index": "99",
        },
      },
      disableProviderPing: true,
      metadata: TEST_APP_METADATA_A,
    });
    walletClient = await WalletClient.init(provider, TEST_WALLET_CLIENT_OPTS);
    await provider.connect({
      optionalChains: [42, CHAIN_ID],
      rpcMap: {
        [CHAIN_ID]: RPC_URL,
      },
    });
    walletAddress = walletClient.signer.address;
    receiverAddress = ACCOUNTS.b.address;
  });

  afterAll(async () => {
    await provider.signer.client.core.relayer.transportClose();
    await walletClient.client?.core.relayer.transportClose();
  });

  it("chainChanged", async () => {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    // change to Kovan
    await Promise.all([
      new Promise<void>(async (resolve, reject) => {
        try {
          await walletClient.changeChain(42, "https://kovan.poa.network");
          resolve();
        } catch (e) {
          reject(e);
        }
      }),

      new Promise<void>((resolve, reject) => {
        provider.on("chainChanged", (chainId) => {
          try {
            expect(parseInt(chainId, 16)).to.eql(42);
            resolve();
          } catch (e) {
            reject(e);
          }
        });
      }),
    ]);
    // change back to testNetwork
    await Promise.all([
      new Promise<void>(async (resolve, reject) => {
        try {
          await walletClient.changeChain(CHAIN_ID, RPC_URL);
          resolve();
        } catch (e) {
          reject(e);
        }
      }),

      new Promise<void>((resolve, reject) => {
        provider.on("chainChanged", (chainId) => {
          try {
            expect(parseInt(chainId, 16)).to.eql(CHAIN_ID);
            resolve();
          } catch (e) {
            reject(e);
          }
        });
      }),
    ]);
  });
  it("accountsChanged", async () => {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    // change to account c
    await Promise.all([
      new Promise<void>(async (resolve, reject) => {
        try {
          await walletClient.changeAccount(ACCOUNTS.c.privateKey);
          resolve();
        } catch (e) {
          reject(e);
        }
      }),

      new Promise<void>((resolve, reject) => {
        provider.on("accountsChanged", (accounts: string[]) => {
          try {
            expect(accounts[0]).to.eql(ACCOUNTS.c.address);
            resolve();
          } catch (e) {
            reject(e);
          }
        });
      }),
    ]);
    // change back to account a
    await Promise.all([
      new Promise<void>(async (resolve, reject) => {
        try {
          await walletClient.changeAccount(ACCOUNTS.a.privateKey);
          resolve();
        } catch (e) {
          reject(e);
        }
      }),

      new Promise<void>((resolve, reject) => {
        provider.on("accountsChanged", (accounts) => {
          try {
            expect(accounts[0]).to.eql(ACCOUNTS.a.address);
            resolve();
          } catch (e) {
            reject(e);
          }
        });
      }),
    ]);
  });

  describe("validation", () => {
    it("should reject when lower than min expiry is used", async () => {
      const expiryToTest = SESSION_REQUEST_EXPIRY_BOUNDARIES.min - 1;
      await expect(
        provider.request({ method: "personal_sign" }, expiryToTest),
      ).rejects.toThrowError(
        `Missing or invalid. request() expiry: ${expiryToTest}. Expiry must be a number (in seconds) between ${SESSION_REQUEST_EXPIRY_BOUNDARIES.min} and ${SESSION_REQUEST_EXPIRY_BOUNDARIES.max}`,
      );
    });
    it("should reject when higher than max expiry is used", async () => {
      const expiryToTest = SESSION_REQUEST_EXPIRY_BOUNDARIES.max + 1;
      await expect(
        provider.request({ method: "personal_sign" }, expiryToTest),
      ).rejects.toThrowError(
        `Missing or invalid. request() expiry: ${expiryToTest}. Expiry must be a number (in seconds) between ${SESSION_REQUEST_EXPIRY_BOUNDARIES.min} and ${SESSION_REQUEST_EXPIRY_BOUNDARIES.max}`,
      );
    });
  });

  describe("eip155", () => {
    describe("Web3", () => {
      let web3: Web3;
      beforeAll(async () => {
        web3 = new Web3(provider);
        await web3.provider?.request({
          method: "hardhat_setBalance",
          params: [walletAddress, "0xDE0B6B3A7640000"],
        });
      });
      it("matches accounts", async () => {
        const accounts = await web3.eth.getAccounts();
        expect(accounts[0]).to.include(walletAddress);
      });
      it("matches chainId", async () => {
        const chainId = await web3.eth.getChainId();
        expect(chainId).to.eql(BigInt(CHAIN_ID));
      });
      it("ERC20 contract", async () => {
        const erc20Factory = new web3.eth.Contract(JSON.parse(JSON.stringify(ERC20Artifact.abi)));
        const erc20 = await erc20Factory
          .deploy({ data: ERC20Artifact.bytecode, arguments: ["The test token", "tst"] })
          .send({ from: walletAddress });

        const balanceToMint = ethers.parseEther("2");
        const mintTx = erc20.methods.mint(walletAddress, toBeHex(balanceToMint));
        await mintTx.send({ from: walletAddress });
        const balance = (await erc20.methods.balanceOf(walletAddress).call()) as string;
        expect(BigInt(balance).toString()).to.eql(balanceToMint.toString());
        const transferTx = erc20.methods.transfer(receiverAddress, toBeHex(ethers.parseEther("1")));
        const tokenTransferGas = await transferTx.estimateGas({ from: walletAddress });
        // This value may change with compiler/EVM updates. Allow a small tolerance to avoid brittle tests.
        expect(Number(tokenTransferGas)).to.be.within(52000, 53000);
        await transferTx.send({ from: walletAddress });
        const tokenBalanceA = await erc20.methods.balanceOf(walletAddress).call();
        expect(tokenBalanceA).to.eql(BigInt(ethers.parseEther("1").toString()));
        const tokenBalanceB = await erc20.methods.balanceOf(receiverAddress).call();
        expect(tokenBalanceB).to.eql(BigInt(ethers.parseEther("1")));
      });
      it("estimate gas", async () => {
        const ethTransferGas = await web3.eth.estimateGas(TEST_ETH_TRANSFER);
        // This value may change with compiler/EVM updates. Allow a small tolerance to avoid brittle tests.
        expect(Number(ethTransferGas)).to.be.within(21000, 22000);
      });
      it("send transaction", async () => {
        const balanceBefore = BigInt(await web3.eth.getBalance(walletAddress));
        await web3.eth.sendTransaction({ ...TEST_ETH_TRANSFER, from: walletAddress });
        const balanceAfter = BigInt(await web3.eth.getBalance(walletAddress));
        expect(
          balanceAfter < balanceBefore,
          "balanceAfter " +
            balanceAfter.toString() +
            " less than balanceBefore: " +
            balanceBefore.toString(),
        ).to.be.true;
      });
      it("sign transaction", async () => {
        const balanceBefore = BigInt(await web3.eth.getBalance(walletAddress));
        const { rawTransaction } = await web3.eth.accounts.signTransaction(
          { ...TEST_SIGN_TRANSACTION, from: walletAddress },
          walletClient.signer.privateKey,
        );
        const broadcastTx = await provider.request({
          method: "eth_sendRawTransaction",
          params: [rawTransaction],
        });
        expect(!!broadcastTx).to.be.true;
        const balanceAfter = BigInt(await web3.eth.getBalance(walletAddress));
        expect(balanceAfter < balanceBefore).to.be.true;
      });
      it("sign message", async () => {
        const msg = "Hello world";
        const encodedMessage = `0x${Buffer.from(msg).toString("hex")}`;
        const signature = (await web3.provider?.request({
          method: "personal_sign",
          params: [encodedMessage, walletAddress],
        })) as unknown as string;
        const verify = ethers.verifyMessage(msg, signature);
        expect(verify).eq(walletAddress);
      });
      it("sign transaction and send via sendAsync", async () => {
        const { rawTransaction } = await web3.eth.accounts.signTransaction(
          { ...TEST_SIGN_TRANSACTION, to: receiverAddress, from: walletAddress },
          walletClient.signer.privateKey,
        );
        const callback = async (_error: any, jsonRpcResult: any) => {
          expect(jsonRpcResult).to.exist;
          expect(jsonRpcResult.id).to.exist;
          expect(jsonRpcResult.result).to.exist;
          expect(jsonRpcResult.result).to.be.a("string");
        };
        provider.sendAsync(
          {
            method: "eth_sendRawTransaction",
            params: [rawTransaction],
          },
          callback,
        );
      });
    });
    describe("Ethers", () => {
      let web3Provider: ethers.BrowserProvider;
      beforeAll(async () => {
        web3Provider = new ethers.BrowserProvider(provider);
        await web3Provider.send("hardhat_setBalance", [walletAddress, "0xDE0B6B3A7640000"]);
      });
      it("matches accounts", async () => {
        const accounts = await web3Provider.listAccounts();
        expect(accounts[0].address).to.include(walletAddress);
      });
      it("matches chainId", async () => {
        const network = await web3Provider.getNetwork();
        expect(network.chainId).to.equal(BigInt(CHAIN_ID));
      });
      it("ERC20 contract", async () => {
        const signer = await web3Provider.getSigner();

        const erc20Factory = new ContractFactory(ERC20Artifact.abi, ERC20Artifact.bytecode, signer);
        const erc20 = await erc20Factory.deploy("The test token", "TST");
        const deployTx = await erc20Factory.getDeployTransaction("The test token", "TST");
        const deployTxHash = await signer.sendTransaction(deployTx);
        await deployTxHash.wait();
        const balanceToMint = ethers.parseEther("2");
        const mintTx = await erc20.mint(walletAddress, balanceToMint);
        await mintTx.wait();
        const tokenBalance = await erc20.balanceOf(walletAddress);
        expect(tokenBalance.toString()).to.eql(balanceToMint.toString());
        const tokenTransferGas = await erc20
          .getFunction("transfer")
          .estimateGas(receiverAddress, ethers.parseEther("1"));
        // This value may change with compiler/EVM updates. Allow a small tolerance to avoid brittle tests.
        expect(Number(tokenTransferGas)).to.be.within(52000, 53000);
        const transferTx = await erc20.transfer(receiverAddress, ethers.parseEther("1"));
        await transferTx.wait();
        const tokenBalanceA = await erc20.balanceOf(walletAddress);
        expect(tokenBalanceA.toString()).to.eql(ethers.parseEther("1").toString());
        const tokenBalanceB = await erc20.balanceOf(receiverAddress);
        expect(tokenBalanceB.toString()).to.eql(ethers.parseEther("1").toString());
      });
      it("estimate gas", async () => {
        const ethTransferGas = await web3Provider.estimateGas(TEST_ETH_TRANSFER);
        // This value may change with compiler/EVM updates. Allow a small tolerance to avoid brittle tests.
        expect(Number(ethTransferGas)).to.be.within(21000, 22000);
      });
      it("send transaction", async () => {
        const balanceBefore = await web3Provider.getBalance(walletAddress);
        const signer = await web3Provider.getSigner();
        const transferTx = await signer.sendTransaction(TEST_ETH_TRANSFER);
        await transferTx.wait();

        expect(!!transferTx.hash).to.be.true;
        const balanceAfter = await web3Provider.getBalance(walletAddress);
        expect(
          balanceAfter < balanceBefore,
          "balanceAfter " +
            balanceAfter.toString() +
            " less than balanceBefore: " +
            balanceBefore.toString(),
        ).to.be.true;
      });
      it("sign message", async () => {
        const msg = "Hello world";
        const signer = await web3Provider.getSigner(walletClient.signer.address);
        const signature = await signer.signMessage(msg);
        const verify = ethers.verifyMessage(msg, signature);
        expect(verify).eq(walletAddress);
      });
    });
  });
  describe("persistence", () => {
    const db = "./test/tmp/test.db";
    const initOptions: EthereumProviderOptions = {
      projectId: process.env.TEST_PROJECT_ID || "",
      chains: [CHAIN_ID],
      showQrModal: false,
      storageOptions: {
        database: db,
      },
      metadata: TEST_WALLET_METADATA,
    };
    it("should restore session with `eip155: { chains: [...] }` structure", async () => {
      const provider = await EthereumProvider.init(initOptions);
      const walletClient = await SignClient.init({
        projectId: initOptions.projectId,
        metadata: initOptions.metadata,
      });
      await Promise.all([
        new Promise<void>((resolve) => {
          walletClient.on("session_proposal", async (proposal) => {
            await walletClient.approve({
              id: proposal.id,
              namespaces: {
                eip155: {
                  accounts: [`eip155:${CHAIN_ID}:${walletAddress}`],
                  methods: proposal.params.optionalNamespaces.eip155.methods,
                  events: proposal.params.optionalNamespaces.eip155.events,
                },
              },
            });
            resolve();
          });
        }),
        new Promise<void>((resolve) => {
          provider.on("display_uri", (uri) => {
            walletClient.pair({ uri });
            resolve();
          });
        }),
        provider.connect(),
      ]);
      const accounts = (await provider.request({ method: "eth_accounts" })) as string[];
      expect(accounts[0]).to.include(walletAddress);
      expect(accounts.length).to.eql(1);

      await provider.signer.client.core.relayer.transportClose();
      await walletClient.core.relayer.transportClose();

      // reload the provider with the persisted session
      const persistedProvider = await EthereumProvider.init(initOptions);
      const persistedAccounts = (await persistedProvider.request({
        method: "eth_accounts",
      })) as string[];

      expect(persistedAccounts[0]).to.include(walletAddress);
      expect(persistedAccounts.length).to.eql(1);
      expect(persistedAccounts).to.eql(accounts);

      await persistedProvider.signer.client.core.relayer.transportClose();
    });
    it("should restore session with `['eip155:1']: {...}` structure", async () => {
      const provider = await EthereumProvider.init(initOptions);
      const walletClient = await SignClient.init({
        projectId: initOptions.projectId,
        metadata: initOptions.metadata,
      });
      await Promise.all([
        new Promise<void>((resolve) => {
          walletClient.on("session_proposal", async (proposal) => {
            await walletClient.approve({
              id: proposal.id,
              namespaces: {
                [`eip155:${CHAIN_ID}`]: {
                  accounts: [`eip155:${CHAIN_ID}:${walletAddress}`],
                  methods: proposal.params.optionalNamespaces.eip155.methods,
                  events: proposal.params.optionalNamespaces.eip155.events,
                },
              },
            });
            resolve();
          });
        }),
        new Promise<void>((resolve) => {
          provider.on("display_uri", async (uri) => {
            await walletClient.pair({ uri });
            resolve();
          });
        }),
        provider.connect(),
      ]);
      const accounts = (await provider.request({ method: "eth_accounts" })) as string[];
      expect(accounts[0]).to.include(walletAddress);
      expect(accounts.length).to.eql(1);

      await provider.signer.client.core.relayer.transportClose();
      await walletClient.core.relayer.transportClose();

      // reload the provider with the persisted session
      const persistedProvider = await EthereumProvider.init(initOptions);
      const persistedAccounts = (await persistedProvider.request({
        method: "eth_accounts",
      })) as string[];

      expect(persistedAccounts[0]).to.include(walletAddress);
      expect(persistedAccounts.length).to.eql(1);
      expect(persistedAccounts).to.eql(accounts);

      await persistedProvider.signer.client.core.relayer.transportClose();
    });
  });
  describe("required & optional chains", () => {
    it("should connect without any required chains", async () => {
      const initOptions: EthereumProviderOptions = {
        projectId: process.env.TEST_PROJECT_ID || "",
        optionalChains: [137, CHAIN_ID],
        showQrModal: false,
        metadata: TEST_WALLET_METADATA,
      };
      const provider = await EthereumProvider.init(initOptions);
      const walletClient = await SignClient.init({
        projectId: initOptions.projectId,
        metadata: initOptions.metadata,
      });
      await Promise.all([
        new Promise<void>((resolve) => {
          walletClient.on("session_proposal", async (proposal) => {
            expect(proposal.params.optionalNamespaces.eip155.methods).to.eql(OPTIONAL_METHODS);
            expect(proposal.params.optionalNamespaces.eip155.events).to.eql(OPTIONAL_EVENTS);

            await walletClient.approve({
              id: proposal.id,
              namespaces: {
                eip155: {
                  chains: proposal.params.optionalNamespaces.eip155.chains,
                  accounts:
                    proposal.params.optionalNamespaces.eip155.chains?.map(
                      (chain) => `${chain}:${walletAddress}`,
                    ) || [],
                  methods: proposal.params.optionalNamespaces.eip155.methods,
                  events: proposal.params.optionalNamespaces.eip155.events,
                },
              },
            });
            resolve();
          });
        }),
        new Promise<void>((resolve) => {
          provider.on("display_uri", (uri) => {
            walletClient.pair({ uri });
            resolve();
          });
        }),
        provider.connect(),
      ]);
      const accounts = (await provider.request({ method: "eth_accounts" })) as string[];
      expect(accounts[0]).to.include(walletAddress);
      expect(accounts.length).to.eql(1);

      const httpProviders = provider.signer.rpcProviders.eip155.httpProviders;
      expect(httpProviders).to.exist;
      expect(httpProviders).to.be.an("object");
      expect(Object.keys(httpProviders).length).to.eql(initOptions.optionalChains.length);
      expect(Object.keys(httpProviders).map((chain) => parseInt(chain))).to.eql(
        initOptions.optionalChains,
      );
      await provider.signer.client.core.relayer.transportClose();
      await walletClient.core.relayer.transportClose();
    });
    it("should connect without optional chains", async () => {
      const initOptions: EthereumProviderOptions = {
        projectId: process.env.TEST_PROJECT_ID || "",
        chains: [CHAIN_ID],
        showQrModal: false,
        metadata: TEST_WALLET_METADATA,
      };
      const provider = await EthereumProvider.init(initOptions);
      const walletClient = await SignClient.init({
        projectId: initOptions.projectId,
        metadata: initOptions.metadata,
      });
      await Promise.all([
        new Promise<void>((resolve) => {
          walletClient.on("session_proposal", async (proposal) => {
            await walletClient.approve({
              id: proposal.id,
              namespaces: {
                eip155: {
                  accounts: [`eip155:${CHAIN_ID}:${walletAddress}`],
                  methods: proposal.params.optionalNamespaces.eip155.methods,
                  events: proposal.params.optionalNamespaces.eip155.events,
                },
              },
            });
            resolve();
          });
        }),
        new Promise<void>((resolve) => {
          provider.on("display_uri", (uri) => {
            walletClient.pair({ uri });
            resolve();
          });
        }),
        provider.connect(),
      ]);
      const accounts = (await provider.request({ method: "eth_accounts" })) as string[];
      expect(accounts[0]).to.include(walletAddress);
      expect(accounts.length).to.eql(1);

      await provider.signer.client.core.relayer.transportClose();
      await walletClient.core.relayer.transportClose();
    });
    it("should reject init with empty `chains` and `optionalChains`", async () => {
      await expect(
        // @ts-ignore
        EthereumProvider.init({
          projectId: process.env.TEST_PROJECT_ID || "",
          chains: [],
          optionalChains: [],
          showQrModal: false,
          metadata: TEST_WALLET_METADATA,
        }),
      ).rejects.toThrowError("No chains specified in either `chains` or `optionalChains`");
    });
    it("should connect when none of the optional chains are approved", async () => {
      const initOptions: EthereumProviderOptions = {
        projectId: process.env.TEST_PROJECT_ID || "",
        optionalChains: [CHAIN_ID],
        showQrModal: false,
        metadata: TEST_WALLET_METADATA,
      };
      const provider = await EthereumProvider.init(initOptions);
      const walletClient = await SignClient.init({
        projectId: initOptions.projectId,
        metadata: initOptions.metadata,
      });
      const chainToApprove = "eip155:137";

      expect(parseInt(parseChainId(chainToApprove).reference)).to.not.eql(CHAIN_ID);

      await Promise.all([
        new Promise<void>((resolve) => {
          walletClient.on("session_proposal", async (proposal) => {
            await walletClient.approve({
              id: proposal.id,
              namespaces: {
                eip155: {
                  chains: [chainToApprove],
                  accounts: [`${chainToApprove}:${walletAddress}`],
                  methods: proposal.params.optionalNamespaces.eip155.methods,
                  events: proposal.params.optionalNamespaces.eip155.events,
                },
              },
            });
            resolve();
          });
        }),
        new Promise<void>((resolve) => {
          provider.on("display_uri", (uri) => {
            walletClient.pair({ uri });
            resolve();
          });
        }),
        new Promise<void>((resolve) => {
          provider.on("accountsChanged", (accounts) => {
            expect(accounts[0]).to.include(walletAddress);
            expect(accounts.length).to.eql(1);
            resolve();
          });
        }),
        new Promise<void>((resolve) => {
          provider.on("chainChanged", (chain) => {
            expect(parseInt(chain, 16)).to.eql(parseInt(parseChainId(chainToApprove).reference));
            resolve();
          });
        }),
        provider.connect(),
      ]);
      const accounts = (await provider.request({ method: "eth_accounts" })) as string[];
      expect(accounts[0]).to.include(walletAddress);
      expect(accounts.length).to.eql(1);

      const httpProviders = provider.signer.rpcProviders.eip155.httpProviders;
      expect(httpProviders).to.exist;
      expect(httpProviders).to.be.an("object");
      expect(Object.keys(httpProviders).length).to.eql(1);
      expect(Object.keys(httpProviders).map((chain) => parseInt(chain))).to.eql([
        parseInt(parseChainId(chainToApprove).reference),
      ]);
      await provider.signer.client.core.relayer.transportClose();
      await walletClient.core.relayer.transportClose();
    });
  });
  describe("events", () => {
    it("should emit accountsChanged when a chain is changed and there are new accounts on the new chain", async () => {
      const walletAddresses = [
        "0x0000000000000000000000000000000000000000",
        "0x1111111111111111111111111111111111111111",
      ];
      // the chains requested during connection in the beforeAll hook
      const chains = [42, CHAIN_ID];

      if (!provider.signer.session) {
        throw new Error("No provider session found");
      }

      const cachedAccounts = provider.signer.session.namespaces.eip155.accounts;

      provider.signer.session.namespaces.eip155.accounts = [
        `eip155:${chains[0]}:${walletAddresses[0]}`,
        `eip155:${chains[1]}:${walletAddresses[1]}`,
      ];

      await Promise.all([
        new Promise<void>((resolve) => {
          provider.once("accountsChanged", (accounts) => {
            expect(accounts[0]).to.eql(walletAddresses[0]);
            expect(accounts.length).to.eql(1);
            resolve();
          });
        }),
        provider.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: `0x${chains[0].toString(16)}` }],
        }),
      ]);

      const newChainId = await provider.request({ method: "eth_chainId" });
      expect(newChainId).to.eql(chains[0]);

      await Promise.all([
        new Promise<void>((resolve) => {
          provider.once("accountsChanged", (accounts) => {
            expect(accounts[0]).to.eql(walletAddresses[1]);
            expect(accounts.length).to.eql(1);
            resolve();
          });
        }),
        provider.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: `0x${chains[1].toString(16)}` }],
        }),
      ]);

      const newChainId2 = await provider.request({ method: "eth_chainId" });
      expect(newChainId2).to.eql(chains[1]);

      provider.signer.session.namespaces.eip155.accounts = cachedAccounts;
    });
  });
});
