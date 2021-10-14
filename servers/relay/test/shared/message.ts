import { RELAY_JSONRPC, RelayJsonRpc } from "@walletconnect/relay-api";
import { formatJsonRpcRequest, JsonRpcRequest } from "@walletconnect/jsonrpc-utils";

import { LegacySocketMessage } from "../../src/types";
import { generateRandomBytes32 } from "../../src/utils";

import { TEST_MESSAGE } from "./values";

export interface TestJsonRpcPayloads {
  topic: string;
  pub: JsonRpcRequest<RelayJsonRpc.PublishParams>;
  sub: JsonRpcRequest<RelayJsonRpc.SubscribeParams>;
}

export function getTestJsonRpc(
  message = TEST_MESSAGE,
  overrideTopic?: string,
): TestJsonRpcPayloads {
  const topic = overrideTopic || generateRandomBytes32();

  const pub = formatJsonRpcRequest<RelayJsonRpc.PublishParams>(RELAY_JSONRPC.waku.publish, {
    topic,
    message,
    ttl: 86400,
  });

  const sub = formatJsonRpcRequest<RelayJsonRpc.SubscribeParams>(RELAY_JSONRPC.waku.subscribe, {
    topic,
  });
  return { topic, pub, sub };
}

export interface TestLegacyPayloads {
  topic: string;
  pub: LegacySocketMessage;
  sub: LegacySocketMessage;
}

export function getTestLegacy(payload = TEST_MESSAGE): TestLegacyPayloads {
  const topic = generateRandomBytes32();

  const pub: LegacySocketMessage = {
    topic,
    type: "pub",
    payload,
    silent: true,
  };

  const sub: LegacySocketMessage = {
    topic,
    type: "sub",
    payload: "",
    silent: true,
  };

  return { topic, pub, sub };
}
