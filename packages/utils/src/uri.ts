import * as qs from "query-string";
import { EngineTypes, RelayerTypes } from "@walletconnect/types";

// -- uri -------------------------------------------------- //

export function parseRelayParams(params: any, delimiter = "-"): RelayerTypes.ProtocolOptions {
  const relay: any = {};
  const prefix = "relay" + delimiter;
  Object.keys(params).forEach((key) => {
    if (key.startsWith(prefix)) {
      const name = key.replace(prefix, "");
      const value = params[key];
      relay[name] = value;
    }
  });
  return relay;
}

export function parseUri(str: string): EngineTypes.UriParameters {
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

export function formatRelayParams(relay: RelayerTypes.ProtocolOptions, delimiter = "-") {
  const prefix = "relay";
  const params: any = {};
  Object.keys(relay).forEach((key) => {
    const k = prefix + delimiter + key;
    if (relay[key]) {
      params[k] = relay[key];
    }
  });
  return params;
}

export function formatUri(params: EngineTypes.UriParameters): string {
  return (
    `${params.protocol}:${params.topic}@${params.version}?` +
    qs.stringify({
      symKey: params.symKey,
      ...formatRelayParams(params.relay),
    })
  );
}
