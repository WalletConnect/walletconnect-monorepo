import { JsonRpcRequest } from "@walletconnect/jsonrpc-utils";

import { BLOCKCHAIN_LOGO_BASE_URL } from "../constants";

import { NamespaceMetadata, ChainMetadata, ChainRequestRender } from "../helpers";

export const CosmosMetadata: NamespaceMetadata = {
  "cosmoshub-4": {
    logo: BLOCKCHAIN_LOGO_BASE_URL + "cosmos:cosmoshub-4.png",
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
    case "cosmos_signDirect":
      params = [
        ...params,
        {
          label: "SignerAddress",
          value: request.params.signerAddress,
        },
        {
          label: "ChainId",
          value: request.params.signDoc.chainId,
        },
        {
          label: "AccountNumber",
          value: request.params.signDoc.accountNumber,
        },
        {
          label: "AuthInfo",
          value: request.params.signDoc.authInfoBytes,
        },
        {
          label: "Body",
          value: request.params.signDoc.bodyBytes,
        },
      ];
      break;
    case "cosmos_signAmino":
      params = [
        ...params,
        {
          label: "SignerAddress",
          value: request.params.signerAddress,
        },
        {
          label: "ChainId",
          value: request.params.signDoc.chain_id,
        },
        {
          label: "AccountNumber",
          value: request.params.signDoc.account_number,
        },
        {
          label: "Messages",
          value: JSON.stringify(request.params.signDoc.msgs, null, "\t"),
        },
        {
          label: "Sequence",
          value: request.params.signDoc.sequence,
        },
        {
          label: "Memo",
          value: request.params.signDoc.memo,
        },
      ];
      break;
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
