import { JsonRpcRequest } from "@walletconnect/jsonrpc-utils";

import {
  NamespaceMetadata,
  ChainMetadata,
  ChainRequestRender,
  convertHexToNumber,
  convertHexToUtf8,
} from "../helpers";
import { BLOCKCHAIN_LOGO_BASE_URL } from "../constants";

export const EIP155Metadata: NamespaceMetadata = {
  "1": {
    name: "Ethereum",
    logo: BLOCKCHAIN_LOGO_BASE_URL + "eip155:1.png",
    rgb: "99, 125, 234",
  },
  "5": {
    logo: BLOCKCHAIN_LOGO_BASE_URL + "eip155:5.png",
    rgb: "189, 174, 155",
  },
  "10": {
    name: "Optimism",
    logo: BLOCKCHAIN_LOGO_BASE_URL + "eip155:10.png",
    rgb: "233, 1, 1",
  },
  "42": {
    logo: BLOCKCHAIN_LOGO_BASE_URL + "eip155:42.png",
    rgb: "99, 125, 234",
  },
  "69": {
    logo: BLOCKCHAIN_LOGO_BASE_URL + "eip155:69.png",
    rgb: "233, 1, 1",
  },
  "100": {
    logo: BLOCKCHAIN_LOGO_BASE_URL + "eip155:100.png",
    rgb: "73, 169, 166",
  },
  "137": {
    name: "Matic",
    logo: BLOCKCHAIN_LOGO_BASE_URL + "eip155:137.png",
    rgb: "43, 109, 239",
  },
  "80001": {
    logo: BLOCKCHAIN_LOGO_BASE_URL + "eip155:80001.png",
    rgb: "43, 109, 239",
  },
  "421611": {
    logo: BLOCKCHAIN_LOGO_BASE_URL + "eip155:421611.png",
    rgb: "44, 55, 75",
  },
};

export function getChainMetadata(chainId: string): ChainMetadata {
  const reference = chainId.split(":")[1];
  const metadata = EIP155Metadata[reference];
  if (typeof metadata === "undefined") {
    throw new Error(`No chain metadata found for chainId: ${chainId}`);
  }
  return metadata;
}

export function getChainRequestRender(request: JsonRpcRequest): ChainRequestRender[] {
  let params = [{ label: "Method", value: request.method }];

  switch (request.method) {
    case "eth_sendTransaction":
    case "eth_signTransaction":
      params = [
        ...params,
        { label: "From", value: request.params[0].from },
        { label: "To", value: request.params[0].to },
        {
          label: "Gas Limit",
          value: request.params[0].gas
            ? convertHexToNumber(request.params[0].gas)
            : request.params[0].gasLimit
            ? convertHexToNumber(request.params[0].gasLimit)
            : "",
        },
        {
          label: "Gas Price",
          value: convertHexToNumber(request.params[0].gasPrice),
        },
        {
          label: "Nonce",
          value: convertHexToNumber(request.params[0].nonce),
        },
        {
          label: "Value",
          value: request.params[0].value ? convertHexToNumber(request.params[0].value) : "",
        },
        { label: "Data", value: request.params[0].data },
      ];
      break;

    case "eth_sign":
      params = [
        ...params,
        { label: "Address", value: request.params[0] },
        { label: "Message", value: request.params[1] },
      ];
      break;
    case "personal_sign":
      params = [
        ...params,
        { label: "Address", value: request.params[1] },
        {
          label: "Message",
          value: convertHexToUtf8(request.params[0]),
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
