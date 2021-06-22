import "mocha";
import { expect } from "chai";

import Web3 from "web3";
import { ethers } from "ethers";
import { TestNetwork } from "ethereum-test-network";
import {
  ERC20Token__factory,
  _abi,
  _bytecode,
} from "ethereum-test-network/lib/utils/ERC20Token__factory";

import { WalletClient } from "./shared";

import WalletConnectWeb3Provider from "../src";

const CHAIN_ID = 123;
const PORT = 8547;
const RPC_URL = `http://localhost:${PORT}`;
const DEFAULT_GENESIS_ACCOUNTS = [
  {
    balance: "0x295BE96E64066972000000",
    privateKey: "0xa3dac6ca0b1c61f5f0a0b3a0acf93c9a52fd94e8e33d243d3b3a8b8c5dc37f0b", // 0xaaE062157B53077da1414ec3579b4CBdF7a4116f
  },
];
const wallet = new ethers.Wallet(DEFAULT_GENESIS_ACCOUNTS[0].privateKey);

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

describe("WalletConnectWeb3Provider", function() {
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

  it("instantiate successfully", () => {
    const provider = new WalletConnectWeb3Provider(TEST_PROVIDER_OPTS);
    expect(!!provider).to.be.true;
  });

  it("enable successfully web3", async () => {
    const provider = new WalletConnectWeb3Provider(TEST_PROVIDER_OPTS);
    const walletClient = new WalletClient(provider, TEST_WALLET_CLIENT_OPTS);
    await Promise.all([
      walletClient.approveSession(),
      new Promise<void>(async resolve => {
        const providerAccounts = await provider.enable();

        expect(providerAccounts).to.eql([wallet.address]);

        const web3Provider = new Web3(provider as any);

        const web3Accounts = await web3Provider.eth.getAccounts();
        expect(web3Accounts).to.eql([wallet.address]);

        const web3ChainId = await web3Provider.eth.getChainId();
        expect(web3ChainId).to.eql(CHAIN_ID);

        resolve();
      }),
    ]);
  });

  it("enable successfully ethers", async () => {
    const provider = new WalletConnectWeb3Provider(TEST_PROVIDER_OPTS);
    const walletClient = new WalletClient(provider, TEST_WALLET_CLIENT_OPTS);
    await Promise.all([
      walletClient.approveSession(),
      new Promise<void>(async resolve => {
        const providerAccounts = await provider.enable();
        expect(providerAccounts).to.eql([wallet.address]);

        const web3Provider = new ethers.providers.Web3Provider(provider);

        const web3Accounts = await web3Provider.listAccounts();
        expect(web3Accounts).to.eql([wallet.address]);

        const web3Network = await web3Provider.getNetwork();

        expect(web3Network.chainId).to.equal(CHAIN_ID);

        resolve();
      }),
    ]);
  });

  it("create contract web3", async () => {
    const provider = new WalletConnectWeb3Provider(TEST_PROVIDER_OPTS);
    const walletClient = new WalletClient(provider, TEST_WALLET_CLIENT_OPTS);
    await Promise.all([
      walletClient.approveSessionAndRequest(),
      new Promise<void>(async resolve => {
        try {
          const providerAccounts = await provider.enable();
          expect(providerAccounts).to.eql([wallet.address]);

          const web3Provider = new Web3(provider as any);
          const erc20Factory = new web3Provider.eth.Contract(JSON.parse(JSON.stringify(_abi)));
          const erc20 = await erc20Factory
            .deploy({ data: _bytecode, arguments: ["The test token", "tst", 18] })
            .send({ from: providerAccounts[0] });

          // console.log("erc29", erc20);
          const balanceToMint = ethers.utils.parseEther("500");
          await new Promise<void>((resolve, reject) => {
            erc20.methods
              .mint(providerAccounts[0], balanceToMint.toHexString())
              .send({ from: providerAccounts[0] })
              .on("receipt", function() {
                resolve();
              })
              .on("error", function(error, receipt) {
                // If the transaction was rejected by the network with a receipt, the second parameter will be the receipt.
                reject(error);
              });
          });

          const balance = await erc20.methods
            .balanceOf(providerAccounts[0])
            .call({ from: providerAccounts[0] });
          expect(balanceToMint.toString() === balance).to.be.true;
        } catch (error) {
          expect(error).to.be.false;
        }
        resolve();
      }),
    ]);
  });

  it.skip("create contract ethers", async () => {
    const provider = new WalletConnectWeb3Provider(TEST_PROVIDER_OPTS);
    const walletClient = new WalletClient(provider, TEST_WALLET_CLIENT_OPTS);
    await Promise.all([
      walletClient.approveSessionAndRequest(),
      new Promise<void>(async resolve => {
        try {
          const providerAccounts = await provider.enable();
          expect(providerAccounts).to.eql([wallet.address]);

          const web3Provider = new ethers.providers.Web3Provider(provider);
          const signer = await web3Provider.getSigner();
          const erc20Factory = new ERC20Token__factory(signer as any);
          const erc20 = await erc20Factory.deploy("The test token", "tst", 18);
          await erc20.deployed();
          const balanceToMint = ethers.utils.parseEther("500");
          const mintTx = await erc20.mint(wallet.address, balanceToMint);
          await mintTx.wait();
          const tokenBalance = await erc20.balanceOf(wallet.address);
          expect(tokenBalance.eq(balanceToMint)).to.be.true;
        } catch (error) {
          // console.log(error);
          // expect(error).to.be.false;
        }
        resolve();
      }),
    ]);
  });

  it.skip("sign transaction ethers", async () => {
    const provider = new WalletConnectWeb3Provider(TEST_PROVIDER_OPTS);
    const walletClient = new WalletClient(provider, TEST_WALLET_CLIENT_OPTS);
    await Promise.all([
      walletClient.approveSessionAndRequest(),
      new Promise<void>(async resolve => {
        try {
          const providerAccounts = await provider.enable();
          expect(providerAccounts).to.eql([wallet.address]);

          const web3Provider = new ethers.providers.Web3Provider(provider);
          const signer = await web3Provider.getSigner();
          const balanceBefore = await web3Provider.getBalance(providerAccounts[0]);
          const randomWallet = ethers.Wallet.createRandom();
          const balanceToSend = ethers.utils.parseEther("3");
          const unsignedTx = {
            to: randomWallet.address,
            value: balanceToSend.toHexString(),
            from: providerAccounts[0],
          };
          // const unsignedTx = signer.populateTransaction({
          //   to: randomWallet.address,
          //   value: balanceToSend.toHexString(),
          //   from: providerAccounts[0],
          // });
          const signedTx = await signer.signTransaction(unsignedTx); // ERROR "signing transactions is unsupported (operation=\"signTransaction\", code=UNSUPPORTED_OPERATION, version=providers/5.1.0)"
          // const signedTx = await provider.sendAsyncPromise("eth_signTransaction", [unsignedTx]); // ERROR Does not resolve
          const broadcastTx = await provider.sendAsyncPromise("eth_sendRawTransaction", signedTx);
          await broadcastTx.wait();
          const balanceAfter = await web3Provider.getBalance(signer._address);
          expect(balanceToSend.eq(balanceAfter)).to.be.true;
        } catch (error) {
          const testing = "JUST FOR TEST";
        }
        resolve();
      }),
    ]);
  });

  // Unresolved test weird one because there are two methods (eth_sign and personal_sign) with the same history
  it.skip("create sign ethers", async () => {
    const provider = new WalletConnectWeb3Provider(TEST_PROVIDER_OPTS);
    const walletClient = new WalletClient(provider, TEST_WALLET_CLIENT_OPTS);
    await Promise.all([
      walletClient.approveSessionAndRequest(),
      new Promise<void>(async resolve => {
        try {
          const providerAccounts = await provider.enable();
          expect(providerAccounts).to.eql([wallet.address]);

          const web3Provider = new ethers.providers.Web3Provider(provider);
          const signer = await web3Provider.getSigner();
          const msg = "Hello world";

          const signature = await signer.signMessage(msg);
          const verify = ethers.utils.verifyMessage(msg, signature);
          expect(verify).eq(providerAccounts[0]);
        } catch (error) {
          const test = "Only here as breakpoint to test execution.";
        }
        resolve();
      }),
    ]);
  });
});
