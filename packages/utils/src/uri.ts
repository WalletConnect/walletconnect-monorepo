import * as queryStringUtils from "query-string";
import { UriParameters } from "@walletconnect/types";
import { safeJsonParse, safeJsonStringify } from "safe-json-utils";

// -- uri -------------------------------------------------- //

export function formatUri(params: UriParameters): string {
  return (
    `${params.protocol}:${params.topic}@${params.version}?` +
    queryStringUtils.stringify({
      publicKey: params.publicKey,
      relay: safeJsonStringify(params.relay),
    })
  );
}

export function parseUri(str: string): UriParameters {
  const pathStart: number = str.indexOf(":");

  const pathEnd: number | undefined = str.indexOf("?") !== -1 ? str.indexOf("?") : undefined;

  const protocol: string = str.substring(0, pathStart);

  const path: string = str.substring(pathStart + 1, pathEnd);

  const requiredValues = path.split("@");

  const queryString: string = typeof pathEnd !== "undefined" ? str.substr(pathEnd) : "";

  const queryParams = queryStringUtils.parse(queryString);

  const result = {
    protocol,
    topic: requiredValues[0],
    version: parseInt(requiredValues[1], 10),
    publicKey: queryParams.publicKey as string,
    relay: safeJsonParse(queryParams.relay as string),
  };

  return result;
}
