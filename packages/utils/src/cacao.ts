import { hashMessage } from "@ethersproject/hash";
import { recoverAddress } from "@ethersproject/transactions";

export interface CacaoPayload {
  iss: string;
  domain: string;
  aud: string;
  version: string;
  nonce: string;
  iat: string;
  nbf?: string;
  exp?: string;
  statement?: string;
  requestId?: string;
  resources?: string[];
}

export interface CacaoHeader {
  t: "eip4361";
}

export interface CacaoSignature {
  t: "eip191" | "eip1271";
  s: string;
  m?: string;
}

export interface Cacao {
  h: CacaoHeader;
  p: CacaoPayload;
  s: CacaoSignature;
}

export const getDidAddressSegments = (iss: string) => {
  return iss?.split(":");
};

export const getDidChainId = (iss: string) => {
  const segments = iss && getDidAddressSegments(iss);
  if (segments) {
    return segments[3];
  }
  return undefined;
};

export const getNamespacedDidChainId = (iss: string) => {
  const segments = iss && getDidAddressSegments(iss);
  if (segments) {
    return segments[2] + ":" + segments[3];
  }
  return undefined;
};

export const getDidAddress = (iss: string) => {
  const segments = iss && getDidAddressSegments(iss);
  if (segments) {
    return segments.pop();
  }
  return undefined;
};

export const formatMessage = (cacao: CacaoPayload, iss: string) => {
  const header = `${cacao.domain} wants you to sign in with your Ethereum account:`;
  const walletAddress = getDidAddress(iss);
  const statement = cacao.statement;
  const uri = `URI: ${cacao.aud}`;
  const version = `Version: ${cacao.version}`;
  const chainId = `Chain ID: ${getDidChainId(iss)}`;
  const nonce = `Nonce: ${cacao.nonce}`;
  const issuedAt = `Issued At: ${cacao.iat}`;
  const resources =
    cacao.resources && cacao.resources.length > 0
      ? `Resources:\n${cacao.resources.map((resource) => `- ${resource}`).join("\n")}`
      : undefined;

  const message = [
    header,
    walletAddress,
    ``,
    statement,
    ``,
    uri,
    version,
    chainId,
    nonce,
    issuedAt,
    resources,
  ]
    .filter((val) => val !== undefined && val !== null) // remove unnecessary empty lines
    .join("\n");

  return message;
};

function isValidEip191Signature(address: string, message: string, signature: string): boolean {
  const recoveredAddress = recoverAddress(hashMessage(message), signature);
  return recoveredAddress.toLowerCase() === address.toLowerCase();
}

export async function verifySignature(
  address: string,
  reconstructedMessage: string,
  cacaoSignature: CacaoSignature,
): Promise<boolean> {
  // Determine if this signature is from an EOA or a contract.
  switch (cacaoSignature.t) {
    case "eip191":
      return isValidEip191Signature(address, reconstructedMessage, cacaoSignature.s);
    default:
      throw new Error(
        `verifySignature failed: Attempted to verify CacaoSignature with unknown type: ${cacaoSignature.t}`,
      );
  }
}
