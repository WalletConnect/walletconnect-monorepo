// the `st` of Universal Provider's funnel events in Pulse; `events_sdk` is reserved for wallets
export const METERING_SDK_TYPE = "universal-provider";

// signing methods that count as SIGN_SUCCESS, by CAIP-2 namespace (bip122 methods have no prefix)
export const SIGNING_METHODS: Record<string, string[]> = {
  eip155: [
    "eth_sendTransaction",
    "eth_signTransaction",
    "eth_sign",
    "personal_sign",
    "eth_signTypedData",
    "eth_signTypedData_v3",
    "eth_signTypedData_v4",
    "wallet_sendCalls",
  ],
  solana: [
    "solana_signMessage",
    "solana_signTransaction",
    "solana_signAllTransactions",
    "solana_signAndSendTransaction",
  ],
  cosmos: ["cosmos_signDirect", "cosmos_signAmino"],
  polkadot: ["polkadot_signTransaction", "polkadot_signMessage"],
  bip122: ["signMessage", "signPsbt", "sendTransfer"],
  tron: ["tron_signTransaction", "tron_signMessage"],
  sui: ["sui_signTransaction", "sui_signAndExecuteTransaction", "sui_signPersonalMessage"],
};
