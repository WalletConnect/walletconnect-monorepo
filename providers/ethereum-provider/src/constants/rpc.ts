export const REQUIRED_METHODS = ["eth_sendTransaction", "personal_sign", "eth_signTypedData_v4"];
export const OPTIONAL_METHODS = [
  "eth_accounts",
  "eth_requestAccounts",
  "eth_call",
  "eth_getBalance",
  "eth_sendRawTransaction",
  "eth_sign",
  "eth_signTransaction",
  "eth_signTypedData",
  "eth_signTypedData_v3",
  "wallet_switchEthereumChain",
  "wallet_addEthereumChain",
  "wallet_getPermissions",
  "wallet_requestPermissions",
  "wallet_registerOnboarding",
  "wallet_watchAsset",
  "wallet_scanQRCode",
];
export const REQUIRED_EVENTS = ["chainChanged", "accountsChanged"];
export const OPTIONAL_EVENTS = ["message", "disconnect", "connect"];
