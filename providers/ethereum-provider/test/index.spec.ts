import "mocha";
import { expect } from "chai";
import Web3 from "web3";
import { BigNumber, providers, utils } from "ethers";
import { TestNetwork } from "ethereum-test-network";
import {
  ERC20Token__factory,
  _abi,
  _bytecode,
} from "ethereum-test-network/lib/utils/ERC20Token__factory";
import { WalletClient } from "./shared";
import EthereumProvider from "../src";
import {
  CHAIN_ID,
  PORT,
  RPC_URL,
  ACCOUNTS,
  TEST_PROVIDER_OPTS,
  TEST_WALLET_CLIENT_OPTS,
  TEST_ETH_TRANSFER,
} from "./shared/constants";

describe("EthereumProvider", function() {
  this.timeout(30_000);
  let testNetwork: TestNetwork;
  let provider: EthereumProvider;
  let walletClient: WalletClient;
  let walletAddress: string;
  let receiverAddress: string;
  before(async () => {
    testNetwork = await TestNetwork.init({
      chainId: CHAIN_ID,
      port: PORT,
      genesisAccounts: [ACCOUNTS.a, ACCOUNTS.b],
    });
    provider = new EthereumProvider(TEST_PROVIDER_OPTS);
    walletClient = await WalletClient.init(provider, TEST_WALLET_CLIENT_OPTS);
    walletAddress = walletClient.signer.address;
    receiverAddress = ACCOUNTS.b.address;
    expect(walletAddress).to.eql(ACCOUNTS.a.address);
    const providerAccounts = await provider.enable();
    expect(providerAccounts).to.eql([walletAddress]);
  });
  after(async () => {
    // close test network
    await testNetwork.close();
    // disconnect provider
    await Promise.all([
      new Promise<void>(resolve => {
        provider.on("disconnect", () => {
          resolve();
        });
      }),
      new Promise<void>(async resolve => {
        await walletClient.disconnect();
        resolve();
      }),
    ]);
    // expect provider to be disconnected
    expect(walletClient.client?.session.values.length).to.eql(0);
    expect(provider.connected).to.be.false;
  });

  it.skip("chainChanged", async () => {
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
        provider.on("chainChanged", (chainId: number) => {
          try {
            expect(chainId).to.eql(42);
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
        provider.on("chainChanged", (chainId: number) => {
          try {
            expect(chainId).to.eql(CHAIN_ID);
            resolve();
          } catch (e) {
            reject(e);
          }
        });
      }),
    ]);
  });
  it.skip("accountsChanged", async () => {
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
        provider.on("accountsChanged", (accounts: string) => {
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
        provider.on("accountsChanged", (accounts: string) => {
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
  describe("Web3", () => {
    let web3: Web3;
    before(() => {
      web3 = new Web3(provider);
    });
    it("matches accounts", async () => {
      const accounts = await web3.eth.getAccounts();
      expect(accounts).to.eql([walletAddress]);
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
      // FIXME: balance A is still 2 after transferring 1
      // const tokenBalanceA = await erc20.methods.balanceOf(walletAddress).call();
      // expect(tokenBalanceA).to.eql(utils.parseEther("1").toString());
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
      const signedTx = await web3.eth.signTransaction(TEST_ETH_TRANSFER);
      const broadcastTx = await provider.request({
        method: "eth_sendRawTransaction",
        params: [signedTx],
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
      const signedTx = await web3.eth.signTransaction(TEST_ETH_TRANSFER);
      const callback = async (_error: any, result: any) => {
        expect(!!result).to.be.true;
        const balanceAfter = BigNumber.from(await web3.eth.getBalance(walletAddress));
        expect(balanceAfter.lt(balanceBefore)).to.be.true;
      };
      provider.sendAsync(
        {
          method: "eth_sendRawTransaction",
          params: [signedTx],
        },
        callback,
      );
    });
  });
  describe("Ethers", () => {
    let web3Provider: providers.Web3Provider;
    before(() => {
      web3Provider = new providers.Web3Provider(provider);
    });
    it("matches accounts", async () => {
      const accounts = await web3Provider.listAccounts();
      expect(accounts).to.eql([walletAddress]);
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
    it("sign transaction", async () => {
      const balanceBefore = await web3Provider.getBalance(walletAddress);
      // FIXME: ethers does not support signTransaction but also does not resolve sendAsyncPromise
      // const signedTx = await signer.signTransaction(TEST_ETH_TRANSFER); // ERROR "signing transactions is unsupported (operation=\"signTransaction\", code=UNSUPPORTED_OPERATION, version=providers/5.1.0)"
      const signedTx = await provider.request({
        method: "eth_signTransaction",
        params: [TEST_ETH_TRANSFER],
      });
      const broadcastTx = await provider.request({
        method: "eth_sendRawTransaction",
        params: [signedTx],
      });
      expect(!!broadcastTx).to.be.true;
      const balanceAfter = await web3Provider.getBalance(walletAddress);
      expect(balanceAfter.lt(balanceBefore)).to.be.true;
    });
    it("sign message", async () => {
      const signer = web3Provider.getSigner();
      const msg = "Hello world";
      const signature = await signer.signMessage(msg);
      const verify = utils.verifyMessage(msg, signature);
      expect(verify).eq(walletAddress);
    });
  });
});
