import { expect, describe, it, beforeAll, afterAll } from "vitest";
import Web3 from "web3";
import { BigNumber, providers, utils } from "ethers";
import { TestNetwork } from "ethereum-test-network";
import {
  ERC20Token__factory,
  _abi,
  _bytecode,
} from "ethereum-test-network/lib/utils/ERC20Token__factory";
import { deleteProviders, testConnectMethod, WalletClient } from "./shared";
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
} from "./shared/constants";

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
        const callback = async (_error: any, result: any) => {
          expect(!!result).to.be.true;
          const balanceAfter = BigNumber.from(await web3.eth.getBalance(walletAddress));
          expect(balanceAfter.lt(balanceBefore)).to.be.true;
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
  describe("persistence", () => {
    describe("after restart", () => {
      it("clients can ping each other", async () => {
        const dapp = await UniversalProvider.init({
          ...TEST_PROVIDER_OPTS,
          name: "dapp",
          storageOptions: { database: "/tmp/dappDB" },
        });
        const wallet = await UniversalProvider.init({
          ...TEST_PROVIDER_OPTS,
          name: "wallet",
          storageOptions: { database: "/tmp/walletDB" },
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
          storageOptions: { database: "/tmp/dappDB" },
        });
        const afterWallet = await UniversalProvider.init({
          ...TEST_PROVIDER_OPTS,
          name: "wallet",
          storageOptions: { database: "/tmp/walletDB" },
        });

        // ping
        await afterDapp.client.ping({ topic });
        await afterWallet.client.ping({ topic });
        // delete
        await deleteProviders({ A: afterDapp, B: afterWallet });
      });
    });
  });
});
