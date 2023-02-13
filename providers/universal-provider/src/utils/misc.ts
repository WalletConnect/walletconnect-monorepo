import { Namespace } from "../types";

export function getRpcUrl(chainId: string, rpc: Namespace): string | undefined {
  let rpcUrl: string | undefined;
  if (rpc.rpcMap) {
    rpcUrl = rpc.rpcMap[getChainId([chainId])];
  }
  return rpcUrl;
}

export function getChainId(chains: string[]): number {
  return Number(chains[0].split(":")[1]);
}

export function deeplinkRedirect() {
  if (typeof window !== "undefined") {
    try {
      const item = window.localStorage.getItem("WALLETCONNECT_DEEPLINK_CHOICE");
      if (item) {
        const json = JSON.parse(item);
        window.open(json.href, "_self", "noreferrer noopener");
      }
    } catch (err) {
      // Silent error, just log in console
      // eslint-disable-next-line no-console
      console.error(err);
    }
  }
}
