import { Core } from "@walletconnect/core";
import { ICore } from "@walletconnect/types";
import { Wallet as CryptoWallet } from "@ethersproject/wallet";

import { expect, describe, it, beforeEach, beforeAll, afterAll, afterEach } from "vitest";
import { Web3Wallet, IWeb3Wallet } from "../src";
import { disconnect, TEST_CORE_OPTIONS } from "./shared";
import {
  AuthClient,
  AuthEngineTypes,
  generateNonce,
  IAuthClient,
} from "@walletconnect/auth-client";

const defaultRequestParams: AuthEngineTypes.RequestParams = {
  aud: "http://localhost:3000/login",
  domain: "localhost:3000",
  chainId: "eip155:1",
  nonce: generateNonce(),
};

describe("Auth Integration", () => {
  let core: ICore;
  let wallet: IWeb3Wallet;
  let dapp: IAuthClient;
  let uriString: string;
  let cryptoWallet: CryptoWallet;
  let iss: string;

  beforeAll(() => {
    cryptoWallet = CryptoWallet.createRandom();
    iss = `did:pkh:eip155:1:${cryptoWallet.address}`;
  });

  afterEach(async () => {
    await disconnect(core);
  });

  beforeEach(async () => {
    core = new Core(TEST_CORE_OPTIONS);
    dapp = await AuthClient.init({
      projectId: TEST_CORE_OPTIONS.projectId,
      metadata: {} as any,
      name: "dapp",
    });
    wallet = await Web3Wallet.init({ core, name: "wallet", metadata: {} as any });
    expect(wallet).to.be.exist;
    expect(dapp).to.be.exist;
    expect(core).to.be.exist;
    expect(wallet.metadata.redirect).to.not.exist;
    expect(dapp.metadata.redirect).to.not.exist;
  });

  it("should respond to auth request", async () => {
    const request = await dapp.request(defaultRequestParams);
    uriString = request.uri!;

    await Promise.all([
      new Promise((resolve) => {
        wallet.on("auth_request", async (authRequest) => {
          const { id, params } = authRequest;
          expect(params.cacaoPayload.aud).to.toMatchObject(defaultRequestParams.aud);
          expect(params.cacaoPayload.domain).to.toMatchObject(defaultRequestParams.domain);
          expect(params.cacaoPayload.nonce).to.toMatchObject(defaultRequestParams.nonce);

          const message = wallet.formatMessage(params.cacaoPayload, iss);
          const signature = await cryptoWallet.signMessage(message);

          resolve(
            await wallet.respondAuthRequest(
              {
                id,
                signature: {
                  s: signature,
                  t: "eip191",
                },
              },
              iss,
            ),
          );
        });
      }),
      new Promise<void>((resolve) => {
        dapp.on("auth_response", (authResponse: any) => {
          expect(authResponse).to.be.exist;
          expect(authResponse).to.have.property("id");
          expect(authResponse).to.have.property("topic");
          expect(authResponse.params.result.p.iss).to.eq(iss);
          resolve();
        });
      }),
      wallet.pair({ uri: request.uri!, activatePairing: true }),
    ]);
  });

  it("should reject auth request", async () => {
    const request = await dapp.request(defaultRequestParams);
    uriString = request.uri!;
    const errorResponse = {
      code: 14001,
      message: "Can not login",
    };
    await Promise.all([
      new Promise((resolve) => {
        wallet.on("auth_request", async (authRequest) => {
          const { id, params } = authRequest;
          expect(params.cacaoPayload.aud).to.toMatchObject(defaultRequestParams.aud);
          expect(params.cacaoPayload.domain).to.toMatchObject(defaultRequestParams.domain);
          expect(params.cacaoPayload.nonce).to.toMatchObject(defaultRequestParams.nonce);
          resolve(
            await wallet.respondAuthRequest(
              {
                id,
                error: errorResponse,
              },
              iss,
            ),
          );
        });
      }),
      new Promise<void>((resolve) => {
        dapp.on("auth_response", (authResponse: any) => {
          expect(authResponse).to.be.exist;
          expect(authResponse).to.have.property("id");
          expect(authResponse).to.have.property("topic");
          expect(authResponse.params.error).to.toMatchObject(errorResponse);
          resolve();
        });
      }),
      wallet.pair({ uri: request.uri!, activatePairing: true }),
    ]);
  });

  it("should get pending auth request", async () => {
    const request = await dapp.request(defaultRequestParams);
    uriString = request.uri!;

    await Promise.all([
      new Promise((resolve) => {
        wallet.on("auth_request", async (authRequest) => {
          const pendingRequest = wallet.getPendingAuthRequests();
          const { id, cacaoPayload } = pendingRequest[0];

          expect(cacaoPayload.aud).to.toMatchObject(defaultRequestParams.aud);
          expect(cacaoPayload.domain).to.toMatchObject(defaultRequestParams.domain);
          expect(cacaoPayload.nonce).to.toMatchObject(defaultRequestParams.nonce);

          const message = wallet.formatMessage(cacaoPayload, iss);
          const signature = await cryptoWallet.signMessage(message);

          resolve(
            await wallet.respondAuthRequest(
              {
                id,
                signature: {
                  s: signature,
                  t: "eip191",
                },
              },
              iss,
            ),
          );
        });
      }),
      new Promise<void>((resolve) => {
        dapp.on("auth_response", async (authResponse: any) => {
          expect(authResponse).to.be.exist;
          expect(authResponse).to.have.property("id");
          expect(authResponse).to.have.property("topic");
          expect(authResponse.params.result.p.iss).to.eq(iss);
          resolve();
        });
      }),
      wallet.pair({ uri: request.uri!, activatePairing: true }),
    ]);
  });
});
