import { RPC_URL } from "../constants";
import { Namespace } from "../types";

export function getRpcUrl(chainId: string, rpc: Namespace, projectId?: string): string | undefined {
  let rpcUrl: string | undefined;
  const parsedChainId = getChainId(chainId);
  if (rpc.rpcMap) {
    rpcUrl = rpc.rpcMap[parsedChainId];
  }

  if (!rpcUrl) {
    rpcUrl = `${RPC_URL}?chainId=eip155:${parsedChainId}&projectId=${projectId}`;
  }
  return rpcUrl;
}

export function getChainId(chain: string): number {
  return chain.includes("eip155") ? Number(chain.split(":")[1]) : Number(chain);
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
