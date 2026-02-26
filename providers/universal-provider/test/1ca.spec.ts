import { expect, describe, it, beforeAll } from "vitest";
import UniversalProvider from "../src/index.js";
import {
  ACCOUNTS,
  CHAIN_ID_B,
  PORT,
  TEST_PROVIDER_OPTS,
  TEST_WALLET_CLIENT_OPTS,
} from "./shared/constants.js";
import { WalletClient } from "./shared/WalletClient.js";
const CHAIN_ID = 1;
describe("UniversalProvider 1CA", function () {
  let provider: UniversalProvider;
  let walletClient: WalletClient;
  let receiverAddress: string;
  beforeAll(async () => {
    receiverAddress = ACCOUNTS.b.address;
  });

  it("should authenticate via connect(). EVM+SOL+BTC Case 1", async function () {
    provider = await UniversalProvider.init(TEST_PROVIDER_OPTS);

    walletClient = await WalletClient.init(provider, {
      ...TEST_WALLET_CLIENT_OPTS,
      chainId: CHAIN_ID,
    });

    const session = await provider.connect({
      namespaces: {
        eip155: {
          methods: ["personal_sign"],
          chains: [`eip155:${CHAIN_ID}`, `eip155:${CHAIN_ID_B}`],
          events: ["chainChanged", "accountsChanged"],
        },
        solana: {
          methods: ["solana_signTransaction"],
          chains: [`solana:${CHAIN_ID}`],
          events: ["chainChanged", "accountsChanged"],
        },
        bip122: {
          methods: ["sendTransfer"],
          chains: [`bip122:${CHAIN_ID}`],
          events: ["chainChanged", "accountsChanged"],
        },
      },
      authentication: [
        {
          chains: [
            `eip155:${CHAIN_ID}`,
            `eip155:${CHAIN_ID_B}`,
            `solana:${CHAIN_ID}`,
            `bip122:${CHAIN_ID}`,
          ],
          domain: "localhost",
          nonce: "1",
          uri: "localhost/login",
          ttl: 1000,
          statement: "Requesting access to your account",
        },
      ],
    });

    expect(session).to.exist;
    expect(session?.authentication).to.exist;
    expect(session?.authentication?.length).to.eq(4);
  });
});
