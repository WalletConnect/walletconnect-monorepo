/* eslint-disable no-console */
import { expect, describe, it, beforeAll } from "vitest";
import { ENGINE_RPC_OPTS, SignClient } from "../../src";
import { TEST_APP_METADATA_B, TEST_SIGN_CLIENT_OPTIONS, deleteClients, throttle } from "../shared";
import { buildAuthObject } from "@walletconnect/utils";
import { AuthTypes, ISignClient, ProposalTypes, SessionTypes } from "@walletconnect/types";
import { ethers } from "ethers";

const buildAuthObjects = ({
  wallet,
  proposal,
  address,
}: {
  wallet: ISignClient;
  proposal: ProposalTypes.Struct;
  address: string;
}) => {
  const { authentication } = proposal?.requests || {};
  if (!authentication) return [];
  const auths: AuthTypes.Cacao[] = [];
  authentication.forEach((auth) => {
    auth.chains.forEach((chain) => {
      const message = wallet.formatAuthMessage({
        request: auth,
        iss: `did:pkh:${chain}:${address}`,
      });
      console.log(`message: ${chain}`, message);
      console.log("--------------------------------");
      const authObject = buildAuthObject(
        auth,
        {
          t: "eip191",
          s: `0x${chain}`,
        },
        `did:pkh:${chain}:${address}`,
      );
      auths.push(authObject);
    });
  });
  return auths;
};

