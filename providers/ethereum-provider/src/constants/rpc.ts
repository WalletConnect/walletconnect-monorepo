export const REQUIRED_METHODS = ["eth_sendTransaction", "personal_sign"];
export const OPTIONAL_METHODS = [
  "eth_accounts",
  "eth_requestAccounts",
  "eth_sendRawTransaction",
  "eth_sign",
  "eth_signTransaction",
  "eth_signTypedData",
  "eth_signTypedData_v3",
  "eth_signTypedData_v4",
  "eth_sendTransaction",
  "personal_sign",
  "wallet_switchEthereumChain",
  "wallet_addEthereumChain",
  "wallet_getPermissions",
  "wallet_requestPermissions",
  "wallet_registerOnboarding",
  "wallet_watchAsset",
  "wallet_scanQRCode",
  "wallet_sendCalls",
  "wallet_getCapabilities",
  "wallet_getCallsStatus",
  "wallet_showCallsStatus",
];
export const REQUIRED_EVENTS = ["chainChanged", "accountsChanged"];
export const OPTIONAL_EVENTS = [
  "chainChanged",
  "accountsChanged",
  "message",
  "disconnect",
  "connect",
];
