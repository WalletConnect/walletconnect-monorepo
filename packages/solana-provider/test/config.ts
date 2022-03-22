import { PublicKey, SystemProgram, Transaction } from "@solana/web3.js";
import base58 from "bs58";

export const NAMESPACE = "solana";
export const CHAIN_ID = "4sGjMW1sUnHzSxGspuhpqLDx6wiyjNtZ";
export const RPC_URL = `https://api.mainnet-beta.solana.com/`;

export const TEST_RELAY_URL = process.env.TEST_RELAY_URL
  ? process.env.TEST_RELAY_URL
  : "ws://localhost:5000";

export const TEST_JSONRPC_METHOD = "test_method";
export const TEST_JSONRPC_REQUEST = { method: TEST_JSONRPC_METHOD, params: [] };
export const TEST_JSONRPC_RESULT = "it worked";

export const TEST_CHAINS = [CHAIN_ID];
export const TEST_METHODS = [TEST_JSONRPC_METHOD];

export const TEST_APP_METADATA = {
  name: "Test App",
  description: "Test App for WalletConnect",
  url: "https://walletconnect.com/",
  icons: ["https://avatars.githubusercontent.com/u/37784886"],
};

export const TEST_WALLET_METADATA = {
  name: "Test Wallet",
  description: "Test Wallet for WalletConnect",
  url: "https://walletconnect.com/",
  icons: ["https://avatars.githubusercontent.com/u/37784886"],
};

export const TEST_SOLANA_KEYPAIR_1 = {
  publicKey: "A4aVtbwfHDX2RsGyoLMe7jQqeTuFmMhGTqHYNUZ9cpB5",
  privateKey:
    "G282j1ejo5LbL4DqBR4G5i9EQZk1FPZa2ZR4VE9x6JaHqfie3nrrgcGL6UXLfXrappiPnWSWK5F1kz3Xduoy57H",
};

export const TEST_SOLANA_KEYPAIR_2 = {
  publicKey: "3e5AWWJLP74qxdNedTpb6BMwKpxt7Te342fKGb7riQo2",
  privateKey:
    "4YqhFf2e2qzuvPHVoEbSnjrGZmzRUBdmiFoSZj4SbsvcpigWrXBc94c5JCzVuKnV5fGTQwGGyZL93XkB4gdVTYun",
};

export const TEST_TRANSACTION_SIGNATURE =
  "mQmf4iipWAAadWpbQSxV6Qsn92JcTsWZ4XPSPZpnjoHMpjyFNxoj8P168tL1aa799mN5D6CasbGZgFzX1tg51YC";

export const TEST_RECENT_BLOCK_HASH = "F1bSUud8754dv3D4wB8LQb2m2snxiuPnLdNFCWfDPZDJ";

export const TEST_TRANSACTION = new Transaction({
  recentBlockhash: TEST_RECENT_BLOCK_HASH,
  feePayer: new PublicKey(TEST_SOLANA_KEYPAIR_1.publicKey),
}).add(
  SystemProgram.transfer({
    fromPubkey: new PublicKey(TEST_SOLANA_KEYPAIR_1.publicKey),
    toPubkey: new PublicKey(TEST_SOLANA_KEYPAIR_2.publicKey),
    lamports: 123,
  }),
);

export const TEST_MESSAGE = base58.encode(Buffer.from("hello world"));
export const TEST_MESSAGE_SIGNATURE =
  "2gK63KVgpUMjT612P2iyL1TCZx5zmwbXjNMQ9PqkVrLsUpNuPWUhJhGLp4puzXu87AoNtMASkzziUJmkKCv3wESR";
