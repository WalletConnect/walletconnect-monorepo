import * as qs from "query-string";
import { RelayerTypes, UriParameters } from "@walletconnect/types";

// -- uri -------------------------------------------------- //

const URI_RELAY_PREFIX = "relay";
const URI_RELAY_DELIMITER = "-";

function formatRelayParams(relay: RelayerTypes.ProtocolOptions, delimiter = URI_RELAY_DELIMITER) {
  const prefix = URI_RELAY_PREFIX + delimiter;
  const params: any = {};
  Object.keys(relay).forEach(name => {
    const key = prefix + name;
    if (relay[name]) {
      params[key] = relay[name];
    }
  });
  return params;
}

export function formatUri(params: UriParameters): string {
  return (
    `${params.protocol}:${params.topic}@${params.version}?` +
    qs.stringify({
      symKey: params.symKey,
      ...formatRelayParams(params.relay),
    })
  );
}

function parseRelayParams(params: any, delimiter = URI_RELAY_DELIMITER) {
  const relay: any = {};
  const prefix = URI_RELAY_PREFIX + delimiter;
  Object.keys(params).forEach(key => {
    if (key.startsWith(prefix)) {
      const name = key.replace(prefix, "");
      const value = params[key];
      relay[name] = value;
    }
  });
  if (!relay.data) {
    relay.data = "";
  }
  return relay;
}

export function parseUri(str: string): UriParameters {
  const pathStart: number = str.indexOf(":");
  const pathEnd: number | undefined = str.indexOf("?") !== -1 ? str.indexOf("?") : undefined;
  const protocol: string = str.substring(0, pathStart);
  const path: string = str.substring(pathStart + 1, pathEnd);
  const requiredValues = path.split("@");
  const queryString: string = typeof pathEnd !== "undefined" ? str.substring(pathEnd) : "";
  const queryParams = qs.parse(queryString);
  const result = {
    protocol,
    topic: requiredValues[0],
    version: parseInt(requiredValues[1], 10),
    symKey: queryParams.symKey as string,
    relay: parseRelayParams(queryParams),
  };
  return result;
}
