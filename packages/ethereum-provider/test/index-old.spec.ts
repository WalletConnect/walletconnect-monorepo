import "mocha";
import { expect } from "chai";
import { Wallet, utils, providers } from "ethers";
import { TestNetwork } from "ethereum-test-network";
import { SignerConnection, SIGNER_EVENTS } from "@walletconnect/signer-connection";
import { Client, CLIENT_EVENTS } from "@walletconnect/client";
import { IClient, RequestEvent, SessionTypes } from "@walletconnect/types";

import EthereumProvider from "./../src/index";
import { formatJsonRpcError, formatJsonRpcResult } from "@json-rpc-tools/utils";

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
const wallet = new Wallet(DEFAULT_GENESIS_ACCOUNTS[0].privateKey);

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

    // auto-approve
    walletClient.on(CLIENT_EVENTS.session.proposal, async (proposal: SessionTypes.Proposal) => {
      await walletClient.approve({
        proposal,
        response: {
          state: { accounts: [`${wallet.address}@${BLOCKCHAIN}:${CHAIN_ID}`] },
        },
      });
    });

    // auto-respond
    walletClient.on(
      CLIENT_EVENTS.session.request,
      async (requestEvent: SessionTypes.RequestEvent) => {
        console.log("[session.request]", "requestEvent", requestEvent); // eslint-disable-line no-console
        console.log("[session.request]", "!!walletClient", !!walletClient); // eslint-disable-line no-console

        if (typeof walletClient === "undefined") {
          throw new Error("Client not inititialized");
        }
        const { topic, chainId, request } = requestEvent;

        try {
          let result: any;

          switch (request.method) {
            case "eth_sendTransaction":
              //  eslint-disable-next-line no-case-declarations
              const tx = await wallet.sendTransaction(parseTxParams(request));
              await tx.wait();
              result = tx.hash;
              break;
            case "eth_signTransaction":
              //  eslint-disable-next-line no-case-declarations
              const txParams = await wallet.populateTransaction(parseTxParams(request));
              result = await wallet.signTransaction(txParams);
              break;
            case "eth_sendRawTransaction":
              //  eslint-disable-next-line no-case-declarations
              const receipt = await wallet.provider.sendTransaction(request.params[0]);
              result = receipt.hash;
              break;
            case "eth_sign":
              //  eslint-disable-next-line no-case-declarations
              const ethMsg = request.params[1];
              result = await wallet.signMessage(utils.arrayify(ethMsg));
              break;
            case "personal_sign":
              //  eslint-disable-next-line no-case-declarations
              const personalMsg = request.params[0];
              result = await wallet.signMessage(utils.arrayify(personalMsg));
              break;
            default:
              throw new Error(`Method not supported: ${request.method}`);
          }

          // reject if undefined result
          if (typeof result === "undefined") {
            throw new Error("Result was undefined");
          }

          const response = formatJsonRpcResult(request.id, result);
          await walletClient.respond({ topic, response });
        } catch (e) {
          const message = e.message || e.toString();
          const response = formatJsonRpcError(request.id, message);
          await walletClient.respond({ topic, response });
        }
      },
    );

    // connect
    const providerAccounts: string[] = await provider.enable();
    expect(
      providerAccounts[0].split("@")[0] === wallet.address,
      "Returned account address is equal to test address",
    );

    // request
    const web3Provider = new providers.Web3Provider(provider);
    const accounts = await web3Provider.listAccounts();
    expect(accounts).to.eql([wallet.address]);
    const network = await web3Provider.getNetwork();
    expect(network.chainId).to.equal(CHAIN_ID);
    const signer = web3Provider.getSigner();
    const msg = "Hello world";
    const signature = await signer.signMessage(msg);
    const verify = utils.verifyMessage(msg, signature);
    expect(verify).eq(wallet.address);
  });
});

function parseTxParams(payload) {
  let txParams: providers.TransactionRequest = {
    from: payload.params[0].from,
    data: payload.params[0].data,
    chainId: CHAIN_ID,
  };
  if (payload.params[0].gas) {
    txParams = {
      ...txParams,
      gasLimit: payload.params[0].gas,
    };
  }
  if (payload.params[0].to) {
    txParams = {
      ...txParams,
      to: payload.params[0].to,
    };
  }
  return txParams;
}
