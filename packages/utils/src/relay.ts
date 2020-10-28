import { RelayTypes } from "@walletconnect/types";

export const RELAY_JSON_RPC: { [protocol: string]: RelayTypes.JsonRpcMethods } = {
  bridge: {
    isConnected: "bridge_isConnected",
    connect: "bridge_connect",
    disconnect: "bridge_disconnect",
    publish: "bridge_publish",
    subscribe: "bridge_subscribe",
    subscription: "bridge_subscription",
    unsubscribe: "bridge_unsubscribe",
  },
  waku: {
    isConnected: "waku_isConnected",
    connect: "waku_connect",
    disconnect: "waku_disconnect",
    publish: "waku_publish",
    subscribe: "waku_subscribe",
    subscription: "waku_subscription",
    unsubscribe: "waku_unsubscribe",
  },
  webrtc: {
    isConnected: "webrtc_isConnected",
    connect: "webrtc_connect",
    disconnect: "webrtc_disconnect",
    publish: "webrtc_publish",
    subscribe: "webrtc_subscribe",
    subscription: "webrtc_subscription",
    unsubscribe: "webrtc_unsubscribe",
  },
};

export function getRelayProtocolJsonRpc(protocol: string): RelayTypes.JsonRpcMethods {
  const jsonrpc = RELAY_JSON_RPC[protocol];
  if (typeof jsonrpc === "undefined") {
    throw new Error(`Relay Protocol not supported: ${protocol}`);
  }
  return jsonrpc;
}
