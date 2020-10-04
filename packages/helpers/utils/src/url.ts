import * as queryStringUtils from "query-string";

export function getQueryString(url: string): string {
  const pathEnd: number | undefined = url.indexOf("?") !== -1 ? url.indexOf("?") : undefined;

  const queryString: string = typeof pathEnd !== "undefined" ? url.substr(pathEnd) : "";

  return queryString;
}

export function appendToQueryString(queryString: string, newQueryParams: any): string {
  let queryParams = parseQueryString(queryString);

  queryParams = { ...queryParams, ...newQueryParams };

  queryString = formatQueryString(queryParams);

  return queryString;
}

export function parseQueryString(queryString: string): any {
  return queryStringUtils.parse(queryString);
}

export function formatQueryString(queryParams: any): string {
  return queryStringUtils.stringify(queryParams);
}
