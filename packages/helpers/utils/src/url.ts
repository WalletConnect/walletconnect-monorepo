export function getQueryString(url: string): string {
  const pathEnd: number | undefined = url.indexOf("?") !== -1 ? url.indexOf("?") : undefined;

  const queryString: string = typeof pathEnd !== "undefined" ? url.substring(pathEnd) : "";

  return queryString;
}

export function appendToQueryString(queryString: string, newQueryParams: any): string {
  let queryParams = parseQueryString(queryString);

  queryParams = { ...queryParams, ...newQueryParams };

  queryString = formatQueryString(queryParams);

  return queryString;
}

export function parseQueryString(queryString: string): any {
  const params = new URLSearchParams(queryString);
  return Object.fromEntries(params.entries());
}

export function formatQueryString(queryParams: any): string {
  return new URLSearchParams(queryParams).toString();
}
