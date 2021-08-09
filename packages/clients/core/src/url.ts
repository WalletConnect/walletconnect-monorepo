const mainBridge = "https://bridge.walletconnect.org";

const bridges = [
  "https://a.bridge.walletconnect.org",
  "https://b.bridge.walletconnect.org",
  "https://c.bridge.walletconnect.org",
  "https://d.bridge.walletconnect.org",
  "https://e.bridge.walletconnect.org",
  "https://f.bridge.walletconnect.org",
  "https://g.bridge.walletconnect.org",
  "https://h.bridge.walletconnect.org",
  "https://i.bridge.walletconnect.org",
  "https://j.bridge.walletconnect.org",
  "https://k.bridge.walletconnect.org",
  "https://l.bridge.walletconnect.org",
];

export function randomBridgeIndex(): number {
  return Math.floor(Math.random() * bridges.length);
}

export function selectRandomBridgeUrl(): string {
  return bridges[randomBridgeIndex()];
}

export function getBridgeUrl(bridge: string): string {
  if (bridge === mainBridge || bridges.includes(bridge)) {
    return selectRandomBridgeUrl();
  }
  return bridge;
}
