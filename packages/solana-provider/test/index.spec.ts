import "mocha";
import { expect } from "chai";
import { SIGNER_EVENTS } from "@walletconnect/signer-connection";
import { Client, CLIENT_EVENTS } from "@walletconnect/client";
import { SessionTypes } from "@walletconnect/types";
import {
  formatJsonRpcError,
  formatJsonRpcResult,
  JsonRpcResponse,
} from "@walletconnect/jsonrpc-utils";
import SolanaWallet, {
  serialiseTransaction,
  verifyMessageSignature,
  verifyTransactionSignature,
} from "solana-wallet";
import bs58 from "bs58";

import SolanaProvider from "./../src/index";
import * as CONFIG from "./config";

describe("@walletconnect/solana-provider", () => {
  let wallet: SolanaWallet;
  let walletClient;
  let provider: SolanaProvider;

  before(async () => {
    // Set up wallet/client/provider
    wallet = new SolanaWallet(Buffer.from(bs58.decode(CONFIG.TEST_SOLANA_KEYPAIR_1.privateKey)));
    walletClient = await Client.init({
      controller: true,
      relayUrl: CONFIG.TEST_RELAY_URL,
      metadata: CONFIG.TEST_WALLET_METADATA,
    });
    provider = new SolanaProvider({
      chains: CONFIG.TEST_CHAINS,
      rpc: {
        custom: {
          [CONFIG.CHAIN_ID]: CONFIG.RPC_URL,
        },
      },
      client: {
        relayUrl: CONFIG.TEST_RELAY_URL,
        metadata: CONFIG.TEST_APP_METADATA,
      },
    });

    // Bind responses for client requests.
    walletClient.on(
      CLIENT_EVENTS.session.request,
      async (requestEvent: SessionTypes.RequestEvent) => {
        let response: JsonRpcResponse;
        try {
          let result: any;
          switch (requestEvent.request.method) {
            case "solana_getAccounts":
              result = await wallet.getAccounts();
              break;
            case "solana_signMessage":
              result = await wallet.signMessage(
                requestEvent.request.params.pubkey,
                requestEvent.request.params.message,
              );
              break;
            case "solana_signTransaction":
              result = await wallet.signTransaction(
                requestEvent.request.params.feePayer,
                requestEvent.request.params,
              );
              break;
            default:
              throw new Error("Unsupported method");
          }
          response = formatJsonRpcResult(requestEvent.request.id, result);
        } catch (e) {
          response = formatJsonRpcError(requestEvent.request.id, e.message);
        }
        await walletClient.respond({
          topic: requestEvent.topic,
          response,
        });
      },
    );
  });

  it("connect", async () => {
    // auto-pair
    provider.signer.connection.on(SIGNER_EVENTS.uri, ({ uri }) => walletClient.pair({ uri }));

    // connect
    let accounts: string[] = [];
    await Promise.all([
      new Promise<void>((resolve, reject) => {
        walletClient.on(CLIENT_EVENTS.session.proposal, async (proposal: SessionTypes.Proposal) => {
          const response = {
            state: {
              accounts: [
                `${CONFIG.NAMESPACE}:${CONFIG.CHAIN_ID}:${CONFIG.TEST_SOLANA_KEYPAIR_1.publicKey}`,
              ],
            },
          };
          await walletClient.approve({
            proposal,
            response,
          });
          resolve();
        });
      }),
      new Promise<void>(async (resolve, reject) => {
        await provider.connect();
        accounts = provider.accounts;
        resolve();
      }),
    ]);

    expect(accounts[0]).to.eql(CONFIG.TEST_SOLANA_KEYPAIR_1.publicKey);
  });

  it("solana_getAccounts", async () => {
    const accountsResult = await provider.request({ method: "solana_getAccounts" });
    expect(!!accountsResult).to.be.true;
    expect((accountsResult as any)[0].pubkey).to.eql(CONFIG.TEST_SOLANA_KEYPAIR_1.publicKey);
  });

  it("solana_signMessage", async () => {
    const signMessageResult = await provider.request({
      method: "solana_signMessage",
      params: {
        pubkey: CONFIG.TEST_SOLANA_KEYPAIR_1.publicKey,
        message: CONFIG.TEST_MESSAGE,
      },
    });
    expect(!!signMessageResult).to.be.true;
    expect((signMessageResult as any).signature).to.eql(CONFIG.TEST_MESSAGE_SIGNATURE);
    expect(
      verifyMessageSignature(
        CONFIG.TEST_SOLANA_KEYPAIR_1.publicKey,
        (signMessageResult as any).signature,
        CONFIG.TEST_MESSAGE,
      ),
    ).to.be.true;
  });

  it("solana_signTransaction", async () => {
    const signTransactionResult = await provider.request({
      method: "solana_signTransaction",
      params: serialiseTransaction(CONFIG.TEST_TRANSACTION),
    });

    expect(!!signTransactionResult).to.be.true;
    expect((signTransactionResult as any).signature).to.eql(CONFIG.TEST_TRANSACTION_SIGNATURE);
    expect(
      verifyTransactionSignature(
        CONFIG.TEST_SOLANA_KEYPAIR_1.publicKey,
        (signTransactionResult as any).signature,
        CONFIG.TEST_TRANSACTION,
      ),
    ).to.be.true;
  });
});
