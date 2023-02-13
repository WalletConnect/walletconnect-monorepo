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
import { deleteProviders, disconnectSocket, testConnectMethod, WalletClient } from "./shared";
import UniversalProvider from "../src";
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

const getDbName = (_prefix) => {
  return `./test/tmp/${_prefix}.db`;
};
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

        const {
          sessionA: { topic },
        } = await testConnectMethod({ dapp, wallet });

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

        expect(!!topic).to.be.true;

        let ethers = new providers.Web3Provider(dapp);
        const accounts = await ethers.listAccounts();
        expect(!!accounts).to.be.true;

        // delete
        await deleteProviders({ A: dapp, B: wallet });

        // restart
        const afterDapp = await UniversalProvider.init({
          ...TEST_PROVIDER_OPTS,
          name: "dapp",
          storageOptions: { database: getDbName("dappDB") },
        });

        // load the provider in ethers without new pairing
        ethers = new providers.Web3Provider(afterDapp);
        const afterAccounts = await ethers.listAccounts();
        expect(accounts).to.toMatchObject(afterAccounts);

        // delete
        await disconnectSocket(afterDapp.client.core);
      });
    });
    describe("pairings", () => {
      it("should clean up inactive pairings", async () => {
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
  });
  describe("validation", () => {
    it("should not throw exception when setDefaultChain is called prematurely", async () => {
      const provider = await UniversalProvider.init(TEST_PROVIDER_OPTS);
      provider.setDefaultChain("eip155:1");
      // disconnect
      await disconnectSocket(provider.client.core);
    });
  });
});
