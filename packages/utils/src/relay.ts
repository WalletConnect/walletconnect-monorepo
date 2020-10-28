import { RelayTypes } from "@walletconnect/types";

export const RELAY_JSON_RPC: { [protocol: string]: RelayTypes.JsonRpcMethods } = (() => {
  const protocols = ["bridge", "waku", "webrtc"];
  const jsonrpc: { [protocol: string]: RelayTypes.JsonRpcMethods } = {};
  protocols.forEach(protocol => {
    const methods: RelayTypes.JsonRpcMethods = {
      isConnected: "",
      connect: "",
      disconnect: "",
      publish: "",
      subscribe: "",
      subscription: "",
      unsubscribe: "",
    };
    Object.keys(methods).forEach(method => {
      methods[method] = `${protocol}_${method}`;
    });
    jsonrpc[protocol] = methods;
  });
  return jsonrpc;
})();

export function getRelayProtocolJsonRpc(protocol: string): RelayTypes.JsonRpcMethods {
  const jsonrpc = RELAY_JSON_RPC[protocol];
  if (typeof jsonrpc === "undefined") {
    throw new Error(`Relay Protocol not supported: ${protocol}`);
  }
  return jsonrpc;
}
