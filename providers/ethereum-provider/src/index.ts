import { EthereumProvider as Provider } from "./EthereumProvider.js";
export const EthereumProvider = Provider;
export type { EthereumProviderOptions, RpcEvent, RpcMethod } from "./EthereumProvider";
export type { WalletFee } from "@walletconnect/universal-provider";
export * from "./constants/rpc.js";
export default Provider;
