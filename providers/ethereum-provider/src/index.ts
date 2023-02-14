import { EthereumProvider as Provider } from "./EthereumProvider";
export const EthereumProvider = Provider;
export type { RpcEvent, RpcMethod } from "./EthereumProvider";
export { OPTIONAL_METHODS, REQUIRED_EVENTS, REQUIRED_METHODS, OPTIONAL_EVENTS } from "./constants";
export default Provider;
