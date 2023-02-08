const domain = "walletconnect.org";

const alphanumerical = "abcdefghijklmnopqrstuvwxyz0123456789";

const bridges = alphanumerical.split("").map(char => `https://${char}.bridge.walletconnect.org`);

export function extractHostname(url: string): string {
  // find & remove protocol
  let hostname = url.indexOf("//") > -1 ? url.split("/")[2] : url.split("/")[0];
  // find & remove port number
  hostname = hostname.split(":")[0];
  // find & remove query string
  hostname = hostname.split("?")[0];
  return hostname;
}

export function extractRootDomain(url: string): string {
  return extractHostname(url)
    .split(".")
    .slice(-2)
    .join(".");
}

export function randomBridgeIndex(): number {
  return Math.floor(Math.random() * bridges.length);
}

export function selectRandomBridgeUrl(): string {
  return bridges[randomBridgeIndex()];
}

export function shouldSelectRandomly(url: string): boolean {
  return extractRootDomain(url) === domain;
}

export function getBridgeUrl(url: string): string {
  if (shouldSelectRandomly(url)) {
    return selectRandomBridgeUrl();
  }
  return url;
}
