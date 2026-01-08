import { UtilsTypes } from "../types/index.js";

export const DEFAULT_NAMESPACES: UtilsTypes.SupportedNamespaces = [
  {
    assetNamespaces: ["erc20", "slip44"],
    capabilities: null,
    events: [],
    methods: ["eth_sendTransaction"],
    name: "eip155",
  },
  {
    assetNamespaces: ["token", "slip44"],
    capabilities: null,
    events: [],
    methods: ["solana_signAndSendTransaction"],
    name: "solana",
  },
  {
    assetNamespaces: ["trc20", "slip44"],
    capabilities: null,
    events: [],
    methods: ["tron_signTransaction"],
    name: "tron",
  },
] as const;
