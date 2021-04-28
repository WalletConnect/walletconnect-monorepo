import { JsonRpcRequest } from "@json-rpc-tools/utils";
import { config } from "caip-api";

import cosmosLogo from "../assets/cosmos.png";

import { NamespaceMetadata, ChainMetadata, ChainRequestRender } from "../helpers";

export const CosmosMetadata: NamespaceMetadata = {
  "cosmoshub-3": {
    ...config.cosmos["cosmoshub-3"],
    logo: cosmosLogo,
    rgb: "27, 31, 53",
  },
};

export function getChainMetadata(chainId: string): ChainMetadata {
  const reference = chainId.split(":")[1];
  const metadata = CosmosMetadata[reference];
  if (typeof metadata === "undefined") {
    throw new Error(`No chain metadata found for chainId: ${chainId}`);
  }
  return metadata;
}

export function getChainRequestRender(request: JsonRpcRequest): ChainRequestRender[] {
  let params = [{ label: "Method", value: request.method }];

  switch (request.method) {
    default:
      params = [
        ...params,
        {
          label: "params",
          value: JSON.stringify(request.params, null, "\t"),
        },
      ];
      break;
  }
  return params;
}
