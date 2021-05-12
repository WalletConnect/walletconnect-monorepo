export function assertType(obj: any, key: string, type = "string") {
  if (!obj[key] || typeof obj[key] !== type) {
    throw new Error(`Missing or invalid "${key}" param`);
  }
}

export function isSecureProtocol(protocol: string) {
  return protocol.includes("https") || protocol.includes("wss");
}

export function getWsUrl(urlString: string): string {
  const url = new URL(urlString);
  const protocol = isSecureProtocol(url.protocol) ? "wss:" : "ws:";
  return `${protocol}//${url.host}`;
}

export function getHttpUrl(urlString: string): string {
  const url = new URL(urlString);
  const protocol = isSecureProtocol(url.protocol) ? "https:" : "http:";
  return `${protocol}//${url.host}`;
}
