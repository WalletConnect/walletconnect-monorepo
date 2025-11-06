/* eslint-disable no-console */
import { expect, describe, it, beforeAll } from "vitest";
import { ENGINE_RPC_OPTS, SignClient } from "../../src/index.js";
import {
  TEST_APP_METADATA_B,
  TEST_SIGN_CLIENT_OPTIONS,
  deleteClients,
  throttle,
} from "../shared/index.js";

import { AuthTypes, EngineTypes, SessionTypes } from "@walletconnect/types";
import { ethers } from "ethers";

describe("Authenticated Sessions", () => {
  let cryptoWallet: ethers.HDNodeWallet;

  beforeAll(() => {
    cryptoWallet = ethers.Wallet.createRandom();
  });

  it("should receive wallet pay request and respond with wallet pay result. Case 1", async () => {
    const dapp = await SignClient.init({ ...TEST_SIGN_CLIENT_OPTIONS, name: "dapp" });
    expect(dapp).to.be.exist;
    expect(dapp.metadata.redirect).to.exist;
    expect(dapp.metadata.redirect?.universal).to.exist;
    expect(dapp.metadata.redirect?.native).to.not.exist;

    const chainId = "eip155:1";
    const assetAddress = "0x0000000000000000000000000000000000000000000000000000000000000000";
    const assetType = "erc20";
    const asset = `${chainId}/${assetType}:${assetAddress}`;
    const amount = "0x1";
    const recipient = `${chainId}:${cryptoWallet.address}`;

    const walletPay: EngineTypes.WalletPayParams = {
      version: "1.0.0",
      orderId: "1",
      acceptedPayments: [{ asset, amount, recipient }],
      expiry: 1000,
    };

    const txid = "0x1x0";

    const { uri, approval } = await dapp.connect({ walletPay });

    if (!uri) throw new Error("URI is undefined");

    const wallet = await SignClient.init({
      ...TEST_SIGN_CLIENT_OPTIONS,
      name: "wallet",
      metadata: TEST_APP_METADATA_B,
    });

    const result = await Promise.all([
      new Promise<void>((resolve, reject) => {
        wallet.once("session_proposal", async (payload) => {
          console.log("session_proposal", JSON.stringify(payload, null, 2));
          const verifyContext = payload.verifyContext;
          expect(verifyContext).to.exist;
          expect(verifyContext.verified.validation).to.eq("UNKNOWN");

          if (!payload.params.requests?.walletPay) {
            reject(new Error("walletPay is required"));
          }

          const pendingProposals = dapp.proposal.getAll();
          expect(pendingProposals.length).to.eq(1);
          const pendingProposal = pendingProposals[0];
          expect(pendingProposal.requests?.walletPay).to.exist;
          expect(pendingProposal.requests?.walletPay?.acceptedPayments).to.exist;
          expect(pendingProposal.requests?.walletPay?.acceptedPayments?.[0].asset).to.eq(asset);
          expect(pendingProposal.requests?.walletPay?.acceptedPayments?.[0].amount).to.eq(amount);
          expect(pendingProposal.requests?.walletPay?.acceptedPayments?.[0].recipient).to.eq(
            recipient,
          );
          expect(pendingProposal.requests?.walletPay?.version).to.eq(walletPay.version);
          expect(pendingProposal.requests?.walletPay?.orderId).to.eq(walletPay.orderId);
          expect(pendingProposal.requests?.walletPay?.expiry).to.eq(walletPay.expiry);

          const walletPayResult: EngineTypes.WalletPayResult = {
            version: walletPay.version,
            orderId: walletPay.orderId,
            txid,
            recipient,
            asset,
            amount,
          };

          await wallet.approve({
            id: payload.id,
            namespaces: {
              eip155: {
                methods: ["eth_sendTransaction"],
                chains: [chainId],
                accounts: [`${chainId}:${cryptoWallet.address}`],
                events: [],
              },
            },
            proposalRequestsResponses: {
              walletPay: [walletPayResult],
            },
          });
          resolve();
        });
      }),
      wallet.pair({ uri }),
      new Promise<SessionTypes.Struct>(async (resolve) => {
        const session = await approval();
        resolve(session);
      }),
    ]).then((res) => {
      return { session: res[2] };
    });

    const session = result.session;
    expect(session.walletPayResult).to.exist;
    expect(session.walletPayResult?.length).to.eq(1);
    expect(session.walletPayResult?.[0].version).to.eq(walletPay.version);
    expect(session.walletPayResult?.[0].orderId).to.eq(walletPay.orderId);
    expect(session.walletPayResult?.[0].txid).to.eq(txid);
    expect(session.walletPayResult?.[0].recipient).to.eq(recipient);
    expect(session.walletPayResult?.[0].asset).to.eq(asset);
    expect(session.walletPayResult?.[0].amount).to.eq(amount);

    const walletSession = wallet.session.get(session.topic);
    expect(walletSession.walletPayResult).to.exist;
    expect(walletSession.walletPayResult?.length).to.eq(1);
    expect(walletSession.walletPayResult?.[0].version).to.eq(walletPay.version);
    expect(walletSession.walletPayResult?.[0].orderId).to.eq(walletPay.orderId);
    expect(walletSession.walletPayResult?.[0].txid).to.eq(txid);
    expect(walletSession.walletPayResult?.[0].recipient).to.eq(recipient);
    expect(walletSession.walletPayResult?.[0].asset).to.eq(asset);
    expect(walletSession.walletPayResult?.[0].amount).to.eq(amount);

    expect(walletSession.walletPayResult?.[0].version).to.eq(walletPay.version);
    expect(walletSession.walletPayResult?.[0].orderId).to.eq(walletPay.orderId);
    expect(walletSession.walletPayResult?.[0].txid).to.eq(txid);
    expect(walletSession.walletPayResult?.[0].recipient).to.eq(recipient);
    expect(walletSession.walletPayResult?.[0].asset).to.eq(asset);
    expect(walletSession.walletPayResult?.[0].amount).to.eq(amount);

    await deleteClients({ A: dapp, B: wallet });
  });
});
