import { JsonRpcRequest } from "@walletconnect/jsonrpc-utils";

import * as eip155 from "./eip155";
import * as cosmos from "./cosmos";
import * as polkadot from "./polkadot";

import { ChainMetadata, ChainRequestRender } from "../helpers";

export function getChainMetadata(chainId: string): ChainMetadata {
  const namespace = chainId.split(":")[0];
  switch (namespace) {
    case "eip155":
      return eip155.getChainMetadata(chainId);
    case "cosmos":
      return cosmos.getChainMetadata(chainId);
    case "polkadot":
      return polkadot.getChainMetadata(chainId);
    default:
      throw new Error(`No metadata handler for namespace ${namespace}`);
  }
}

export function getChainRequestRender(
  request: JsonRpcRequest,
  chainId: string,
): ChainRequestRender[] {
  const namespace = chainId.split(":")[0];
  switch (namespace) {
    case "eip155":
      return eip155.getChainRequestRender(request);
    case "cosmos":
      return cosmos.getChainRequestRender(request);
    case "polkadot":
      return polkadot.getChainRequestRender(request);
    default:
      throw new Error(`No render handler for namespace ${namespace}`);
  }
}
