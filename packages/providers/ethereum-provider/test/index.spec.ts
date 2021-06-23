import "mocha";
import { expect } from "chai";

import Web3 from "web3";
import { Wallet, providers, utils } from "ethers";
import { TestNetwork } from "ethereum-test-network";
import {
  ERC20Token__factory,
  _abi,
  _bytecode,
} from "ethereum-test-network/lib/utils/ERC20Token__factory";

import { WalletClient } from "./shared";

import WCEthereumProvider from "../src";

const CHAIN_ID = 123;
const PORT = 8546;
const RPC_URL = `http://localhost:${PORT}`;
const DEFAULT_GENESIS_ACCOUNTS = [
  {
    balance: "0x295BE96E64066972000000",
    privateKey: "0xa3dac6ca0b1c61f5f0a0b3a0acf93c9a52fd94e8e33d243d3b3a8b8c5dc37f0b", // 0xaaE062157B53077da1414ec3579b4CBdF7a4116f
  },
];

const TEST_PROVIDER_OPTS = {
  chainId: CHAIN_ID,
  qrcode: false,
  bridge: "https://polygon.bridge.walletconnect.org",
  rpc: {
    [CHAIN_ID]: RPC_URL,
  },
};

const TEST_WALLET_CLIENT_OPTS = {
  chainId: CHAIN_ID,
  rpcUrl: RPC_URL,
  privateKey: DEFAULT_GENESIS_ACCOUNTS[0].privateKey,
};

describe("WCEthereumProvider", function() {
  this.timeout(30_000);

  let testNetwork: TestNetwork;

  before(async () => {
    testNetwork = await TestNetwork.init({
      chainId: CHAIN_ID,
      port: PORT,
      genesisAccounts: DEFAULT_GENESIS_ACCOUNTS,
    });
  });

  after(async () => {
    await testNetwork.close();
  });

  it.skip("instantiate successfully", () => {
    const provider = new WCEthereumProvider(TEST_PROVIDER_OPTS);
    expect(!!provider).to.be.true;
  });

  describe("Web3", () => {
    let provider: WCEthereumProvider;
    let walletClient: WalletClient;
    let address: string;
    let web3: Web3;
    before(async () => {
      provider = new WCEthereumProvider(TEST_PROVIDER_OPTS);
      walletClient = new WalletClient(provider, TEST_WALLET_CLIENT_OPTS);
      address = walletClient.signer.address;
      const providerAccounts = await provider.enable();
      expect(providerAccounts).to.eql([address]);
      web3 = new Web3(provider as any);
    });
    it("enable", async () => {
      const accounts = await web3.eth.getAccounts();
      expect(accounts).to.eql([address]);

      const chainId = await web3.eth.getChainId();
      expect(chainId).to.eql(CHAIN_ID);
    });
    it.skip("send transaction", async () => {
      const balanceBefore = await web3.eth.getBalance(address);
      const tx = await web3.eth.sendTransaction({
        from: address,
        to: address,
        value: "0x01",
      });
      expect(!!tx.transactionHash).to.be.true;
      const balanceAfter = await web3.eth.getBalance(address);
      expect(balanceBefore === balanceAfter).to.be.false;
    });
    it.skip("create contract", async () => {
      const erc20Factory = new web3.eth.Contract(JSON.parse(JSON.stringify(_abi)));
      const erc20 = await erc20Factory
        .deploy({ data: _bytecode, arguments: ["The test token", "tst", 18] })
        .send({ from: address });

      const balanceToMint = utils.parseEther("500");
      await new Promise<void>((resolve, reject) => {
        erc20.methods
          .mint(address, balanceToMint.toHexString())
          .send({ from: address })
          .on("receipt", function() {
            resolve();
          })
          .on("error", function(error, receipt) {
            // If the transaction was rejected by the network with a receipt, the second parameter will be the receipt.
            reject(error);
          });
      });

      const balance = await erc20.methods.balanceOf(address).call({ from: address });
      expect(balanceToMint.toString() === balance).to.be.true;
    });
  });
  describe("Ethers", () => {
    let provider: WCEthereumProvider;
    let walletClient: WalletClient;
    let address: string;
    let web3Provider: providers.Web3Provider;
    before(async () => {
      provider = new WCEthereumProvider(TEST_PROVIDER_OPTS);
      walletClient = new WalletClient(provider, TEST_WALLET_CLIENT_OPTS);
      address = walletClient.signer.address;
      const providerAccounts = await provider.enable();
      expect(providerAccounts).to.eql([address]);
      web3Provider = new providers.Web3Provider(provider);
    });
    it("enable", async () => {
      const accounts = await web3Provider.listAccounts();
      expect(accounts).to.eql([address]);

      const network = await web3Provider.getNetwork();

      expect(network.chainId).to.equal(CHAIN_ID);
    });
    it.skip("send transaction", async () => {
      const balanceBefore = await web3Provider.getBalance(address);
      const signer = web3Provider.getSigner();
      const tx = await signer.sendTransaction({
        from: address,
        to: address,
        value: "0x01",
      });
      await tx.wait();
      expect(!!tx.hash).to.be.true;
      const balanceAfter = await web3Provider.getBalance(address);
      expect(balanceBefore.toHexString() === balanceAfter.toHexString()).to.be.false;
    });
    it.skip("create contract", async () => {
      const signer = web3Provider.getSigner();
      const erc20Factory = new ERC20Token__factory(signer as any);
      const erc20 = await erc20Factory.deploy("The test token", "tst", 18);
      await erc20.deployed();
      const balanceToMint = utils.parseEther("500");
      const mintTx = await erc20.mint(address, balanceToMint);
      await mintTx.wait();
      const tokenBalance = await erc20.balanceOf(address);
      expect(tokenBalance.eq(balanceToMint)).to.be.true;
    });

    it.skip("sign transaction", async () => {
      const signer = web3Provider.getSigner();
      const balanceBefore = await web3Provider.getBalance(address);
      const randomWallet = Wallet.createRandom();
      const balanceToSend = utils.parseEther("3");
      const unsignedTx = {
        to: randomWallet.address,
        value: balanceToSend.toHexString(),
        from: address,
      };
      // const unsignedTx = signer.populateTransaction({
      //   to: randomWallet.address,
      //   value: balanceToSend.toHexString(),
      //   from: address,
      // });
      const signedTx = await signer.signTransaction(unsignedTx); // ERROR "signing transactions is unsupported (operation=\"signTransaction\", code=UNSUPPORTED_OPERATION, version=providers/5.1.0)"
      // const signedTx = await provider.sendAsyncPromise("eth_signTransaction", [unsignedTx]); // ERROR Does not resolve
      const broadcastTx = await provider.request({
        method: "eth_sendRawTransaction",
        params: [signedTx],
      });
      const balanceAfter = await web3Provider.getBalance(signer._address);
      expect(balanceToSend.eq(balanceAfter)).to.be.true;
    });

    // Unresolved test weird one because there are two methods (eth_sign and personal_sign) with the same history
    it.skip("sign message", async () => {
      const signer = web3Provider.getSigner();
      const msg = "Hello world";

      const signature = await signer.signMessage(msg);
      const verify = utils.verifyMessage(msg, signature);
      expect(verify).eq(address);
    });
  });
});
