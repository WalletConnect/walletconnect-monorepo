import { config } from "caip-api";
import { jsonrpc } from "caip-wallet";

export const DEFAULT_MAIN_CHAINS = Object.keys(config.eip155)
  .filter(x => !config.eip155[x].testNet)
  .map(x => `eip155:${x}`);

export const DEFAULT_TEST_CHAINS = Object.keys(config.eip155)
  .filter(x => !!config.eip155[x].testNet)
  .map(x => `eip155:${x}`);

export const DEFAULT_RELAY_PROVIDER = "wss://relay.walletconnect.org";

export const DEFAULT_METHODS = jsonrpc.eip155.wallet.auth;

export const DEFAULT_LOGGER = "debug";

export const DEFAULT_APP_METADATA = {
  name: "React Wallet",
  description: "React Wallet for WalletConnect",
  url: "https://walletconnect.org/",
  icons: ["https://walletconnect.org/walletconnect-logo.png"],
};
