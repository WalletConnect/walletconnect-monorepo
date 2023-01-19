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
