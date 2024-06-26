import { EthereumProvider as Provider } from "./EthereumProvider";
export const EthereumProvider = Provider;
export type { EthereumProviderOptions, RpcEvent, RpcMethod } from "./EthereumProvider";
export * from "./constants/rpc";
export default Provider;
