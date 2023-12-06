import { expect, describe, it, beforeAll, afterAll } from "vitest";
import Web3 from "web3";
import { BigNumber, providers, utils } from "ethers";
import { TestNetwork } from "ethereum-test-network";
import { formatDirectSignDoc, stringifySignDocValues, verifyDirectSignature } from "cosmos-wallet";
import {
  ERC20Token__factory,
  _abi,
  _bytecode,
} from "ethereum-test-network/lib/utils/ERC20Token__factory";
import {
  deleteProviders,
  disconnectSocket,
  testConnectMethod,
  throttle,
  WalletClient,
} from "./shared";
import UniversalProvider, { Namespace } from "../src";
import {
  CHAIN_ID,
  PORT,
  TEST_NAMESPACES_CONFIG,
  ACCOUNTS,
  TEST_PROVIDER_OPTS,
  TEST_WALLET_CLIENT_OPTS,
  TEST_ETH_TRANSFER,
  TEST_SIGN_TRANSACTION,
  CHAIN_ID_B,
  TEST_REQUIRED_NAMESPACES,
} from "./shared/constants";
import { getChainId, getGlobal, getRpcUrl, setGlobal } from "../src/utils";
import { RPC_URL } from "../src/constants";

const getDbName = (_prefix: string) => {
  return `./test/tmp/${_prefix}.db`;
};

const methods = ["personal_sign"];
const events = ["chainChanged"];

