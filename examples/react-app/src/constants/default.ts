import { config } from "caip-api";

export const DEFAULT_MAIN_CHAINS = Object.keys(config.eip155)
  .filter((x) => !config.eip155[x].testNet)
  .map((x) => `eip155:${x}`);

export const DEFAULT_TEST_CHAINS = Object.keys(config.eip155)
  .filter((x) => !!config.eip155[x].testNet)
  .map((x) => `eip155:${x}`);

export const DEFAULT_RELAY_PROVIDER = "wss://bridge.walletconnect.org";

export const DEFAULT_METHODS = ["eth_sendTransaction", "personal_sign", "eth_signTypedData"];

export const DEFAULT_LOGGER = "debug";

export const DEFAULT_APP_METADATA = {
  name: "Example App",
  description: "Example App for WalletConnect",
  url: "https://walletconnect.org/",
  icons: ["https://walletconnect.org/walletconnect-logo.png"],
};
