import { expect, describe, it, beforeAll, afterAll, vi } from "vitest";
import Web3 from "web3";
import { ContractFactory, ethers, toBeHex } from "ethers";

import { formatJsonRpcResult } from "@walletconnect/jsonrpc-utils";
import { RELAYER_EVENTS } from "../../../packages/core/src/constants";
import {
  deleteProviders,
  disconnectSocket,
  testConnectMethod,
  throttle,
  WalletClient,
} from "./shared";
import ERC20Artifact from "./shared/TestToken.json"; // Note: some setups need TypeChain

import UniversalProvider, { Namespace } from "../src";
import {
  CHAIN_ID,
  TEST_NAMESPACES_CONFIG,
  ACCOUNTS,
  TEST_PROVIDER_OPTS,
  TEST_WALLET_CLIENT_OPTS,
  TEST_ETH_TRANSFER,
  TEST_SIGN_TRANSACTION,
  CHAIN_ID_B,
  TEST_REQUIRED_NAMESPACES,
} from "./shared/constants";
import { getGlobal, getRpcUrl, setGlobal } from "../src/utils";
import { BUNDLER_URL, RPC_URL } from "../src/constants";

const getDbName = (_prefix: string) => {
  return `./test/tmp/${_prefix}.db`;
};

const methods = ["personal_sign"];
const events = ["chainChanged"];

