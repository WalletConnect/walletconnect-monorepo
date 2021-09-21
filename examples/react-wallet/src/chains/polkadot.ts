import { JsonRpcRequest } from "@walletconnect/jsonrpc-utils";
import { BLOCKCHAIN_LOGO_BASE_URL } from "../constants";

import { NamespaceMetadata, ChainMetadata, ChainRequestRender } from "../helpers";

export const PolkadotMetadata: NamespaceMetadata = {
  // eslint-disable-next-line no-useless-computed-key
  ["91b171bb158e2d3848fa23a9f1c25182"]: {
    logo: BLOCKCHAIN_LOGO_BASE_URL + "polkadot:91b171bb158e2d3848fa23a9f1c25182.png",
    rgb: "230, 1, 122",
  },
};

export function getChainMetadata(chainId: string): ChainMetadata {
  const reference = chainId.split(":")[1];
  const metadata = PolkadotMetadata[reference];
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
