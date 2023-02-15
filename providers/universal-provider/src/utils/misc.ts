import { Namespace } from "../types";

export function getRpcUrl(chainId: string, rpc: Namespace): string | undefined {
  let rpcUrl: string | undefined;
  if (rpc.rpcMap) {
    rpcUrl = rpc.rpcMap[getChainId(chainId)];
  }
  return rpcUrl;
}

export function getChainId(chain: string): number {
  return Number(chain.split(":")[1]);
}

export function validateChainApproval(chain: string, chains: string[]): void {
  if (!chains.includes(chain)) {
    throw new Error(
      `Chain '${chain}' not approved. Please use one of the following: ${chains.toString()}`,
    );
  }
}

export function getChainsFromApprovedSession(accounts: string[]): string[] {
  return accounts.map((address) => `${address.split(":")[0]}:${address.split(":")[1]}`);
}