describe("UniversalProvider", function () {
  let provider: UniversalProvider;
  let walletClient: WalletClient;
  let walletAddress: string;
  let receiverAddress: string;
  beforeAll(async () => {
    provider = await UniversalProvider.init(TEST_PROVIDER_OPTS);

    walletClient = await WalletClient.init(provider, TEST_WALLET_CLIENT_OPTS);

    await provider.connect(TEST_NAMESPACES_CONFIG);

    walletAddress = walletClient.signer.address;
    receiverAddress = ACCOUNTS.b.address;
    expect(walletAddress).to.eql(ACCOUNTS.a.address);
    const providerAccounts = await provider.enable();
    expect(providerAccounts).to.eql([walletAddress]);
    await new Promise<void>((resolve) => setTimeout(resolve, 1000));
  });
  afterAll(async () => {
    await deleteProviders({ A: provider, B: walletClient.provider });
  });

  describe("eip155", () => {
    describe("multi chain", () => {
      let web3: Web3;
      beforeAll(() => {
        web3 = new Web3(provider);
      });
      it("should change default chainId", async () => {
        const chainId = await web3.eth.getChainId();
        expect(chainId).to.eql(BigInt(CHAIN_ID));

        provider.setDefaultChain(`eip155:${CHAIN_ID_B}`);

        const chainIdB = await web3.eth.getChainId();
        expect(chainIdB).to.not.eql(BigInt(CHAIN_ID));
        expect(chainIdB).to.eql(BigInt(CHAIN_ID_B));

        provider.setDefaultChain(`eip155:${CHAIN_ID}`);
      });
      it("should send `wallet_switchEthereumChain` request when chain is not approved", async () => {
        const currentApprovedChains = provider.session?.namespaces.eip155.chains;
        const chainToSwith = "eip155:1";
        const chainToSwitchParsed = parseInt(chainToSwith.split(":")[1]);
        // confirm that chain is not approved
        expect(currentApprovedChains).to.not.include(chainToSwith);

        const activeChain = await web3.eth.getChainId();
        expect(activeChain).to.not.eql(chainToSwitchParsed);
        expect(activeChain).to.eql(BigInt(CHAIN_ID));

        // when we send the wallet_switchEthereumChain request
        // the wallet should receive & update the session with the new chain
        await Promise.all([
          new Promise<void>((resolve) => {
            provider.on("session_update", (args: any) => {
              expect(args.params.namespaces.eip155.chains).to.include(chainToSwith);
              resolve();
            });
          }),
          provider.request(
            {
              method: "wallet_switchEthereumChain",
              params: [{ chainId: `0x${chainToSwith.split(":")[1]}` }],
            },
            chainToSwith,
          ),
        ]);

        const activeChainAfterSwitch = await web3.eth.getChainId();
        expect(activeChainAfterSwitch).to.eql(BigInt(chainToSwitchParsed));

        // revert back to the original chain
        await provider.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: `0x${CHAIN_ID.toString(16)}` }],
        });
      });
    });
    describe("events", () => {
      it("should emit CAIP-10 parsed accountsChanged", async () => {
        const caip10AccountToEmit = `eip155:${CHAIN_ID}:${walletAddress}`;
        const expectedParsedAccount = walletAddress;
        expect(caip10AccountToEmit).to.not.eql(expectedParsedAccount);
        await Promise.all([
          new Promise<void>((resolve) => {
            provider.on("accountsChanged", (accounts: string[]) => {
              expect(accounts).to.be.an("array");
              expect(accounts).to.include(expectedParsedAccount);
              resolve();
            });
          }),
          walletClient.client?.emit({
            topic: provider.session?.topic || "",
            event: {
              name: "accountsChanged",
              data: [caip10AccountToEmit],
            },
            chainId: `eip155:${CHAIN_ID}`,
          }),
        ]);
      });
      it("should emit accountsChanged when a chain is changed and there are new accounts on the new chain", async () => {
        const dapp = await UniversalProvider.init({
          ...TEST_PROVIDER_OPTS,
          name: "dapp",
        });
        const wallet = await UniversalProvider.init({
          ...TEST_PROVIDER_OPTS,
          name: "wallet",
        });
        const chains = [1, 2, 3, 4, 5];
        const namespace = "eip155";
        const walletAddresses = [
          "0x0000000000000000000000000000000000000000",
          "0x1111111111111111111111111111111111111111",
          "0x2222222222222222222222222222222222222222",
          "0x3333333333333333333333333333333333333333",
          "0x4444444444444444444444444444444444444444",
          "0x5555555555555555555555555555555555555555",
          "0x6666666666666666666666666666666666666666",
          "0x7777777777777777777777777777777777777777",
          "0x8888888888888888888888888888888888888888",
          "0x9999999999999999999999999999999999999999",
        ];
        /*
        eip155:1 - One address
        eip155:2 - One address
        eip155:3 - two addresses
        eip155:4 - two addresses
        eip155:5 - one address
        */
        const accounts = [
          `${namespace}:${chains[0]}:${walletAddresses[0]}`,
          `${namespace}:${chains[1]}:${walletAddresses[1]}`,
          `${namespace}:${chains[2]}:${walletAddresses[2]}`,
          `${namespace}:${chains[2]}:${walletAddresses[3]}`,
          `${namespace}:${chains[3]}:${walletAddresses[4]}`,
          `${namespace}:${chains[3]}:${walletAddresses[5]}`,
          `${namespace}:${chains[4]}:${walletAddresses[6]}`,
        ];

        expect(accounts).to.be.an("array");
        expect(accounts).to.include(`${namespace}:${chains[0]}:${walletAddresses[0]}`);
        expect(accounts).to.include(`${namespace}:${chains[1]}:${walletAddresses[1]}`);
        expect(accounts).to.include(`${namespace}:${chains[2]}:${walletAddresses[2]}`);
        expect(accounts).to.include(`${namespace}:${chains[2]}:${walletAddresses[3]}`);
        expect(accounts).to.include(`${namespace}:${chains[3]}:${walletAddresses[4]}`);
        expect(accounts).to.include(`${namespace}:${chains[3]}:${walletAddresses[5]}`);
        expect(accounts).to.include(`${namespace}:${chains[4]}:${walletAddresses[6]}`);

        await testConnectMethod(
          {
            dapp,
            wallet,
          },
          {
            requiredNamespaces: {},
            optionalNamespaces: {},
            namespaces: {
              eip155: {
                accounts,
                chains: chains.map((chain) => `${namespace}:${chain}`),
                methods,
                events,
              },
            },
          },
        );
        const currentChain = await dapp.request({ method: "eth_chainId" });
        expect(currentChain).to.eql(chains[0]);
        await Promise.all([
          new Promise<void>((resolve) => {
            dapp.once("accountsChanged", (accountsChanged: string[]) => {
              expect(accountsChanged).to.be.an("array");
              expect(accountsChanged.length).to.eql(1);
              expect(accounts[1]).to.include(accountsChanged[0]);
              expect(accounts[1]).to.eql(`${namespace}:${chains[1]}:${accountsChanged[0]}`);
              resolve();
            });
          }),
          dapp.request({
            method: "wallet_switchEthereumChain",
            params: [{ chainId: `0x${chains[1].toString(16)}` }],
          }),
        ]);
        const newChain = await dapp.request({ method: "eth_chainId" });
        expect(newChain).to.eql(chains[1]);

        await Promise.all([
          new Promise<void>((resolve) => {
            dapp.once("accountsChanged", (accountsChanged: string[]) => {
              expect(accountsChanged).to.be.an("array");
              expect(accountsChanged.length).to.eql(1);
              expect(accounts[0]).to.include(accountsChanged[0]);
              expect(accounts[0]).to.eql(`${namespace}:${chains[0]}:${accountsChanged[0]}`);
              resolve();
            });
          }),
          dapp.request({
            method: "wallet_switchEthereumChain",
            params: [{ chainId: `0x${chains[0].toString(16)}` }],
          }),
        ]);
        const newChain2 = await dapp.request({ method: "eth_chainId" });
        expect(newChain2).to.eql(chains[0]);

        await Promise.all([
          new Promise<void>((resolve) => {
            dapp.once("accountsChanged", (accountsChanged: string[]) => {
              expect(accountsChanged).to.be.an("array");
              expect(accountsChanged.length).to.eql(2);
              expect(accounts[2]).to.include(accountsChanged[0]);
              expect(accounts[3]).to.include(accountsChanged[1]);
              expect(accounts[2]).to.eql(`${namespace}:${chains[2]}:${accountsChanged[0]}`);
              expect(accounts[3]).to.eql(`${namespace}:${chains[2]}:${accountsChanged[1]}`);
              resolve();
            });
          }),
          dapp.request({
            method: "wallet_switchEthereumChain",
            params: [{ chainId: `0x${chains[2].toString(16)}` }],
          }),
        ]);
        const newChain3 = await dapp.request({ method: "eth_chainId" });
        expect(newChain3).to.eql(chains[2]);

        await Promise.all([
          new Promise<void>((resolve) => {
            dapp.once("accountsChanged", (accountsChanged: string[]) => {
              expect(accountsChanged).to.be.an("array");
              expect(accountsChanged.length).to.eql(2);
              expect(accounts[4]).to.include(accountsChanged[0]);
              expect(accounts[5]).to.include(accountsChanged[1]);
              expect(accounts[4]).to.eql(`${namespace}:${chains[3]}:${accountsChanged[0]}`);
              expect(accounts[5]).to.eql(`${namespace}:${chains[3]}:${accountsChanged[1]}`);
              resolve();
            });
          }),
          dapp.request({
            method: "wallet_switchEthereumChain",
            params: [{ chainId: `0x${chains[3].toString(16)}` }],
          }),
        ]);
        const newChain4 = await dapp.request({ method: "eth_chainId" });
        expect(newChain4).to.eql(chains[3]);

        await Promise.all([
          new Promise<void>((resolve) => {
            dapp.once("accountsChanged", (accountsChanged: string[]) => {
              expect(accountsChanged).to.be.an("array");
              expect(accountsChanged.length).to.eql(1);
              expect(accounts[6]).to.include(accountsChanged[0]);
              expect(accounts[6]).to.eql(`${namespace}:${chains[4]}:${accountsChanged[0]}`);
              resolve();
            });
          }),
          dapp.request({
            method: "wallet_switchEthereumChain",
            params: [{ chainId: `0x${chains[4].toString(16)}` }],
          }),
        ]);
        const newChain5 = await dapp.request({ method: "eth_chainId" });
        expect(newChain5).to.eql(chains[4]);

        await deleteProviders({ A: dapp, B: wallet });
      });
      it("should automatically assign namespaces to optionalNamespaces", async () => {
        const dapp = await UniversalProvider.init({
          ...TEST_PROVIDER_OPTS,
          name: "dapp",
        });
        const wallet = await UniversalProvider.init({
          ...TEST_PROVIDER_OPTS,
          name: "wallet",
        });

        const requestedRequiredNamespaces = {
          eip155: {
            chains: ["eip155:1", "eip155:2"],
            methods: ["eth_sendTransaction", "eth_sign"],
            events: ["chainChanged", "accountsChanged"],
          },
        };
        let uri;
        dapp.on("display_uri", (connectionUri: string) => {
          uri = connectionUri;
        });
        dapp.connect({
          namespaces: requestedRequiredNamespaces,
        });
        expect(dapp.optionalNamespaces).to.eql(requestedRequiredNamespaces);
        while (!uri) {
          await new Promise((resolve) => setTimeout(resolve, 100));
        }

        await Promise.all([
          new Promise<void>((resolve) => {
            wallet.client.on("session_proposal", (proposal) => {
              const { requiredNamespaces, optionalNamespaces } = proposal.params;
              expect(requiredNamespaces).to.eql({});
              expect(optionalNamespaces).to.eql(requestedRequiredNamespaces);
              resolve();
            });
          }),
          wallet.client.pair({ uri }),
        ]);
        await deleteProviders({ A: dapp, B: wallet });
      });
    });
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
        await web3.eth.sendTransaction(TEST_ETH_TRANSFER);
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
        const message = "Hello world";
        const encodedMessage = `0x${Buffer.from("Hello world").toString("hex")}`;
        const signature = (await web3.currentProvider?.request({
          method: "personal_sign",
          params: [encodedMessage, walletAddress],
        })) as unknown as string;
        const verify = ethers.verifyMessage(message, signature);
        expect(verify).eq(walletAddress);
      });
      it("sign transaction and send via sendAsync", async () => {
        const balanceBefore = BigInt(await web3.eth.getBalance(walletAddress));
        const { rawTransaction } = await web3.eth.accounts.signTransaction(
          { ...TEST_SIGN_TRANSACTION, from: walletAddress },
          walletClient.signer.privateKey,
        );
        await new Promise<void>((resolve) => {
          const callback = async (_error: any, result: any) => {
            expect(!!result).to.be.true;
            const balanceAfter = BigInt(await web3.eth.getBalance(walletAddress));
            expect(balanceAfter < balanceBefore).to.be.true;
            resolve();
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
    });
    describe("Ethers", () => {
      let web3Provider: ethers.BrowserProvider;
      beforeAll(async () => {
        web3Provider = new ethers.BrowserProvider(provider);
        await web3Provider.send("hardhat_setBalance", [
          walletAddress, // the address to fund
          "0xDE0B6B3A7640000", // 1 ETH in hex (wei)
        ]);
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
        const transferTx = await signer.sendTransaction({
          ...TEST_ETH_TRANSFER,
        });
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
        const signer = await web3Provider.getSigner();
        const signature = await signer.signMessage(msg);
        const verify = ethers.verifyMessage(msg, signature);
        expect(verify).eq(walletAddress);
      });
    });
  });
  describe("cosmos", () => {
    it("should sign mocked cosmos_signDirect request", async () => {
      // cosmos_signDirect params
      const params = {
        signerAddress: "0x",
        signDoc: "0x",
      };

      const result = await provider.request<{ signature: string }>(
        {
          method: "cosmos_signDirect",
          params,
        },
        `cosmos:${CHAIN_ID}`,
      );
      expect(result.signature).to.eq("0xdeadbeef");
    });
  });
  describe("persistence", () => {
    describe("after restart", () => {
      it("clients can ping each other", async () => {
        const dappDbName = getDbName(`dappDB-${Date.now()}`);
        const walletDbName = getDbName(`walletDB-${Date.now()}`);
        const dapp = await UniversalProvider.init({
          ...TEST_PROVIDER_OPTS,
          name: "dapp",
          storageOptions: { database: dappDbName },
        });
        const wallet = await UniversalProvider.init({
          ...TEST_PROVIDER_OPTS,
          name: "wallet",
          storageOptions: { database: walletDbName },
        });
        const chains = [`eip155:${CHAIN_ID}`, `eip155:${CHAIN_ID_B}`];
        const { sessionA } = await testConnectMethod(
          {
            dapp,
            wallet,
          },
          {
            requiredNamespaces: {},
            optionalNamespaces: {},
            namespaces: {
              eip155: {
                accounts: chains.map((chain) => `${chain}:${walletAddress}`),
                chains,
                methods,
                events,
              },
            },
          },
        );
        wallet.session = sessionA;
        const topic = sessionA.topic;

        await Promise.all([
          new Promise((resolve) => {
            // ping
            dapp.on("session_ping", (event: any) => {
              resolve(event);
            });
          }),
          new Promise((resolve) => {
            wallet.on("session_ping", (event: any) => {
              resolve(event);
            });
          }),
          new Promise(async (resolve) => {
            // ping
            await dapp.client.ping({ topic });
            await wallet.client.ping({ topic });
            resolve(true);
          }),
        ]);

        const chainId = await dapp.request({ method: "eth_chainId" });
        const addresses = (await dapp.request({ method: "eth_accounts" })) as string[];
        // delete
        await deleteProviders({ A: dapp, B: wallet });
        // restart
        const afterDapp = await UniversalProvider.init({
          ...TEST_PROVIDER_OPTS,
          name: "dapp",
          storageOptions: { database: dappDbName },
        });
        const afterWallet = await UniversalProvider.init({
          ...TEST_PROVIDER_OPTS,
          name: "wallet",
          storageOptions: { database: walletDbName },
        });

        // ping
        await afterDapp.client.ping({ topic });
        await afterWallet.client.ping({ topic });

        const chainIdAfter = await afterDapp.request({ method: "eth_chainId" });
        expect(chainId).to.eq(chainIdAfter);
        await validateProvider({
          provider: afterDapp,
          addresses,
        });
        // delete
        await deleteProviders({ A: afterDapp, B: afterWallet });
      });

      it("should reload provider data after restart", async () => {
        const dappDbName = getDbName(`dappDB-${Date.now()}`);
        const walletDbName = getDbName(`walletDB-${Date.now()}`);
        const dapp = await UniversalProvider.init({
          ...TEST_PROVIDER_OPTS,
          name: "dapp",
          storageOptions: { database: dappDbName },
        });
        const wallet = await UniversalProvider.init({
          ...TEST_PROVIDER_OPTS,
          name: "wallet",
          storageOptions: { database: walletDbName },
        });

        const {
          sessionA: { topic },
        } = await testConnectMethod({ dapp, wallet });

        const rpcProviders = dapp.rpcProviders.eip155.httpProviders;
        expect(!!topic).to.be.true;

        let ethersProvider = new ethers.BrowserProvider(dapp);
        const accounts = await ethersProvider.listAccounts();
        expect(!!accounts).to.be.true;

        // delete
        await deleteProviders({ A: dapp, B: wallet });

        // restart
        const afterDapp = await UniversalProvider.init({
          ...TEST_PROVIDER_OPTS,
          name: "afterDapp",
          storageOptions: { database: dappDbName },
        });

        // load the provider in ethers without new pairing
        ethersProvider = new ethers.BrowserProvider(afterDapp);
        const afterAccounts = await ethersProvider.listAccounts();
        expect(accounts).to.toMatchObject(afterAccounts);
        const afterRpcProviders = afterDapp.rpcProviders.eip155.httpProviders;
        expect(rpcProviders).to.toMatchObject(afterRpcProviders);
        await validateProvider({
          provider: afterDapp,
        });
        // delete
        await disconnectSocket(afterDapp.client.core);
      });
    });
    describe("pairings", () => {
      it.skip("should clean up inactive pairings", async () => {
        const SUBS_ON_START = provider.client.core.relayer.subscriber.subscriptions.size;
        const PAIRINGS_TO_CREATE = 5;
        for (let i = 0; i < PAIRINGS_TO_CREATE; i++) {
          const { uri } = await provider.client.connect({
            requiredNamespaces: TEST_REQUIRED_NAMESPACES,
          });

          expect(!!uri).to.be.true;
          expect(uri).to.be.a("string");
          expect(provider.client.pairing.getAll({ active: false }).length).to.eql(i + 1);
        }
        const EXPECTED_SUBS = PAIRINGS_TO_CREATE + SUBS_ON_START;
        expect(provider.client.core.relayer.subscriber.subscriptions.size).to.eql(EXPECTED_SUBS);
        await provider.cleanupPendingPairings();
        expect(provider.client.core.relayer.subscriber.subscriptions.size).to.eql(1);
      });
    });
    describe("call status", () => {
      it("should get call status request to wallet when bundler id is not provided", async () => {
        const dapp = await UniversalProvider.init({
          ...TEST_PROVIDER_OPTS,
          name: "dapp",
        });
        const wallet = await UniversalProvider.init({
          ...TEST_PROVIDER_OPTS,
          name: "wallet",
        });
        const chains = ["eip155:1"];
        await testConnectMethod(
          {
            dapp,
            wallet,
          },
          {
            requiredNamespaces: {
              eip155: {
                chains,
                methods: ["wallet_getCallsStatus"],
                events,
              },
            },
            optionalNamespaces: {
              eip155: {
                chains,
                methods: ["wallet_getCallsStatus"],
                events,
              },
            },
            namespaces: {
              eip155: {
                accounts: chains.map((chain) => `${chain}:${walletAddress}`),
                chains,
                methods: ["wallet_getCallsStatus"],
                events,
              },
            },
          },
        );
        const testResult = { result: "test result " };
        await Promise.all([
          new Promise<void>((resolve) => {
            wallet.client.on("session_request", async (event) => {
              expect(event.params.request.method).to.eql("wallet_getCallsStatus");
              await wallet.client.respond({
                topic: event.topic,
                response: formatJsonRpcResult(event.id, testResult),
              });
              resolve();
            });
          }),
          new Promise<void>(async (resolve) => {
            const result = await dapp.request({
              method: "wallet_getCallsStatus",
              params: ["test params"],
            });
            expect(result).to.eql(testResult);
            resolve();
          }),
        ]);
      });
      it("should get call status request to bundler when custom bundler url is provided", async () => {
        const dapp = await UniversalProvider.init({
          ...TEST_PROVIDER_OPTS,
          name: "dapp",
        });
        const wallet = await UniversalProvider.init({
          ...TEST_PROVIDER_OPTS,
          name: "wallet",
        });
        const chains = ["eip155:1"];
        const customBundlerUrl = "https://custom-bundler.com";
        await testConnectMethod(
          {
            dapp,
            wallet,
          },
          {
            requiredNamespaces: {
              eip155: {
                chains,
                methods: ["wallet_getCallsStatus"],
                events,
              },
            },
            optionalNamespaces: {
              eip155: {
                chains,
                methods: ["wallet_getCallsStatus"],
                events,
              },
            },
            namespaces: {
              eip155: {
                accounts: chains.map((chain) => `${chain}:${walletAddress}`),
                chains,
                methods: ["wallet_getCallsStatus"],
                events,
              },
            },
            sessionProperties: { bundler_url: customBundlerUrl },
          },
        );
        const testResult = { result: "test result " };
        // @ts-ignore
        dapp.rpcProviders.eip155.getUserOperationReceipt = (bundlerUrl: string, args: any) => {
          expect(bundlerUrl).to.eql(customBundlerUrl);
          expect(args.request.method).to.eql("wallet_getCallsStatus");
          return testResult;
        };
        await Promise.all([
          new Promise<void>(async (resolve) => {
            const result = await dapp.request({
              method: "wallet_getCallsStatus",
              params: ["test params"],
            });
            expect(result).to.eql(testResult);
            resolve();
          }),
        ]);
      });
      it("should get call status request to bundler when bundler name is provided", async () => {
        const dapp = await UniversalProvider.init({
          ...TEST_PROVIDER_OPTS,
          name: "dapp",
        });
        const wallet = await UniversalProvider.init({
          ...TEST_PROVIDER_OPTS,
          name: "wallet",
        });
        const chains = ["eip155:1"];
        await testConnectMethod(
          {
            dapp,
            wallet,
          },
          {
            requiredNamespaces: {
              eip155: {
                chains,
                methods: ["wallet_getCallsStatus"],
                events,
              },
            },
            optionalNamespaces: {
              eip155: {
                chains,
                methods: ["wallet_getCallsStatus"],
                events,
              },
            },
            namespaces: {
              eip155: {
                accounts: chains.map((chain) => `${chain}:${walletAddress}`),
                chains,
                methods: ["wallet_getCallsStatus"],
                events,
              },
            },
            sessionProperties: { bundler_name: "pimlico" },
          },
        );
        const testResult = { result: "test result " };
        // @ts-ignore
        dapp.rpcProviders.eip155.getUserOperationReceipt = (bundlerUrl: string, args: any) => {
          expect(bundlerUrl).to.include(BUNDLER_URL);
          expect(args.request.method).to.eql("wallet_getCallsStatus");
          return testResult;
        };
        await Promise.all([
          new Promise<void>(async (resolve) => {
            const result = await dapp.request({
              method: "wallet_getCallsStatus",
              params: ["test params"],
            });
            expect(result).to.eql(testResult);
            resolve();
          }),
        ]);
      });
      it("should get call status request to bundler and wallet when bundler url fails", async () => {
        const dapp = await UniversalProvider.init({
          ...TEST_PROVIDER_OPTS,
          name: "dapp",
        });
        const wallet = await UniversalProvider.init({
          ...TEST_PROVIDER_OPTS,
          name: "wallet",
        });
        const chains = ["eip155:1"];
        await testConnectMethod(
          {
            dapp,
            wallet,
          },
          {
            requiredNamespaces: {
              eip155: {
                chains,
                methods: ["wallet_getCallsStatus"],
                events,
              },
            },
            optionalNamespaces: {
              eip155: {
                chains,
                methods: ["wallet_getCallsStatus"],
                events,
              },
            },
            namespaces: {
              eip155: {
                accounts: chains.map((chain) => `${chain}:${walletAddress}`),
                chains,
                methods: ["wallet_getCallsStatus"],
                events,
              },
            },
            sessionProperties: { bundler_name: "pimlico" },
          },
        );
        const testResult = { result: "test result " };
        // @ts-ignore
        dapp.rpcProviders.eip155.getUserOperationReceipt = (bundlerUrl: string, args: any) => {
          throw new Error("Failed to fetch call status from bundler");
        };
        await Promise.all([
          new Promise<void>((resolve) => {
            wallet.client.on("session_request", async (event) => {
              expect(event.params.request.method).to.eql("wallet_getCallsStatus");
              await wallet.client.respond({
                topic: event.topic,
                response: formatJsonRpcResult(event.id, testResult),
              });
              resolve();
            });
          }),
          new Promise<void>(async (resolve) => {
            const result = await dapp.request({
              method: "wallet_getCallsStatus",
              params: ["test params"],
            });
            expect(result).to.eql(testResult);
            resolve();
          }),
        ]);
      });
      it("should receive rejection on get call status request when no bundler url or method is not approved", async () => {
        await expect(
          provider.request({
            method: "wallet_getCallsStatus",
            params: ["test params"],
          }),
        ).rejects.toThrowError("Fetching call status not approved by the wallet.");
      });
    });
    describe("caip validation", () => {
      it("should reload after restart", async () => {
        const dappDbName = getDbName(`dappDB-${Date.now()}`);
        const dapp = await UniversalProvider.init({
          ...TEST_PROVIDER_OPTS,
          storageOptions: { database: dappDbName },
          name: "dapp",
        });
        const wallet = await UniversalProvider.init({
          ...TEST_PROVIDER_OPTS,
          name: "wallet",
        });
        const chains = ["eip155:1"];
        await testConnectMethod(
          {
            dapp,
            wallet,
          },
          {
            requiredNamespaces: {
              [chains[0]]: {
                methods,
                events,
                chains,
              },
            },
            namespaces: {
              eip155: {
                accounts: chains.map((chain) => `${chain}:${walletAddress}`),
                chains,
                methods,
                events,
              },
            },
          },
        );
        await validateProvider({
          provider: dapp,
          chains,
          addresses: [walletAddress],
          expectedChainId: chains[0],
        });
        // delete
        await deleteProviders({ A: dapp, B: wallet });

        // restart
        const afterDapp = await UniversalProvider.init({
          ...TEST_PROVIDER_OPTS,
          storageOptions: { database: dappDbName },
          name: "dapp",
        });

        await validateProvider({
          provider: afterDapp,
          chains,
          addresses: [walletAddress],
          expectedChainId: chains[0],
        });
      });
      it("should reload after restart with correct chain", async () => {
        const dappDbName = getDbName(`dappDB-${Date.now()}`);
        const dapp = await UniversalProvider.init({
          ...TEST_PROVIDER_OPTS,
          storageOptions: { database: dappDbName },
          name: "dapp",
        });
        const wallet = await UniversalProvider.init({
          ...TEST_PROVIDER_OPTS,
          name: "wallet",
        });
        const chains = ["eip155:1", "eip155:2"];
        await testConnectMethod(
          {
            dapp,
            wallet,
          },
          {
            requiredNamespaces: {
              "eip155:1": {
                methods,
                events,
              },
              "eip155:2": {
                methods,
                events,
              },
            },
            namespaces: {
              eip155: {
                accounts: chains.map((chain) => `${chain}:${walletAddress}`),
                chains,
                methods,
                events,
              },
            },
          },
        );
        await validateProvider({
          provider: dapp,
          chains,
          addresses: [walletAddress],
          expectedChainId: chains[0],
        });
        // switch chain to eip155:2
        await dapp.request({ method: "wallet_switchEthereumChain", params: [{ chainId: "0x2" }] });
        // delete
        await deleteProviders({ A: dapp, B: wallet });

        // restart
        const afterDapp = await UniversalProvider.init({
          ...TEST_PROVIDER_OPTS,
          storageOptions: { database: dappDbName },
          name: "dapp",
        });

        await validateProvider({
          provider: afterDapp,
          chains,
          addresses: [walletAddress],
          expectedChainId: chains[1],
        });
      });
    });
  });
  describe("validation", () => {
    it("should not throw exception when setDefaultChain is called prematurely", async () => {
      const provider = await UniversalProvider.init(TEST_PROVIDER_OPTS);
      provider.setDefaultChain("eip155:1");
      // disconnect
      await disconnectSocket(provider.client.core);
    });
    describe("pairing", () => {
      it("should pair with configuration 1", async () => {
        const dapp = await UniversalProvider.init({
          ...TEST_PROVIDER_OPTS,
          name: "dapp",
        });
        const wallet = await UniversalProvider.init({
          ...TEST_PROVIDER_OPTS,
          name: "wallet",
        });
        const chains = ["eip155:1"];
        await testConnectMethod(
          {
            dapp,
            wallet,
          },
          {
            requiredNamespaces: {
              eip155: {
                methods,
                events,
                chains,
              },
            },
            namespaces: {
              [chains[0]]: {
                accounts: chains.map((chain) => `${chain}:${walletAddress}`),
                methods,
                events,
              },
            },
          },
        );
        await validateProvider({
          provider: dapp,
          chains,
          addresses: [walletAddress],
          expectedChainId: chains[0],
        });
      });
      it("should pair with configuration 2", async () => {
        const dapp = await UniversalProvider.init({
          ...TEST_PROVIDER_OPTS,
          name: "dapp",
        });
        const wallet = await UniversalProvider.init({
          ...TEST_PROVIDER_OPTS,
          name: "wallet",
        });
        const chains = ["eip155:1", "eip155:2"];
        await testConnectMethod(
          {
            dapp,
            wallet,
          },
          {
            requiredNamespaces: {
              eip155: {
                methods,
                events,
                chains,
              },
            },
            namespaces: {
              "eip155:1": {
                accounts: [`eip155:1:${walletAddress}`],
                methods,
                events,
              },
              "eip155:2": {
                accounts: [`eip155:2:${walletAddress}`],
                methods,
                events,
              },
            },
          },
        );
        await validateProvider({
          provider: dapp,
          chains,
          addresses: [walletAddress],
          expectedChainId: chains[0],
        });
      });
      it("should pair with configuration 3", async () => {
        const dapp = await UniversalProvider.init({
          ...TEST_PROVIDER_OPTS,
          name: "dapp",
        });
        const wallet = await UniversalProvider.init({
          ...TEST_PROVIDER_OPTS,
          name: "wallet",
        });

        const chains = ["eip155:1", "eip155:2"];

        await testConnectMethod(
          {
            dapp,
            wallet,
          },
          {
            requiredNamespaces: {
              eip155: {
                methods,
                events,
                chains,
              },
            },
            namespaces: {
              eip155: {
                accounts: [`eip155:1:${walletAddress}`],
                chains: ["eip155:1"],
                methods,
                events,
              },
              "eip155:2": {
                accounts: [`eip155:2:${walletAddress}`],
                methods,
                events,
              },
            },
          },
        );
        await validateProvider({
          provider: dapp,
          chains,
          addresses: [walletAddress],
          expectedChainId: chains[0],
        });
      });
      it("should pair with configuration 4", async () => {
        const dapp = await UniversalProvider.init({
          ...TEST_PROVIDER_OPTS,
          name: "dapp",
        });
        const wallet = await UniversalProvider.init({
          ...TEST_PROVIDER_OPTS,
          name: "wallet",
        });
        const chains = ["eip155:1", "eip155:2"];
        await testConnectMethod(
          {
            dapp,
            wallet,
          },
          {
            requiredNamespaces: {
              "eip155:1": {
                methods,
                events,
              },
              "eip155:2": {
                methods,
                events,
              },
            },
            namespaces: {
              eip155: {
                accounts: chains.map((chain) => `${chain}:${walletAddress}`),
                chains,
                methods,
                events,
              },
            },
          },
        );
        await dapp.request({ method: "wallet_switchEthereumChain", params: [{ chainId: "0x2" }] });
        await validateProvider({
          provider: dapp,
          chains,
          addresses: [walletAddress],
          expectedChainId: chains[1],
        });
      });
      it("should connect with empty required namespaces", async () => {
        const dapp = await UniversalProvider.init({
          ...TEST_PROVIDER_OPTS,
          name: "dapp",
        });
        const wallet = await UniversalProvider.init({
          ...TEST_PROVIDER_OPTS,
          name: "wallet",
        });
        const chains = ["eip155:1", "eip155:2"];
        await testConnectMethod(
          {
            dapp,
            wallet,
          },
          {
            requiredNamespaces: {},
            optionalNamespaces: {},
            namespaces: {
              eip155: {
                accounts: chains.map((chain) => `${chain}:${walletAddress}`),
                chains,
                methods,
                events,
              },
            },
          },
        );
        await dapp.request({ method: "wallet_switchEthereumChain", params: [{ chainId: "0x2" }] });
        await validateProvider({
          provider: dapp,
          chains,
          addresses: [walletAddress],
          expectedChainId: chains[1],
        });
      });
      it("should handle switch chain event on non required namespaces", async () => {
        const dapp = await UniversalProvider.init({
          ...TEST_PROVIDER_OPTS,
          name: "dapp",
        });
        const wallet = await UniversalProvider.init({
          ...TEST_PROVIDER_OPTS,
          name: "wallet",
        });
        const chains = ["eip155:1", "eip155:2"];
        const solanaChains = [
          "solana:91b171bb158e2d3848fa23a9f1c25182",
          "solana:4sGjMW1sUnHzSxGspuhpqLDx6wiyjNtZ",
        ];
        await testConnectMethod(
          {
            dapp,
            wallet,
          },
          {
            requiredNamespaces: {
              "eip155:1": {
                methods,
                events,
              },
            },
            optionalNamespaces: {},
            namespaces: {
              eip155: {
                accounts: chains.map((chain) => `${chain}:${walletAddress}`),
                methods,
                events,
              },
              solana: {
                accounts: solanaChains.map((chain) => `${chain}:${walletAddress}`),
                methods,
                events,
              },
            },
          },
        );
        const expectedChainId = solanaChains[1];
        await Promise.all([
          new Promise<void>((resolve) => {
            dapp.on("chainChanged", (chainId: any) => {
              expect(chainId).to.eql(expectedChainId.split(":")[1]);
              resolve();
            });
          }),
          wallet.client.emit({
            topic: dapp.session?.topic || "",
            event: {
              name: "chainChanged",
              data: expectedChainId,
            },
            chainId: expectedChainId,
          }),
        ]);

        await validateProvider({
          provider: dapp,
          chains: solanaChains,
          addresses: [walletAddress],
          defaultNamespace: "solana",
          expectedChainId,
        });
      });
      it("should handle requesting x & y as required & optional chains while wallet approves x + y + z", async () => {
        const dapp = await UniversalProvider.init({
          ...TEST_PROVIDER_OPTS,
          name: "dapp",
        });
        const wallet = await UniversalProvider.init({
          ...TEST_PROVIDER_OPTS,
          name: "wallet",
        });
        const chains = {
          eip155: ["eip155:1", "eip155:2"],
          solana: [
            "solana:4sGjMW1sUnHzSxGspuhpqLDx6wiyjNtZ",
            "solana:91b171bb158e2d3848fa23a9f1c25182",
          ],
          cosmos: ["cosmos:hub1", "cosmos:hub2"],
        };

        await testConnectMethod(
          {
            dapp,
            wallet,
          },
          {
            requiredNamespaces: {
              eip155: {
                chains: chains.eip155,
                methods,
                events,
              },
            },
            optionalNamespaces: {
              solana: {
                chains: chains.solana,
                methods,
                events,
              },
            },
            namespaces: {
              eip155: {
                accounts: chains.eip155.map((chain) => `${chain}:${walletAddress}`),
                methods,
                events,
              },
              solana: {
                accounts: chains.solana.map((chain) => `${chain}:${walletAddress}`),
                methods,
                events,
              },
              cosmos: {
                accounts: chains.cosmos.map((chain) => `${chain}:${walletAddress}`),
                methods,
                events,
              },
            },
          },
        );
        const expectedChainId = chains.solana[1];
        await Promise.all([
          new Promise<void>((resolve) => {
            dapp.on("chainChanged", (chainId: any) => {
              expect(chainId).to.eql(expectedChainId.split(":")[1]);
              resolve();
            });
          }),
          wallet.client.emit({
            topic: dapp.session?.topic || "",
            event: {
              name: "chainChanged",
              data: expectedChainId,
            },
            chainId: expectedChainId,
          }),
        ]);

        // validate that provider is created for each approed namespace
        expect(Object.keys(dapp.rpcProviders).length).to.eql(Object.keys(chains).length);

        await validateProvider({
          provider: dapp,
          chains: chains.solana,
          addresses: [walletAddress],
          defaultNamespace: "solana",
          expectedChainId,
        });
      });
      it("should reject connect on proposal expiry", async () => {
        const dapp = await UniversalProvider.init({
          ...TEST_PROVIDER_OPTS,
          name: "dapp",
        });

        await Promise.all([
          new Promise<void>(async (resolve) => {
            await dapp.connect({}).catch((error) => {
              expect(error.message).to.eql("Proposal expired");
              expect(dapp.client.events.listenerCount("proposal_expire")).to.eql(0);
              resolve();
            });
          }),
          new Promise<void>(async (resolve) => {
            await throttle(2_000);
            expect(dapp.client.events.listenerCount("proposal_expire")).to.eql(1);
            const proposals = dapp.client.proposal.getAll();
            // force expiry of the proposal so the test doesn't wait for the default expiry time
            dapp.client.core.expirer.set(proposals[0].id, 0);
            resolve();
          }),
        ]);
      });
    });
  });

  describe("utils", () => {
    it("get global values", () => {
      const client = getGlobal("client");
      const events = getGlobal("events");
      const disableProviderPing = getGlobal("disableProviderPing");
      expect(client).to.be.an("object");
      expect(events).to.be.an("object");
      expect(disableProviderPing).to.eq(TEST_PROVIDER_OPTS.disableProviderPing);
    });
    it("set global values", () => {
      const client = getGlobal("client");
      const events = getGlobal("events");
      const disableProviderPing = getGlobal("disableProviderPing");
      expect(client).to.be.an("object");
      expect(events).to.be.an("object");
      expect(disableProviderPing).to.eq(TEST_PROVIDER_OPTS.disableProviderPing);
      // assign to opposite value
      const valueToUpdateWith = !TEST_PROVIDER_OPTS.disableProviderPing;
      // update global value
      setGlobal("disableProviderPing", valueToUpdateWith);
      expect(disableProviderPing).to.not.eq(valueToUpdateWith);
      expect(getGlobal("disableProviderPing")).to.eq(valueToUpdateWith);
    });
    it("should handle undefined global value", () => {
      const nonExistentGlobal = getGlobal("somethingsomething");
      expect(nonExistentGlobal).to.be.undefined;
    });
    it("should generate rpc provider urls", async () => {
      const dapp = await UniversalProvider.init({
        ...TEST_PROVIDER_OPTS,
        name: "dapp",
      });
      const wallet = await UniversalProvider.init({
        ...TEST_PROVIDER_OPTS,
        name: "wallet",
      });
      const namespace = "solana";
      const chains = [
        `${namespace}:4sGjMW1sUnHzSxGspuhpqLDx6wiyjNtZ`,
        `${namespace}:8E9rvCKLFQia2Y35HXjjpWzj8weVo44K`,
      ];
      await testConnectMethod(
        {
          dapp,
          wallet,
        },
        {
          requiredNamespaces: {},
          optionalNamespaces: {},
          namespaces: {
            [namespace]: {
              accounts: chains.map((chain) => `${chain}:${walletAddress}`),
              chains,
              methods,
              events,
            },
          },
        },
      );
      await throttle(1_000);

      const httpProviders = dapp.rpcProviders[namespace].httpProviders;

      expect(Object.keys(httpProviders).length).is.greaterThan(0);
      expect(Object.keys(httpProviders).length).to.eql(chains.length);

      Object.values(httpProviders).forEach((provider, i) => {
        const url = provider.connection.url as string;
        expect(url).to.include("https://");
        expect(url).to.include(RPC_URL);
        expect(url).to.eql(getRpcUrl(chains[i], {} as Namespace, TEST_PROVIDER_OPTS.projectId));
      });

      expect(httpProviders["4sGjMW1sUnHzSxGspuhpqLDx6wiyjNtZ"].connection.url).to.eql(
        `https://rpc.walletconnect.org/v1/?chainId=solana:4sGjMW1sUnHzSxGspuhpqLDx6wiyjNtZ&projectId=${TEST_PROVIDER_OPTS.projectId}`,
      );
      expect(httpProviders["8E9rvCKLFQia2Y35HXjjpWzj8weVo44K"].connection.url).to.eql(
        `https://rpc.walletconnect.org/v1/?chainId=solana:8E9rvCKLFQia2Y35HXjjpWzj8weVo44K&projectId=${TEST_PROVIDER_OPTS.projectId}`,
      );

      // @ts-expect-error - private property
      const firstProvider = dapp.rpcProviders[namespace].getHttpProvider(chains[0]);
      expect(firstProvider).to.deep.equal(httpProviders["4sGjMW1sUnHzSxGspuhpqLDx6wiyjNtZ"]);
      // @ts-expect-error - private property
      const secondProvider = dapp.rpcProviders[namespace].getHttpProvider(chains[1]);
      expect(secondProvider).to.deep.equal(httpProviders["8E9rvCKLFQia2Y35HXjjpWzj8weVo44K"]);

      await deleteProviders({ A: dapp, B: wallet });
    });
    it("should init generic provider if provider for given namespace doesn't exist", async () => {
      const dapp = await UniversalProvider.init({
        ...TEST_PROVIDER_OPTS,
        name: "dapp",
      });
      const wallet = await UniversalProvider.init({
        ...TEST_PROVIDER_OPTS,
        name: "wallet",
      });
      const tronChains = [
        `tron:4sGjMW1sUnHzSxGspuhpqLDx6wiyjNtZ`,
        `tron:8E9rvCKLFQia2Y35HXjjpWzj8weVo44K`,
      ];
      const zoraChains = [`zora:1`, `zora:2`];
      await testConnectMethod(
        {
          dapp,
          wallet,
        },
        {
          requiredNamespaces: {},
          optionalNamespaces: {},
          namespaces: {
            tron: {
              accounts: tronChains.map((chain) => `${chain}:${walletAddress}`),
              chains: tronChains,
              methods,
              events,
            },
            zora: {
              accounts: zoraChains.map((chain) => `${chain}:${walletAddress}`),
              chains: zoraChains,
              methods,
              events,
            },
          },
        },
      );
      await throttle(1_000);
      expect(dapp.rpcProviders).to.be.an("object");
      expect(dapp.rpcProviders.zora).to.exist;
      expect(dapp.rpcProviders.zora).to.be.an("object");

      const zoraHttpProviders = dapp.rpcProviders.zora.httpProviders;

      expect(Object.keys(zoraHttpProviders).length).is.greaterThan(0);
      expect(Object.keys(zoraHttpProviders).length).to.eql(zoraChains.length);

      Object.values(zoraHttpProviders).forEach((provider, i) => {
        const url = provider.connection.url as string;
        expect(url).to.include("https://");
        expect(url).to.include(RPC_URL);
        expect(url).to.eql(getRpcUrl(zoraChains[i], {} as Namespace, TEST_PROVIDER_OPTS.projectId));
      });

      const tronHttpProviders = dapp.rpcProviders.tron.httpProviders;
      expect(Object.keys(tronHttpProviders).length).is.greaterThan(0);
      expect(Object.keys(tronHttpProviders).length).to.eql(tronChains.length);

      Object.values(tronHttpProviders).forEach((provider, i) => {
        const url = provider.connection.url as string;
        expect(url).to.include("https://");
        expect(url).to.include(RPC_URL);
        expect(url).to.eql(getRpcUrl(tronChains[i], {} as Namespace, TEST_PROVIDER_OPTS.projectId));
      });

      await deleteProviders({ A: dapp, B: wallet });
    });

    it("should gracefully handle invalid namespaces without chains/accounts", async () => {
      const dapp = await UniversalProvider.init({
        ...TEST_PROVIDER_OPTS,
        name: "dapp",
      });
      const wallet = await UniversalProvider.init({
        ...TEST_PROVIDER_OPTS,
        name: "wallet",
      });
      const optionalNamespaces = {
        eip155: {
          chains: ["eip155:1"],
          events: ["chainChanged"],
          methods: ["personal_sign", "eth_sendTransaction"],
        },
        bip122: {
          chains: ["bip122:000000000019d6689c085ae165831e93"],
          events: ["chainChanged"],
          methods: ["bip122_signTransaction"],
        },
      };
      await testConnectMethod(
        {
          dapp,
          wallet,
        },
        {
          requiredNamespaces: {},
          optionalNamespaces,
          namespaces: {
            bip122: {
              accounts: [],
              chains: [],
              methods: ["bip122_signTransaction"],
              events: ["chainChanged"],
            },
            eip155: {
              accounts: ["eip155:1:0x57f48fAFeC1d76B27e3f29b8d277b6218CDE6092"],
              chains: ["eip155:1"],
              methods: ["personal_sign", "eth_sendTransaction"],
              events: ["chainChanged"],
            },
          },
        },
      );
      await throttle(1_000);
      expect(dapp.rpcProviders).to.be.an("object");
      expect(dapp.rpcProviders.eip155).to.exist;
      expect(dapp.rpcProviders.eip155).to.be.an("object");
      // verify bip122 provider is not created
      expect(dapp.rpcProviders.bip122).to.not.exist;

      const httpProviders = dapp.rpcProviders.eip155.httpProviders;

      expect(Object.keys(httpProviders).length).is.greaterThan(0);

      await deleteProviders({ A: dapp, B: wallet });
    });

    it("should switch btc account on bip122 chainChanged event", async () => {
      const dapp = await UniversalProvider.init({
        ...TEST_PROVIDER_OPTS,
        name: "dapp",
      });
      const wallet = await UniversalProvider.init({
        ...TEST_PROVIDER_OPTS,
        name: "wallet",
      });
      const optionalNamespaces = {
        bip122: {
          chains: [
            "bip122:000000000019d6689c085ae165831e91",
            "bip122:000000000019d6689c085ae165831e92",
          ],
          events: ["chainChanged"],
          methods: ["bip122_signTransaction"],
        },
      };
      const { sessionA } = await testConnectMethod(
        {
          dapp,
          wallet,
        },
        {
          requiredNamespaces: {},
          optionalNamespaces,
          namespaces: {
            bip122: {
              accounts: [
                "bip122:000000000019d6689c085ae165831e91:0x1",
                "bip122:000000000019d6689c085ae165831e92:0x2",
              ],
              chains: [
                "bip122:000000000019d6689c085ae165831e91",
                "bip122:000000000019d6689c085ae165831e92",
              ],
              methods: ["bip122_signTransaction"],
              events: ["chainChanged"],
            },
          },
        },
      );
      let chainChangedCount = 0;
      let accountsChangedCount = 0;
      dapp.on("chainChanged", (chainId) => {
        expect(chainId).to.eql("000000000019d6689c085ae165831e92");
        chainChangedCount++;
      });
      dapp.on("accountsChanged", (accounts) => {
        expect(accounts).to.eql(["0x2"]);
        accountsChangedCount++;
      });

      await wallet.client.emit({
        event: {
          name: "chainChanged",
          data: "000000000019d6689c085ae165831e92",
        },
        chainId: "bip122:000000000019d6689c085ae165831e92",
        topic: sessionA.topic,
      });

      await throttle(2_000);

      expect(chainChangedCount).to.eql(1);
      expect(accountsChangedCount).to.eql(1);

      await deleteProviders({ A: dapp, B: wallet });
    });

    it("should set default chain on generic providers", async () => {
      const dapp = await UniversalProvider.init({
        ...TEST_PROVIDER_OPTS,
        name: "dapp",
      });
      const wallet = await UniversalProvider.init({
        ...TEST_PROVIDER_OPTS,
        name: "wallet",
      });
      const optionalNamespaces = {
        bip122: {
          chains: ["bip122:000000000019d6689c085ae165831e93"],
          events: ["chainChanged"],
          methods: ["bip122_signTransaction"],
        },
        zora: {
          chains: ["zora:1"],
          events: ["chainChanged"],
          methods: ["zora_signTransaction"],
        },
      };
      await testConnectMethod(
        {
          dapp,
          wallet,
        },
        {
          requiredNamespaces: {},
          optionalNamespaces,
          namespaces: {
            bip122: {
              accounts: [
                "bip122:000000000019d6689c085ae165831e93:0x57f48fAFeC1d76B27e3f29b8d277b6218CDE6092",
              ],
              chains: ["bip122:000000000019d6689c085ae165831e93"],
              methods: ["bip122_signTransaction"],
              events: ["chainChanged"],
            },
            zora: {
              accounts: ["zora:1:0x57f48fAFeC1d76B27e3f29b8d277b6218CDE6092"],
              chains: ["zora:1"],
              methods: ["zora_signTransaction"],
              events: ["chainChanged"],
            },
          },
        },
      );
      await throttle(1_000);
      dapp.setDefaultChain("bip122:000000000019d6689c085ae165831e93");
      expect(dapp.rpcProviders.bip122.getDefaultChain()).to.eql("000000000019d6689c085ae165831e93");
      expect(Object.keys(dapp.rpcProviders.bip122.httpProviders)).to.eql([
        "000000000019d6689c085ae165831e93",
      ]);
      dapp.setDefaultChain("zora:1");
      expect(dapp.rpcProviders.zora.getDefaultChain()).to.eql("1");
      expect(Object.keys(dapp.rpcProviders.zora.httpProviders)).to.eql(["1"]);
      await deleteProviders({ A: dapp, B: wallet });
    });
  });
});

