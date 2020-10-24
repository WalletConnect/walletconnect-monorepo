import * as queryStringUtils from "query-string";

// -- uri -------------------------------------------------- //

export function formatUri(
  protocol: string,
  version: number,
  topic: string,
  params: Record<string, string>,
) {
  return `${protocol}:${topic}@${version}` + queryStringUtils.stringify(params);
}

export function parseUri(str: string): any {
  const pathStart: number = str.indexOf(":");

  const pathEnd: number | undefined = str.indexOf("?") !== -1 ? str.indexOf("?") : undefined;

  const protocol: string = str.substring(0, pathStart);

  const path: string = str.substring(pathStart + 1, pathEnd);

  function parseRequiredParams(path: string) {
    const separator = "@";

    const values = path.split(separator);

    const requiredParams = {
      topic: values[0],
      version: parseInt(values[1], 10),
    };

    return requiredParams;
  }

  const requiredParams = parseRequiredParams(path);

  const queryString: string = typeof pathEnd !== "undefined" ? str.substr(pathEnd) : "";

  const queryParams = queryStringUtils.parse(queryString);

  const result = {
    protocol,
    ...requiredParams,
    ...queryParams,
  };

  return result;
}
