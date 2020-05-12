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
  const result: any = {};

  const pairs = (queryString[0] === "?" ? queryString.substr(1) : queryString).split("&");

  for (let i = 0; i < pairs.length; i++) {
    const keyArr: string[] = pairs[i].match(/\w+(?==)/i) || [];
    const valueArr: string[] = pairs[i].match(/=.+/i) || [];
    if (keyArr[0]) {
      result[decodeURIComponent(keyArr[0])] = decodeURIComponent(valueArr[0].substr(1));
    }
  }

  return result;
}

export function formatQueryString(queryParams: any): string {
  let result = "";

  const keys = Object.keys(queryParams);

  if (keys) {
    keys.forEach((key: string, idx: number) => {
      const value = queryParams[key];
      if (idx === 0) {
        result = `?${key}=${value}`;
      } else {
        result = result + `&${key}=${value}`;
      }
    });
  }

  return result;
}
