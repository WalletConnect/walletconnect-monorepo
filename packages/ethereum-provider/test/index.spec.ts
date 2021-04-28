import "mocha";
import EthereumProvider from "./../src/index";
import { SignerConnection, SIGNER_EVENTS } from "@walletconnect/signer-connection";
import { TestNetwork } from "ethereum-test-network";
import { expect } from "chai";
import { Client, CLIENT_EVENTS } from "@walletconnect/client";
import { IClient, RequestEvent, SessionTypes } from "@walletconnect/types";
import { ethers } from "ethers";
import { abi, bytecode } from "./shared/erc20";

const CHAIN_ID = 123;
const PORT = 8545;
const BLOCKCHAIN = "eip155";
const RPC_URL = `http://localhost:${PORT}`;
const DEFAULT_GENESIS_ACCOUNTS = [
  {
    balance: "0x295BE96E64066972000000",
    privateKey: "0xa3dac6ca0b1c61f5f0a0b3a0acf93c9a52fd94e8e33d243d3b3a8b8c5dc37f0b", // 0xaaE062157B53077da1414ec3579b4CBdF7a4116f
  },
];
const wallet = new ethers.Wallet(DEFAULT_GENESIS_ACCOUNTS[0].privateKey);

export const TEST_RELAY_URL = process.env.TEST_RELAY_URL
  ? process.env.TEST_RELAY_URL
  : "ws://localhost:5555";

const TEST_JSONRPC_METHOD = "test_method";
const TEST_JSONRPC_REQUEST = { method: TEST_JSONRPC_METHOD, params: [] };
const TEST_JSONRPC_RESULT = "it worked";

const TEST_CHAINS = [];
const TEST_METHODS = [TEST_JSONRPC_METHOD];

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

describe("@walletconnect/ethereum-provider", () => {
  let testnetwork: TestNetwork;

  before(async () => {
    testnetwork = await TestNetwork.init({
      chainId: CHAIN_ID,
      port: PORT,
      genesisAccounts: DEFAULT_GENESIS_ACCOUNTS,
    });
  });

  after(async () => {
    await testnetwork.close();
  });

  it("Test enable", async () => {
    const walletClient = await Client.init({
      controller: true,
      relayProvider: TEST_RELAY_URL,
      metadata: TEST_WALLET_METADATA,
    });
    const provider = new EthereumProvider({
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
    });

    // auto-pair
    provider.signer.connection.on(SIGNER_EVENTS.uri, ({ uri }) => walletClient.pair({ uri }));
    // connect
    let accounts: string[] = [];

    await Promise.all([
      new Promise<void>((resolve, reject) => {
        walletClient.on(CLIENT_EVENTS.session.proposal, async (proposal: SessionTypes.Proposal) => {
          await walletClient.approve({
            proposal,
            response: {
              state: { accounts: [`${wallet.address}@${BLOCKCHAIN}:${CHAIN_ID}`] },
            },
          });
          resolve();
        });
      }),
      new Promise<void>(async (resolve, reject) => {
        accounts = await provider.enable();
        resolve();
      }),
    ]);
    expect(accounts[0], "Returned account address is equal to test address").to.be.eq(
      wallet.address,
    ); // TODO Fails because of this, TypeError: Cannot read property 'split' of undefined
  });

  it("Ethers eth_sendTransaction", async () => {
    const walletClient = await Client.init({
      controller: true,
      relayProvider: TEST_RELAY_URL,
      metadata: TEST_WALLET_METADATA,
    });
    const provider = new EthereumProvider({
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
    });

    // auto-pair
    provider.signer.connection.on(SIGNER_EVENTS.uri, ({ uri }) => walletClient.pair({ uri }));
    // connect
    let accounts: string[] = [];

    await Promise.all([
      new Promise<void>((resolve, reject) => {
        walletClient.on(CLIENT_EVENTS.session.proposal, async (proposal: SessionTypes.Proposal) => {
          await walletClient.approve({
            proposal,
            response: {
              state: { accounts: [`${wallet.address}@${BLOCKCHAIN}:${CHAIN_ID}`] },
            },
          });
          resolve();
        });
      }),
      new Promise<void>(async (resolve, reject) => {
        accounts = await provider.enable();
        resolve();
      }),
    ]);
    await Promise.all([
      new Promise<void>((resolve, reject) => {
        walletClient.on(
          CLIENT_EVENTS.session.request,
          async (requestEvent: SessionTypes.RequestEvent) => {
            if (requestEvent.request.method === "eth_sendTransaction") {
              const signer = wallet.connect(new ethers.providers.JsonRpcProvider(RPC_URL));
              const tx = requestEvent.request.params[0];
              const sendtTx = await signer.sendTransaction({
                from: tx.from,
                data: tx.data,
                gasLimit: tx.gas,
                chainId: CHAIN_ID,
                to: tx.to ? tx.to : undefined,
              });
              await sendtTx.wait();
              await walletClient.respond({
                topic: requestEvent.topic,
                response: {
                  result: sendtTx.hash,
                  id: requestEvent.request.id,
                  jsonrpc: requestEvent.request.jsonrpc,
                },
              });
              resolve();
            }
          },
        );
      }),
      new Promise<void>(async (resolve, reject) => {
        const web3provider = new ethers.providers.Web3Provider(provider);
        const signer = web3provider.getSigner(accounts[0]);
        const factory = new ethers.ContractFactory(abi, bytecode, signer);
        const erc20 = await factory.deploy("Walletconnect token", "WCT", 18);
        await erc20.deployed();
        const balanceToMint = ethers.utils.parseEther("500");
        const mintTx = await erc20.mint(accounts[0], balanceToMint);
        await mintTx.wait();
        const tokenBalance = await erc20.balanceOf(accounts[0]);
        expect(tokenBalance.toString()).to.be.eq(balanceToMint.toString());
        resolve();
      }),
    ]);

    expect(accounts[0], "Returned account address is equal to test address").to.be.eq(
      wallet.address,
    );
  });
});

function formatEIP155(address: string, blockchain: string, chainId: number) {
  return `${address}@${blockchain}:${chainId}`;
}
