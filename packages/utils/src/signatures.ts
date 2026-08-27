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

// EIP-1271 `isValidSignature(bytes32 _hash, bytes _signature)` takes a 32-byte digest, so only a
// `0x`-prefixed 64-character hex string can be an already-hashed message. Anything else — notably a
// plaintext SIWE/CACAO message whose domain happens to start with `0x` (e.g. `0xsplits.xyz`) — must
// still be hashed per EIP-191 before being spliced into the calldata.
const BYTES32_HEX_REGEX = /^0x[0-9a-fA-F]{64}$/;

function isBytes32Hex(value: string): boolean {
  return BYTES32_HEX_REGEX.test(value);
}

export function hashEthereumMessage(message: string) {
  const prefix = `\x19Ethereum Signed Message:\n${message.length}`;
  const prefixedMessage = new TextEncoder().encode(prefix + message);
  return "0x" + toString(keccak_256(prefixedMessage), "base16");
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
      isBytes32Hex(reconstructedMessage)
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

const STELLAR_NETWORK_PASSPHRASES: Record<string, string> = {
  pubnet: "Public Global Stellar Network ; September 2015",
  testnet: "Test SDF Network ; September 2015",
};

// XDR EnvelopeType discriminants (https://developers.stellar.org/docs/learn/encyclopedia/data-format/xdr)
const STELLAR_ENVELOPE_TYPE_TX_V0 = 0;
const STELLAR_ENVELOPE_TYPE_TX = 2;
const STELLAR_ENVELOPE_TYPE_TX_FEE_BUMP = 5;
// DecoratedSignature with an ed25519 signature: hint (4 bytes) + length (4 bytes, =64) + signature (64 bytes)
const STELLAR_DECORATED_SIGNATURE_LENGTH = 72;
const STELLAR_ED25519_SIGNATURE_LENGTH = 64;
const STELLAR_MAX_ENVELOPE_SIGNATURES = 20;

function readUint32BE(bytes: Uint8Array, offset: number): number {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(offset, false);
}

/**
 * Locates the start of the trailing `DecoratedSignature signatures<20>` XDR array
 * of a Stellar TransactionEnvelope without parsing the transaction body.
 * Assumes ed25519 signatures (fixed 72-byte entries), which is what the
 * WalletConnect Stellar RPC spec mandates wallets emit.
 */
function findStellarSignatureArrayOffset(bytes: Uint8Array): number {
  // Scan from the maximum count downward: a real multi-signature array must be
  // found before the vacuously-matching zero count, which would otherwise win
  // whenever a signature happens to end in four zero bytes.
  for (
    let signatureCount = STELLAR_MAX_ENVELOPE_SIGNATURES;
    signatureCount >= 0;
    signatureCount--
  ) {
    const offset = bytes.length - 4 - STELLAR_DECORATED_SIGNATURE_LENGTH * signatureCount;
    if (offset < 4) continue;
    if (readUint32BE(bytes, offset) !== signatureCount) continue;
    let isValid = true;
    for (let i = 0; i < signatureCount; i++) {
      const entryOffset = offset + 4 + STELLAR_DECORATED_SIGNATURE_LENGTH * i;
      // each entry's signature length field must be exactly 64 (ed25519)
      if (readUint32BE(bytes, entryOffset + 4) !== STELLAR_ED25519_SIGNATURE_LENGTH) {
        isValid = false;
        break;
      }
    }
    if (isValid) return offset;
  }
  throw new Error("getStellarTransactionHash: could not locate envelope signature array");
}

/**
 * Computes the Stellar transaction hash from a base64-encoded, signed
 * TransactionEnvelope XDR, as `sha256(network_id || envelope_type || transaction_body)`.
 * The hash is deterministic from the envelope — signatures are computed over it,
 * so they are stripped rather than hashed.
 *
 * For fee-bump envelopes this yields the canonical fee-bump hash. For plain
 * transactions wrapped by a relayer later, this yields the inner hash, which
 * Horizon also resolves.
 *
 * @param signedXDR base64-encoded TransactionEnvelope XDR (V0, V1 or fee-bump)
 * @param chain CAIP-2 chain id (`stellar:pubnet` / `stellar:testnet`), defaults to pubnet
 * @returns lowercase hex transaction hash (64 chars)
 */
export function getStellarTransactionHash(signedXDR: string, chain?: string): string {
  const bytes = base64ToBytes(signedXDR);
  if (bytes.length < 8) {
    throw new Error("getStellarTransactionHash: envelope too short");
  }

  const discriminant = readUint32BE(bytes, 0);
  let envelopeType: number;
  let bodyStart: number;
  switch (discriminant) {
    case STELLAR_ENVELOPE_TYPE_TX_V0:
      // V0 transactions are hashed as ENVELOPE_TYPE_TX over the envelope bytes
      // INCLUDING the leading 4 zero bytes — they double as the legacy
      // AccountID key-type tag of the pre-protocol-13 Transaction struct.
      envelopeType = STELLAR_ENVELOPE_TYPE_TX;
      bodyStart = 0;
      break;
    case STELLAR_ENVELOPE_TYPE_TX:
      envelopeType = STELLAR_ENVELOPE_TYPE_TX;
      bodyStart = 4;
      break;
    case STELLAR_ENVELOPE_TYPE_TX_FEE_BUMP:
      envelopeType = STELLAR_ENVELOPE_TYPE_TX_FEE_BUMP;
      bodyStart = 4;
      break;
    default:
      throw new Error(
        `getStellarTransactionHash: unsupported envelope type: ${discriminant}`,
      );
  }

  const signatureArrayOffset = findStellarSignatureArrayOffset(bytes);

  const networkReference = chain?.split(":").pop() ?? "pubnet";
  const passphrase = STELLAR_NETWORK_PASSPHRASES[networkReference];
  if (!passphrase) {
    throw new Error(`getStellarTransactionHash: unknown Stellar network: ${networkReference}`);
  }
  const networkId = sha256(new TextEncoder().encode(passphrase));

  const envelopeTypeBytes = new Uint8Array([0, 0, 0, envelopeType]);
  const payload = concat([
    networkId,
    envelopeTypeBytes,
    bytes.slice(bodyStart, signatureArrayOffset),
  ]);

  return toString(sha256(payload), "base16");
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
