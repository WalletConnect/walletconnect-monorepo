export const WALLET_METHODS = [
  "wallet_addEthereumChain",
  "wallet_switchEthereumChain",
  "wallet_getPermissions",
  "wallet_requestPermissions",
  "wallet_registerOnboarding",
  "wallet_watchAsset",
  "wallet_scanQRCode",
];

export const SIGNING_METHODS = [
  "eth_sendTransaction",
  "eth_signTransaction",
  "eth_sign",
  "eth_signTypedData",
  "eth_signTypedData_v1",
  "eth_signTypedData_v2",
  "eth_signTypedData_v3",
  "eth_signTypedData_v4",
  "personal_sign",
  ...WALLET_METHODS,
];

// backwards-compatibility alias
export const signingMethods = SIGNING_METHODS;

export const STATE_METHODS = ["eth_accounts", "eth_chainId", "net_version"];

// backwards-compatibility alias
export const stateMethods = STATE_METHODS;