describe("UniversalProvider", function () {
  let testNetwork: TestNetwork;
  let provider: UniversalProvider;
  let walletClient: WalletClient;
  let walletAddress: string;
  let receiverAddress: string;
  beforeAll(async () => {
    testNetwork = await TestNetwork.init({
      chainId: CHAIN_ID,
      port: PORT,
      genesisAccounts: [ACCOUNTS.a, ACCOUNTS.b],
    });
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
    // close test network
    await testNetwork.close();
    // disconnect provider
    await Promise.all([
      new Promise<void>((resolve) => {
        provider.on("session_delete", () => {
          resolve();
        });
      }),
      new Promise<void>(async (resolve) => {
        await walletClient.disconnect();
        resolve();
      }),
    ]);
    expect(walletClient.client?.session.values.length).to.eql(0);
    await throttle(1_000);
    await provider.client.core.relayer.transportClose();
    await walletClient.client?.core.relayer.transportClose();
  });

  describe("eip155", () => {
    describe("multi chain", () => {
      let web3: Web3;
      beforeAll(() => {
        web3 = new Web3(provider);
      });
      it("should change default chainId", async () => {
        const chainId = await web3.eth.getChainId();
        expect(chainId).to.eql(CHAIN_ID);

        provider.setDefaultChain(`eip155:${CHAIN_ID_B}`);

        const chainIdB = await web3.eth.getChainId();
        expect(chainIdB).to.not.eql(CHAIN_ID);
        expect(chainIdB).to.eql(CHAIN_ID_B);

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
        expect(activeChain).to.eql(CHAIN_ID);

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
        expect(activeChainAfterSwitch).to.eql(chainToSwitchParsed);

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
    });
    describe("Web3", () => {
      let web3: Web3;
      beforeAll(() => {
        web3 = new Web3(provider);
      });
      it("matches accounts", async () => {
        const accounts = await web3.eth.getAccounts();
        expect(accounts[0]).to.include(walletAddress);
      });
      it("matches chainId", async () => {
        const chainId = await web3.eth.getChainId();
        expect(chainId).to.eql(CHAIN_ID);
      });
      it("ERC20 contract", async () => {
        const erc20Factory = new web3.eth.Contract(JSON.parse(JSON.stringify(_abi)));
        const erc20 = await erc20Factory
          .deploy({ data: _bytecode, arguments: ["The test token", "tst", 18] })
          .send({ from: walletAddress });
        const balanceToMint = utils.parseEther("2");
        const mintTx = erc20.methods.mint(walletAddress, balanceToMint.toHexString());
        await mintTx.send({ from: walletAddress });
        const balance = await erc20.methods.balanceOf(walletAddress).call();
        expect(BigNumber.from(balance).toString()).to.eql(balanceToMint.toString());
        const transferTx = erc20.methods.transfer(
          receiverAddress,
          utils.parseEther("1").toHexString(),
        );
        const tokenTransferGas = await transferTx.estimateGas({ from: walletAddress });
        expect(tokenTransferGas.toString()).to.eql("52437");
        await transferTx.send({ from: walletAddress });
        const tokenBalanceA = await erc20.methods.balanceOf(walletAddress).call();
        expect(tokenBalanceA).to.eql(utils.parseEther("1").toString());
        const tokenBalanceB = await erc20.methods.balanceOf(receiverAddress).call();
        expect(tokenBalanceB).to.eql(utils.parseEther("1").toString());
      });
      it("estimate gas", async () => {
        const ethTransferGas = await web3.eth.estimateGas(TEST_ETH_TRANSFER);
        expect(ethTransferGas.toString()).to.eql("21001");
      });
      it("send transaction", async () => {
        const balanceBefore = BigNumber.from(await web3.eth.getBalance(walletAddress));
        await web3.eth.sendTransaction(TEST_ETH_TRANSFER);
        const balanceAfter = BigNumber.from(await web3.eth.getBalance(walletAddress));
        expect(
          balanceAfter.lt(balanceBefore),
          "balanceAfter " +
            balanceAfter.toString() +
            " less than balanceBefore: " +
            balanceBefore.toString(),
        ).to.be.true;
      });
      it("sign transaction", async () => {
        const balanceBefore = BigNumber.from(await web3.eth.getBalance(walletAddress));
        const { rawTransaction } = await web3.eth.accounts.signTransaction(
          TEST_SIGN_TRANSACTION,
          walletClient.signer.privateKey,
        );
        const broadcastTx = await provider.request({
          method: "eth_sendRawTransaction",
          params: [rawTransaction],
        });
        expect(!!broadcastTx).to.be.true;
        const balanceAfter = BigNumber.from(await web3.eth.getBalance(walletAddress));
        expect(balanceAfter.lt(balanceBefore)).to.be.true;
      });
      it("sign message", async () => {
        const msg = "Hello world";
        const signature = await web3.eth.sign(msg, walletAddress);
        const verify = utils.verifyMessage(msg, signature);
        expect(verify).eq(walletAddress);
      });
      it("sign transaction and send via sendAsync", async () => {
        const balanceBefore = BigNumber.from(await web3.eth.getBalance(walletAddress));
        const { rawTransaction } = await web3.eth.accounts.signTransaction(
          TEST_SIGN_TRANSACTION,
          walletClient.signer.privateKey,
        );
        await new Promise<void>((resolve) => {
          const callback = async (_error: any, result: any) => {
            expect(!!result).to.be.true;
            const balanceAfter = BigNumber.from(await web3.eth.getBalance(walletAddress));
            expect(balanceAfter.lt(balanceBefore)).to.be.true;
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
      let web3Provider: providers.Web3Provider;
      beforeAll(() => {
        web3Provider = new providers.Web3Provider(provider);
      });
      it("matches accounts", async () => {
        const accounts = await web3Provider.listAccounts();
        expect(accounts[0]).to.include(walletAddress);
      });
      it("matches chainId", async () => {
        const network = await web3Provider.getNetwork();
        expect(network.chainId).to.equal(CHAIN_ID);
      });
      it("ERC20 contract", async () => {
        const signer = web3Provider.getSigner();
        const erc20Factory = new ERC20Token__factory(signer as any);
        const erc20 = await erc20Factory.deploy("The test token", "tst", 18);
        await erc20.deployed();
        const balanceToMint = utils.parseEther("2");
        const mintTx = await erc20.mint(walletAddress, balanceToMint);
        await mintTx.wait(2);
        const tokenBalance = await erc20.balanceOf(walletAddress);
        expect(tokenBalance.toString()).to.eql(balanceToMint.toString());
        const tokenTransferGas = await erc20.estimateGas.transfer(
          receiverAddress,
          utils.parseEther("1"),
        );
        expect(tokenTransferGas.toString()).to.eql("52437");
        const transferTx = await erc20.transfer(receiverAddress, utils.parseEther("1"));
        await transferTx.wait(2);
        const tokenBalanceA = await erc20.balanceOf(walletAddress);
        expect(tokenBalanceA.toString()).to.eql(utils.parseEther("1").toString());
        const tokenBalanceB = await erc20.balanceOf(receiverAddress);
        expect(tokenBalanceB.toString()).to.eql(utils.parseEther("1").toString());
      });
      it("estimate gas", async () => {
        const ethTransferGas = await web3Provider.estimateGas(TEST_ETH_TRANSFER);
        // FIXME: returning 21001 instead of 21000
        expect(ethTransferGas.toString()).to.eql("21001");
      });
      it("send transaction", async () => {
        const balanceBefore = await web3Provider.getBalance(walletAddress);
        const signer = web3Provider.getSigner();
        const transferTx = await signer.sendTransaction(TEST_ETH_TRANSFER);
        await transferTx.wait(2);

        expect(!!transferTx.hash).to.be.true;
        const balanceAfter = await web3Provider.getBalance(walletAddress);
        expect(
          balanceAfter.lt(balanceBefore),
          "balanceAfter " +
            balanceAfter.toString() +
            " less than balanceBefore: " +
            balanceBefore.toString(),
        ).to.be.true;
      });
      it("sign message", async () => {
        const msg = "Hello world";
        const signature = await web3Provider
          .getSigner(walletClient.signer.address)
          .signMessage(msg);
        const verify = utils.verifyMessage(msg, signature);
        expect(verify).eq(walletAddress);
      });
    });
  });
  describe("cosmos", () => {
    it("should sign cosmos_signDirect request", async () => {
      // test direct sign doc inputs
      const inputs = {
        fee: [{ amount: "2000", denom: "ucosm" }],
        pubkey: "AgSEjOuOr991QlHCORRmdE5ahVKeyBrmtgoYepCpQGOW",
        gasLimit: 200000,
        accountNumber: 1,
        sequence: 1,
        bodyBytes:
          "0a90010a1c2f636f736d6f732e62616e6b2e763162657461312e4d736753656e6412700a2d636f736d6f7331706b707472653766646b6c366766727a6c65736a6a766878686c63337234676d6d6b38727336122d636f736d6f7331717970717870713971637273737a673270767871367273307a716733797963356c7a763778751a100a0575636f736d120731323334353637",
        authInfoBytes:
          "0a500a460a1f2f636f736d6f732e63727970746f2e736563703235366b312e5075624b657912230a21034f04181eeba35391b858633a765c4a0c189697b40d216354d50890d350c7029012040a020801180112130a0d0a0575636f736d12043230303010c09a0c",
      };

      // format sign doc
      const signDoc = formatDirectSignDoc(
        inputs.fee,
        inputs.pubkey,
        inputs.gasLimit,
        inputs.accountNumber,
        inputs.sequence,
        inputs.bodyBytes,
        "cosmoshub-4",
      );

      // cosmos_signDirect params
      const params = {
        signerAddress: await walletClient.cosmosWallet.getAddress(),
        signDoc: stringifySignDocValues(signDoc),
      };

      const result = await provider.request<{ signature: string }>(
        {
          method: "cosmos_signDirect",
          params,
        },
        `cosmos:${CHAIN_ID}`,
      );
      const valid = await verifyDirectSignature(
        await walletClient.cosmosWallet.getAddress(),
        result.signature,
        signDoc,
      );
      expect(valid).to.be.true;
    });
  });
  describe("persistence", () => {
    describe("after restart", () => {
      it("clients can ping each other", async () => {
        const dapp = await UniversalProvider.init({
          ...TEST_PROVIDER_OPTS,
          name: "dapp",
          storageOptions: { database: getDbName("dappDB") },
        });
        const wallet = await UniversalProvider.init({
          ...TEST_PROVIDER_OPTS,
          name: "wallet",
          storageOptions: { database: getDbName("walletDB") },
        });
        const chains = [`eip155:${CHAIN_ID}`, `eip155:${CHAIN_ID_B}`];
        const {
          sessionA: { topic },
        } = await testConnectMethod(
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
          storageOptions: { database: getDbName("dappDB") },
        });
        const afterWallet = await UniversalProvider.init({
          ...TEST_PROVIDER_OPTS,
          name: "wallet",
          storageOptions: { database: getDbName("walletDB") },
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
        const dapp = await UniversalProvider.init({
          ...TEST_PROVIDER_OPTS,
          name: "dapp",
          storageOptions: { database: getDbName("dappDB") },
        });
        const wallet = await UniversalProvider.init({
          ...TEST_PROVIDER_OPTS,
          name: "wallet",
          storageOptions: { database: getDbName("walletDB") },
        });

        const {
          sessionA: { topic },
        } = await testConnectMethod({ dapp, wallet });

        const rpcProviders = dapp.rpcProviders.eip155.httpProviders;
        expect(!!topic).to.be.true;

        let ethers = new providers.Web3Provider(dapp);
        const accounts = await ethers.listAccounts();
        expect(!!accounts).to.be.true;

        // delete
        await deleteProviders({ A: dapp, B: wallet });

        // restart
        const afterDapp = await UniversalProvider.init({
          ...TEST_PROVIDER_OPTS,
          name: "afterDapp",
          storageOptions: { database: getDbName("dappDB") },
        });

        // load the provider in ethers without new pairing
        ethers = new providers.Web3Provider(afterDapp);
        const afterAccounts = await ethers.listAccounts();
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
    describe("caip validation", () => {
      it("should reload after restart", async () => {
        const dapp = await UniversalProvider.init({
          ...TEST_PROVIDER_OPTS,
          storageOptions: { database: getDbName("dappDB") },
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
          storageOptions: { database: getDbName("dappDB") },
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
        const dapp = await UniversalProvider.init({
          ...TEST_PROVIDER_OPTS,
          storageOptions: { database: getDbName("dappDB") },
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
          storageOptions: { database: getDbName("dappDB") },
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
        expect(url).to.eql(
          getRpcUrl(getChainId(chains[i]), {} as Namespace, TEST_PROVIDER_OPTS.projectId),
        );
      });

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
  expect(provider.client.core.relayer.connected).to.be.true;
  const accounts = (await provider.request({ method: "eth_accounts" })) as string[];
  expect(accounts).to.be.an("array");
  expect(accounts.length).to.be.greaterThan(0);
  expect(accounts[0]).to.be.a("string");
  if (addresses) {
    expect(accounts).to.toMatchObject(addresses);
  }
  const chain = await provider.request({ method: "eth_chainId" });
  expect(chain).to.not.be.null;
  if (chains) {
    expect(chains).toContain(`${defaultNamespace}:${chain}`);
    expect(Object.keys(provider.rpcProviders[defaultNamespace].httpProviders)).to.toMatchObject(
      chains.map((c) => c.split(":")[1]),
    );
  }
  if (expectedChainId) {
    expect(expectedChainId).to.equal(`${defaultNamespace}:${chain}`);
  }
};