type ValidateProviderParams = {
  provider: UniversalProvider;
  defaultNamespace?: string;
  addresses?: string[];
  chains?: string[];
  expectedChainId?: string;
};
const validateProvider = async (params: ValidateProviderParams) => {
  const { provider, defaultNamespace = "eip155", addresses, chains, expectedChainId } = params;
  if (!provider.client.core.relayer.connected) {
    await new Promise<void>((resolve) => {
      provider.client.core.relayer.once(RELAYER_EVENTS.connect, () => {
        resolve();
      });
    });
  }

  expect(provider.client.core.relayer.connected).to.be.true;
  const accounts = (await provider.request({ method: "eth_accounts" })) as string[];
  expect(accounts).to.be.an("array");
  expect(accounts.length).to.be.greaterThan(0);
  expect(accounts[0]).to.be.a("string");
  if (addresses) {
    expect(accounts).to.toMatchObject(addresses);
  }

  if (chains) {
    expect(Object.keys(provider.rpcProviders[defaultNamespace].httpProviders)).to.toMatchObject(
      chains.map((c) => c.split(":")[1]),
    );
  }
  if (expectedChainId) {
    const chainId = provider.rpcProviders[defaultNamespace].getDefaultChain();
    expect(chainId).to.not.be.null;
    expect(expectedChainId).to.equal(`${defaultNamespace}:${chainId}`);
    if (chains) {
      expect(chains).to.include(`${defaultNamespace}:${chainId}`);
    }
  }
};
