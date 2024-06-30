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
  // remove android schema prefix
  str = str.includes("wc://") ? str.replace("wc://", "") : str;
  // remove ios schema prefix
  str = str.includes("wc:") ? str.replace("wc:", "") : str;
  const pathStart: number = str.indexOf(":");
  const pathEnd: number | undefined = str.indexOf("?") !== -1 ? str.indexOf("?") : undefined;
  const protocol: string = str.substring(0, pathStart);
  const path: string = str.substring(pathStart + 1, pathEnd);
  const requiredValues = path.split("@");
  const queryString: string = typeof pathEnd !== "undefined" ? str.substring(pathEnd) : "";

  const urlSearchParams = new URLSearchParams(queryString);
  const queryParams: Record<string, string> = {};
  urlSearchParams.forEach((value, key) => {
    queryParams[key] = value;
  });

  const methods =
    typeof queryParams.methods === "string" ? queryParams.methods.split(",") : undefined;
  const result = {
    protocol,
    topic: parseTopic(requiredValues[0]),
    version: parseInt(requiredValues[1], 10),
    symKey: queryParams.symKey as string,
    relay: parseRelayParams(queryParams),
    methods,
    expiryTimestamp: queryParams.expiryTimestamp
      ? parseInt(queryParams.expiryTimestamp as string, 10)
      : undefined,
  };
  return result;
}

export function parseTopic(topic: string): string {
  return topic.startsWith("//") ? topic.substring(2) : topic;
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
  const urlSearchParams = new URLSearchParams();

  const relayParams = formatRelayParams(params.relay);
  Object.keys(relayParams)
    .sort()
    .forEach((key) => {
      urlSearchParams.set(key, relayParams[key]);
    });

  urlSearchParams.set("symKey", params.symKey);
  if (params.expiryTimestamp)
    urlSearchParams.set("expiryTimestamp", params.expiryTimestamp.toString());

  if (params.methods) {
    urlSearchParams.set("methods", params.methods.join(","));
  }

  const queryString = urlSearchParams.toString();
  return `${params.protocol}:${params.topic}@${params.version}?${queryString}`;
}
