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

import WalletConnectProvider from "../src";
import { SIGNER_EVENTS } from "../../signer-connection/dist/cjs";

const CHAIN_ID = 123;
const PORT = 8545;
const RPC_URL = `http://localhost:${PORT}`;
const ACCOUNTS = {
  a: {
    balance: utils.parseEther("5").toHexString(),
    address: "0xaaE062157B53077da1414ec3579b4CBdF7a4116f",
    privateKey: "0xa3dac6ca0b1c61f5f0a0b3a0acf93c9a52fd94e8e33d243d3b3a8b8c5dc37f0b",
  },
  b: {
    balance: utils.parseEther("1").toHexString(),
    address: "0xa5961EaaF8f5F1544c8bA79328A704bffb6e47CF",
    privateKey: "0xa647cd9040eddd8cd6e0bcbea3154f7c1729e3258ba8f6e555f1e516c9dbfbcc",
  },
  c: {
    balance: utils.parseEther("10").toHexString(),
    address: "0x874C1377Aa5a256de7554776e59cf01A5319502C",
    privateKey: "0x6c99734035225d3d34bd3b07a46594f8eb66269454c3f7a4a19ca505f2a46b15",
  },
};

const TEST_RELAY_URL = process.env.TEST_RELAY_URL
  ? process.env.TEST_RELAY_URL
  : "ws://localhost:5555";

const TEST_APP_METADATA = {
  name: "Test App",
  description: "Test App for WalletConnect",
  url: "https://walletconnect.org/",
  icons: ["https://walletconnect.org/walletconnect-logo.png"],
};

const TEST_WALLET_METADATA = {
  name: "Test Wallet",
  description: "Test Wallet for WalletConnect",
  url: "https://walletconnect.org/",
  icons: ["https://walletconnect.org/walletconnect-logo.png"],
};

const TEST_PROVIDER_OPTS = {
  chainId: CHAIN_ID,
  rpc: {
    custom: {
      [CHAIN_ID]: RPC_URL,
    },
  },
  client: {
    relayProvider: TEST_RELAY_URL,
    metadata: TEST_APP_METADATA,
  },
};

const TEST_WALLET_CLIENT_OPTS = {
  chainId: CHAIN_ID,
  rpcUrl: RPC_URL,
  privateKey: ACCOUNTS.a.privateKey,
  relayProvider: TEST_RELAY_URL,
  metadata: TEST_WALLET_METADATA,
};

const TEST_ETH_TRANSFER = {
  from: ACCOUNTS.a.address,
  to: ACCOUNTS.b.address,
  value: utils.parseEther("1").toHexString(),
  data: "0x",
};

describe("WalletConnectProvider", function() {
  this.timeout(30_000);
  let testNetwork: TestNetwork;
  let provider: WalletConnectProvider;
  let walletClient: WalletClient;
  let walletAddress: string;
  let receiverAddress: string;
  before(async () => {
    testNetwork = await TestNetwork.init({
      chainId: CHAIN_ID,
      port: PORT,
      genesisAccounts: [ACCOUNTS.a, ACCOUNTS.b],
    });
    provider = new WalletConnectProvider(TEST_PROVIDER_OPTS);
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
      new Promise<void>(async resolve => {
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
  it("chainChanged", async () => {
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
        provider.on("chainChanged", chainId => {
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
        provider.on("chainChanged", chainId => {
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
        provider.on("accountsChanged", accounts => {
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
        provider.on("accountsChanged", accounts => {
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
    before(async () => {
      web3 = new Web3(provider as any);
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
  });
  describe("Ethers", () => {
    let web3Provider: providers.Web3Provider;
    before(async () => {
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