describe("Authenticated Sessions", () => {
  let cryptoWallet: ethers.HDNodeWallet;

  beforeAll(() => {
    cryptoWallet = ethers.Wallet.createRandom();
  });

  it("should authenticate EVM via connect(). Case 1", async () => {
    const dapp = await SignClient.init({ ...TEST_SIGN_CLIENT_OPTIONS, name: "dapp" });
    expect(dapp).to.be.exist;
    expect(dapp.metadata.redirect).to.exist;
    expect(dapp.metadata.redirect?.universal).to.exist;
    expect(dapp.metadata.redirect?.native).to.not.exist;

    const requestedChains = ["eip155:1", "eip155:2"];
    const requestedMethods = ["personal_sign", "eth_chainId", "eth_signTypedData_v4"];
    const optionalNamespaces = {
      eip155: {
        methods: requestedMethods,
        chains: requestedChains,
        events: [],
      },
    };
    const auth: AuthTypes.AuthenticateRequestParams = {
      chains: requestedChains,
      domain: "localhost",
      nonce: "1",
      uri: "localhost/login",
      ttl: 1000,
      statement: "Requesting access to your account",
    };

    const { uri, approval } = await dapp.connect({ optionalNamespaces, authentication: [auth] });

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

          if (!payload.params.requests?.authentication) {
            reject(new Error("authentication is required"));
          }

          const pendingProposals = dapp.proposal.getAll();
          expect(pendingProposals.length).to.eq(1);
          const pendingProposal = pendingProposals[0];
          expect(pendingProposal.requests?.authentication).to.exist;
          expect(pendingProposal.requests?.authentication?.[0].chains).to.deep.eq(
            payload.params.requests?.authentication?.[0].chains,
          );
          expect(pendingProposal.requests?.authentication?.[0].domain).to.deep.eq(
            payload.params.requests?.authentication?.[0].domain,
          );
          expect(pendingProposal.requests?.authentication?.[0].nonce).to.deep.eq(
            payload.params.requests?.authentication?.[0].nonce,
          );
          expect(pendingProposal.requests?.authentication?.[0].aud).to.deep.eq(
            payload.params.requests?.authentication?.[0].aud,
          );
          expect(pendingProposal.requests?.authentication?.[0].statement).to.deep.eq(
            payload.params.requests?.authentication?.[0].statement,
          );
          expect(pendingProposal.requests?.authentication?.[0].version).to.deep.eq(
            payload.params.requests?.authentication?.[0].version,
          );
          expect(pendingProposal.requests?.authentication?.[0].iat).to.deep.eq(
            payload.params.requests?.authentication?.[0].iat,
          );
          expect(pendingProposal.requests?.authentication?.[0].type).to.deep.eq(
            payload.params.requests?.authentication?.[0].type,
          );
          expect(pendingProposal.requests?.authentication?.[0].type).to.deep.eq("caip122");

          expect(pendingProposal.requests?.authentication?.[0].chains).to.deep.eq(requestedChains);
          expect(pendingProposal.requests?.authentication?.[0].domain).to.deep.eq("localhost");
          expect(pendingProposal.requests?.authentication?.[0].nonce).to.deep.eq("1");
          expect(pendingProposal.requests?.authentication?.[0].aud).to.deep.eq("localhost/login");

          const auths = buildAuthObjects({
            wallet,
            proposal: payload.params,
            address: cryptoWallet.address,
          });
          console.log("auths", auths);
          await wallet.approve({
            id: payload.id,
            namespaces: {
              eip155: {
                methods: requestedMethods,
                chains: requestedChains,
                accounts: requestedChains.map((chain) => `${chain}:${cryptoWallet.address}`),
                events: [],
              },
            },
            proposalRequestsResponses: {
              authentication: auths,
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
    expect(session.authentication).to.exist;
    expect(session.authentication?.length).to.eq(requestedChains.length);
    expect(session.authentication?.[0].h.t).to.eq("caip122");
    expect(session.authentication?.[0].p.iss).to.eq(
      `did:pkh:${requestedChains[0]}:${cryptoWallet.address}`,
    );
    expect(session.authentication?.[1].p.iss).to.eq(
      `did:pkh:${requestedChains[1]}:${cryptoWallet.address}`,
    );
    expect(session.authentication?.[0].s.s).to.eq(`0x${requestedChains[0]}`);
    expect(session.authentication?.[1].s.s).to.eq(`0x${requestedChains[1]}`);
    const walletSession = wallet.session.get(session.topic);
    expect(walletSession.authentication).to.exist;
    expect(walletSession.authentication?.length).to.eq(requestedChains.length);
    expect(walletSession.authentication?.[0].h.t).to.eq("caip122");
    expect(walletSession.authentication?.[0].p.iss).to.eq(
      `did:pkh:${requestedChains[0]}:${cryptoWallet.address}`,
    );
    expect(walletSession.authentication?.[1].p.iss).to.eq(
      `did:pkh:${requestedChains[1]}:${cryptoWallet.address}`,
    );
    expect(walletSession.authentication?.[0].s.s).to.eq(`0x${requestedChains[0]}`);
    expect(walletSession.authentication?.[1].s.s).to.eq(`0x${requestedChains[1]}`);

    await deleteClients({ A: dapp, B: wallet });
  });

  it("should authenticate via connect(). EVM+SOL+BTC Case 2", async () => {
    const dapp = await SignClient.init({ ...TEST_SIGN_CLIENT_OPTIONS, name: "dapp" });
    expect(dapp).to.be.exist;
    expect(dapp.metadata.redirect).to.exist;
    expect(dapp.metadata.redirect?.universal).to.exist;
    expect(dapp.metadata.redirect?.native).to.not.exist;

    const requestedChains = [
      "eip155:1",
      "eip155:2",
      "solana:4sGjMW1sUnHzSxGspuhpqLDx6wiyjNtZ",
      "bip122:mainnet",
    ];
    const requestedMethods = ["personal_sign", "eth_chainId", "eth_signTypedData_v4"];
    const optionalNamespaces = {
      eip155: {
        methods: requestedMethods,
        chains: requestedChains,
        events: [],
      },
      solana: {
        methods: requestedMethods,
        chains: requestedChains,
        events: [],
      },
      bip122: {
        methods: requestedMethods,
        chains: requestedChains,
        events: [],
      },
    };
    const auth: AuthTypes.AuthenticateRequestParams = {
      chains: requestedChains,
      domain: "localhost",
      nonce: "1",
      uri: "localhost/login",
      ttl: 1000,
      statement: "Requesting access to your account",
    };

    const { uri, approval } = await dapp.connect({ optionalNamespaces, authentication: [auth] });

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

          if (!payload.params.requests?.authentication) {
            reject(new Error("authentication is required"));
          }

          const pendingProposals = dapp.proposal.getAll();
          expect(pendingProposals.length).to.eq(1);
          const pendingProposal = pendingProposals[0];
          expect(pendingProposal.requests?.authentication).to.exist;
          expect(pendingProposal.requests?.authentication?.[0].chains).to.deep.eq(
            payload.params.requests?.authentication?.[0].chains,
          );
          expect(pendingProposal.requests?.authentication?.[0].domain).to.deep.eq(
            payload.params.requests?.authentication?.[0].domain,
          );
          expect(pendingProposal.requests?.authentication?.[0].nonce).to.deep.eq(
            payload.params.requests?.authentication?.[0].nonce,
          );
          expect(pendingProposal.requests?.authentication?.[0].aud).to.deep.eq(
            payload.params.requests?.authentication?.[0].aud,
          );
          expect(pendingProposal.requests?.authentication?.[0].statement).to.deep.eq(
            payload.params.requests?.authentication?.[0].statement,
          );
          expect(pendingProposal.requests?.authentication?.[0].version).to.deep.eq(
            payload.params.requests?.authentication?.[0].version,
          );
          expect(pendingProposal.requests?.authentication?.[0].iat).to.deep.eq(
            payload.params.requests?.authentication?.[0].iat,
          );

          expect(pendingProposal.requests?.authentication?.[0].chains).to.deep.eq(requestedChains);
          expect(pendingProposal.requests?.authentication?.[0].domain).to.deep.eq("localhost");
          expect(pendingProposal.requests?.authentication?.[0].nonce).to.deep.eq("1");
          expect(pendingProposal.requests?.authentication?.[0].aud).to.deep.eq("localhost/login");

          const auths = buildAuthObjects({
            wallet,
            proposal: payload.params,
            address: cryptoWallet.address,
          });
          console.log("auths", auths);
          await wallet.approve({
            id: payload.id,
            namespaces: {
              eip155: {
                methods: requestedMethods,
                chains: requestedChains,
                accounts: requestedChains.map((chain) => `${chain}:${cryptoWallet.address}`),
                events: [],
              },
            },
            proposalRequestsResponses: {
              authentication: auths,
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
    expect(session.authentication).to.exist;
    expect(session.authentication?.length).to.eq(requestedChains.length);
    expect(session.authentication?.[0].h.t).to.eq("caip122");
    expect(session.authentication?.[0].p.iss).to.eq(
      `did:pkh:${requestedChains[0]}:${cryptoWallet.address}`,
    );
    expect(session.authentication?.[1].p.iss).to.eq(
      `did:pkh:${requestedChains[1]}:${cryptoWallet.address}`,
    );

    expect(session.authentication?.[0].s.s).to.eq(`0x${requestedChains[0]}`);
    expect(session.authentication?.[1].s.s).to.eq(`0x${requestedChains[1]}`);
    expect(session.authentication?.[2].s.s).to.eq(`0x${requestedChains[2]}`);
    expect(session.authentication?.[3].s.s).to.eq(`0x${requestedChains[3]}`);
    const walletSession = wallet.session.get(session.topic);
    expect(walletSession.authentication).to.exist;
    expect(walletSession.authentication?.length).to.eq(requestedChains.length);
    expect(walletSession.authentication?.[0].h.t).to.eq("caip122");
    expect(walletSession.authentication?.[0].s.s).to.eq(`0x${requestedChains[0]}`);
    expect(walletSession.authentication?.[1].s.s).to.eq(`0x${requestedChains[1]}`);
    expect(walletSession.authentication?.[2].s.s).to.eq(`0x${requestedChains[2]}`);
    expect(walletSession.authentication?.[3].s.s).to.eq(`0x${requestedChains[3]}`);
    expect(walletSession.authentication?.[0].p.iss).to.eq(
      `did:pkh:${requestedChains[0]}:${cryptoWallet.address}`,
    );
    expect(walletSession.authentication?.[1].p.iss).to.eq(
      `did:pkh:${requestedChains[1]}:${cryptoWallet.address}`,
    );

    await deleteClients({ A: dapp, B: wallet });
  });
});
