import { EngineTypes, RelayerTypes } from "@walletconnect/types";
import { fromBase64 } from "./misc.js";

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
  if (!str.includes("wc:")) {
    const parsed = fromBase64(str);
    if (parsed?.includes("wc:")) {
      str = parsed;
    }
  }

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
  const queryParams = Object.fromEntries(urlSearchParams.entries());
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
    const typedKey = key as keyof typeof relay;
    const k = prefix + delimiter + typedKey;
    if (relay[typedKey]) {
      params[k] = relay[typedKey];
    }
  });
  return params;
}

export function formatUri(params: EngineTypes.UriParameters): string {
  const urlSearchParams = new URLSearchParams();

  // Combine all params into a single object first
  const allParams = {
    ...formatRelayParams(params.relay),
    symKey: params.symKey,
    ...(params.expiryTimestamp && { expiryTimestamp: params.expiryTimestamp.toString() }),
    ...(params.methods && { methods: params.methods.join(",") }),
  };

  // Sort and append all at once
  Object.entries(allParams)
    .sort(([a], [b]) => a.localeCompare(b))
    .forEach(([key, value]) => {
      if (value !== undefined) {
        urlSearchParams.append(key, String(value));
      }
    });

  return `${params.protocol}:${params.topic}@${params.version}?${urlSearchParams}`;
}

export function getLinkModeURL(
  universalLink: string,
  topic: string,
  encodedEnvelope: string,
): string {
  return `${universalLink}?wc_ev=${encodedEnvelope}&topic=${topic}`;
}
