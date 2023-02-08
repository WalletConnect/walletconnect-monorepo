import {
  IParseURIResult,
  IRequiredParamsResult,
  IQueryParamsResult,
  IWalletConnectSession,
} from "@walletconnect/legacy-types";

import { parseQueryString } from "./url";

export function isWalletConnectSession(object: any): object is IWalletConnectSession {
  return typeof object.bridge !== "undefined";
}

export function parseWalletConnectUri(str: string): IParseURIResult {
  const pathStart: number = str.indexOf(":");

  const pathEnd: number | undefined = str.indexOf("?") !== -1 ? str.indexOf("?") : undefined;

  const protocol: string = str.substring(0, pathStart);

  const path: string = str.substring(pathStart + 1, pathEnd);

  function parseRequiredParams(path: string): IRequiredParamsResult {
    const separator = "@";

    const values = path.split(separator);

    const requiredParams = {
      handshakeTopic: values[0],
      version: parseInt(values[1], 10),
    };

    return requiredParams;
  }

  const requiredParams: IRequiredParamsResult = parseRequiredParams(path);

  const queryString: string = typeof pathEnd !== "undefined" ? str.substr(pathEnd) : "";

  function parseQueryParams(queryString: string): IQueryParamsResult {
    const result = parseQueryString(queryString);

    const parameters: IQueryParamsResult = {
      key: result.key || "",
      bridge: result.bridge || "",
    };

    return parameters;
  }

  const queryParams: IQueryParamsResult = parseQueryParams(queryString);

  const result: IParseURIResult = {
    protocol,
    ...requiredParams,
    ...queryParams,
  };

  return result;
}
