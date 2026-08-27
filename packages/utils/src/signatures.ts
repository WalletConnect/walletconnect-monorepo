import { keccak_256 } from "@noble/hashes/sha3";
import { Secp256k1, Signature } from "ox";
import { sha256, sha512_256 } from "@noble/hashes/sha2";
import { blake2b } from "@noble/hashes/blake2";
import { encode as msgpackEncode, decode as msgpackDecode } from "@msgpack/msgpack";
import { base32, base58 } from "@scure/base";
import { concat, toString } from "uint8arrays";
import { AuthTypes } from "@walletconnect/types";

import { parseChainId } from "./caip.js";

const DEFAULT_RPC_URL = "https://rpc.walletconnect.org/v1";

function base64ToBytes(b64: string): Uint8Array {
  const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export function hashEthereumMessage(message: string) {
  // EIP-191 (version 0x45) prefixes the UTF-8 *byte* length of the message. `message.length`
  // counts UTF-16 code units instead, which differs for any non-ASCII character (e.g. a SIWE
  // statement such as `Sign in to Café ☕`) and yields a hash that no compliant signer produces.
  const messageBytes = new TextEncoder().encode(message);
  const prefixBytes = new TextEncoder().encode(
    `\x19Ethereum Signed Message:\n${messageBytes.length}`,
  );
  return "0x" + toString(keccak_256(concat([prefixBytes, messageBytes])), "base16");
}

export async function verifySignature(
  address: string,
  reconstructedMessage: string,
  cacaoSignature: AuthTypes.CacaoSignature,
  chainId: string,
  projectId: string,
  baseRpcUrl?: string,
): Promise<boolean> {
  // Determine if this signature is from an EOA or a contract.
  switch (cacaoSignature.t) {
    case "eip191":
      return await isValidEip191Signature(address, reconstructedMessage, cacaoSignature.s);
    case "eip1271":
      return await isValidEip1271Signature(
        address,
        reconstructedMessage,
        cacaoSignature.s,
        chainId,
        projectId,
        baseRpcUrl,
      );
      break;
    default:
      throw new Error(
        `verifySignature failed: Attempted to verify CacaoSignature with unknown type: ${cacaoSignature.t}`,
      );
  }
}

export function isValidEip191Signature(
  address: string,
  message: string,
  signature: string,
): boolean {
  const parsedSignature = Signature.fromHex(signature as `0x${string}`);
  const recoveredAddress = Secp256k1.recoverAddress({
    payload: hashEthereumMessage(message) as `0x${string}`,
    signature: parsedSignature,
  });
  return recoveredAddress.toLowerCase() === address.toLowerCase();
}

export async function isValidEip1271Signature(
  address: string,
  reconstructedMessage: string,
  signature: string,
  chainId: string,
  projectId: string,
  baseRpcUrl?: string,
) {
  const parsedChain = parseChainId(chainId);
  if (!parsedChain.namespace || !parsedChain.reference) {
    throw new Error(
      `isValidEip1271Signature failed: chainId must be in CAIP-2 format, received: ${chainId}`,
    );
  }
  try {
    const eip1271MagicValue = "0x1626ba7e";
    const dynamicTypeOffset = "0000000000000000000000000000000000000000000000000000000000000040";
    const nonPrefixedSignature = signature.substring(2);
    const dynamicTypeLength = (nonPrefixedSignature.length / 2).toString(16).padStart(64, "0");
    const nonPrefixedHashedMessage = (
      reconstructedMessage.startsWith("0x")
        ? reconstructedMessage
        : hashEthereumMessage(reconstructedMessage)
    ).substring(2);
    const data =
      eip1271MagicValue +
      nonPrefixedHashedMessage +
      dynamicTypeOffset +
      dynamicTypeLength +
      nonPrefixedSignature;
    const response = await fetch(
      `${baseRpcUrl || DEFAULT_RPC_URL}/?chainId=${chainId}&projectId=${projectId}`,
      {
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
        body: JSON.stringify({
          id: generateJsonRpcId(),
          jsonrpc: "2.0",
          method: "eth_call",
          params: [{ to: address, data }, "latest"],
        }),
      },
    );
    const { result } = await response.json();
    if (!result) return false;

    // Remove right-padded zeros from result to get only the concrete recovered value.
    const recoveredValue = result.slice(0, eip1271MagicValue.length);
    return recoveredValue.toLowerCase() === eip1271MagicValue.toLowerCase();
  } catch (error: any) {
    // eslint-disable-next-line no-console
    console.error("isValidEip1271Signature: ", error);
    return false;
  }
}

function generateJsonRpcId() {
  return Date.now() + Math.floor(Math.random() * 1000);
}

export function extractSolanaTransactionId(solanaTransaction: string): string {
  const bytes = base64ToBytes(solanaTransaction);

  const signatureCount = bytes[0];
  if (signatureCount === 0) {
    throw new Error("No signatures found");
  }

  const signatureEndPos = 1 + signatureCount * 64;
  if (bytes.length < signatureEndPos) {
    throw new Error("Transaction data too short for claimed signature count");
  }

  if (bytes.length < 100) {
    throw new Error("Transaction too short");
  }

  const signatureBytes = bytes.slice(1, 65);
  return base58.encode(signatureBytes);
}

export function getSuiDigest(transaction: string) {
  const txBytes = base64ToBytes(transaction);
  const typeTagBytes = new TextEncoder().encode("TransactionData::");

  const dataWithTag = new Uint8Array(typeTagBytes.length + txBytes.length);
  dataWithTag.set(typeTagBytes);
  dataWithTag.set(txBytes, typeTagBytes.length);

  const hash = blake2b(dataWithTag, { dkLen: 32 });
  return base58.encode(hash);
}

export function getNearTransactionIdFromSignedTransaction(signedTransaction: unknown) {
  const hash = new Uint8Array(sha256(getNearUint8ArrayFromBytes(signedTransaction)));
  const hashBase58 = base58.encode(hash);
  return hashBase58;
}

export function getNearUint8ArrayFromBytes(bytes: unknown) {
  if (bytes instanceof Uint8Array) {
    return bytes;
  } else if (Array.isArray(bytes)) {
    return new Uint8Array(bytes);
  } else if (typeof bytes === "object" && (bytes as any)?.data) {
    return new Uint8Array(Object.values((bytes as any).data));
  } else if (typeof bytes === "object" && bytes) {
    return new Uint8Array(Object.values(bytes));
  } else {
    throw new Error("getNearUint8ArrayFromBytes: Unexpected result type from bytes array");
  }
}

export function getAlgorandTransactionId(transaction: string) {
  const signedTxnBytes = base64ToBytes(transaction);

  const decoded = msgpackDecode(signedTxnBytes) as any;

  const unsignedTxn = decoded.txn;
  if (!unsignedTxn) {
    throw new Error("Invalid signed transaction: missing 'txn' field");
  }

  const serializedUnsignedTxn = msgpackEncode(unsignedTxn);

  const txPrefix = new TextEncoder().encode("TX");
  const toHash = concat([txPrefix, new Uint8Array(serializedUnsignedTxn)]);

  const hash = sha512_256(toHash);
  return base32.encode(hash).replace(/=+$/, "");
}

function encodeVarint(value: number | bigint): Uint8Array {
  const result: number[] = [];
  let v = BigInt(value);
  while (v >= 0x80n) {
    result.push(Number((v & 0x7fn) | 0x80n));
    v >>= 7n;
  }
  result.push(Number(v));
  return new Uint8Array(result);
}

export function getSignDirectHash(payload: {
  signed: {
    chainId: string;
    accountNumber: string;
    authInfoBytes: string;
    bodyBytes: string;
  };
  signature: {
    pub_key: {
      type: string;
      value: string;
    };
    signature: string;
  };
}) {
  const bodyBytes = base64ToBytes(payload.signed.bodyBytes);
  const authInfoBytes = base64ToBytes(payload.signed.authInfoBytes);
  const signature = base64ToBytes(payload.signature.signature);

  const chunks: Uint8Array[] = [];

  chunks.push(new Uint8Array([0x0a]));
  chunks.push(encodeVarint(bodyBytes.length));
  chunks.push(bodyBytes);

  chunks.push(new Uint8Array([0x12]));
  chunks.push(encodeVarint(authInfoBytes.length));
  chunks.push(authInfoBytes);

  chunks.push(new Uint8Array([0x1a]));
  chunks.push(encodeVarint(signature.length));
  chunks.push(signature);

  const txRawBytes = concat(chunks);
  const hashBytes = sha256(txRawBytes);

  return toString(hashBytes, "base16").toUpperCase();
}

export function getWalletSendCallsHashes(
  result: string | { id: string; capabilities: { caip345: { transactionHashes: string[] } } },
) {
  const hashes: string[] = [];
  try {
    if (typeof result === "string") {
      hashes.push(result);
      return hashes;
    }

    if (typeof result !== "object") {
      return hashes;
    }

    if (result?.id) {
      hashes.push(result.id);
    }

    const txHashes = result?.capabilities?.caip345?.transactionHashes;

    if (txHashes) {
      hashes.push(...txHashes);
    }
  } catch (error) {
    console.warn("getWalletSendCallsHashes failed: ", error);
  }

  return hashes;
}
