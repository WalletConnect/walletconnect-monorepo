import { ChaCha20Poly1305 } from "@stablelib/chacha20poly1305";
import { HKDF } from "@stablelib/hkdf";
import { randomBytes } from "@stablelib/random";
import { hash, SHA256 } from "@stablelib/sha256";
import * as x25519 from "@stablelib/x25519";
import { CryptoTypes } from "@walletconnect/types";
import { concat, fromString, toString } from "uint8arrays";
import { ec as EC } from "elliptic";
import { decodeJWT } from "@walletconnect/relay-auth";

export const BASE10 = "base10";
export const BASE16 = "base16";
export const BASE64 = "base64pad";
export const BASE64URL = "base64url";
export const UTF8 = "utf8";

export const TYPE_0 = 0;
export const TYPE_1 = 1;
export const TYPE_2 = 2;

export type P256KeyDataType = {
  crv: "P-256";
  ext: true;
  key_ops: ["verify"];
  kty: string;
  x: string;
  y: string;
};

const ZERO_INDEX = 0;
const TYPE_LENGTH = 1;
const IV_LENGTH = 12;
const KEY_LENGTH = 32;

export function generateKeyPair(): CryptoTypes.KeyPair {
  const keyPair = x25519.generateKeyPair();
  return {
    privateKey: toString(keyPair.secretKey, BASE16),
    publicKey: toString(keyPair.publicKey, BASE16),
  };
}

export function generateRandomBytes32(): string {
  const random = randomBytes(KEY_LENGTH);
  return toString(random, BASE16);
}

export function deriveSymKey(privateKeyA: string, publicKeyB: string): string {
  const sharedKey = x25519.sharedKey(
    fromString(privateKeyA, BASE16),
    fromString(publicKeyB, BASE16),
    true,
  );
  const hkdf = new HKDF(SHA256, sharedKey);
  const symKey = hkdf.expand(KEY_LENGTH);
  return toString(symKey, BASE16);
}

export function hashKey(key: string): string {
  const result = hash(fromString(key, BASE16));
  return toString(result, BASE16);
}

export function hashMessage(message: string): string {
  const result = hash(fromString(message, UTF8));
  return toString(result, BASE16);
}

export function encodeTypeByte(type: number): Uint8Array {
  return fromString(`${type}`, BASE10);
}

export function decodeTypeByte(byte: Uint8Array): number {
  return Number(toString(byte, BASE10));
}

export function encrypt(params: CryptoTypes.EncryptParams): string {
  const type = encodeTypeByte(typeof params.type !== "undefined" ? params.type : TYPE_0);
  if (decodeTypeByte(type) === TYPE_1 && typeof params.senderPublicKey === "undefined") {
    throw new Error("Missing sender public key for type 1 envelope");
  }
  const senderPublicKey =
    typeof params.senderPublicKey !== "undefined"
      ? fromString(params.senderPublicKey, BASE16)
      : undefined;

  const iv =
    typeof params.iv !== "undefined" ? fromString(params.iv, BASE16) : randomBytes(IV_LENGTH);
  const box = new ChaCha20Poly1305(fromString(params.symKey, BASE16));
  const sealed = box.seal(iv, fromString(params.message, UTF8));
  return serialize({ type, sealed, iv, senderPublicKey, encoding: params.encoding });
}

export function encodeTypeTwoEnvelope(
  message: string,
  encoding?: CryptoTypes.EncodingType,
): string {
  const type = encodeTypeByte(TYPE_2);
  // iv is not used in type 2 envelopes
  const iv = randomBytes(IV_LENGTH);
  const sealed = fromString(message, UTF8);
  return serialize({ type, sealed, iv, encoding });
}

export function decrypt(params: CryptoTypes.DecryptParams): string {
  const box = new ChaCha20Poly1305(fromString(params.symKey, BASE16));
  const { sealed, iv } = deserialize({ encoded: params.encoded, encoding: params?.encoding });
  const message = box.open(iv, sealed);
  if (message === null) throw new Error("Failed to decrypt");
  return toString(message, UTF8);
}

export function decodeTypeTwoEnvelope(
  encoded: string,
  encoding?: CryptoTypes.EncodingType,
): string {
  const { sealed } = deserialize({ encoded, encoding });
  return toString(sealed, UTF8);
}

export function serialize(params: CryptoTypes.EncodingParams): string {
  const { encoding = BASE64 } = params;

  if (decodeTypeByte(params.type) === TYPE_2) {
    return toString(concat([params.type, params.sealed]), encoding);
  }
  if (decodeTypeByte(params.type) === TYPE_1) {
    if (typeof params.senderPublicKey === "undefined") {
      throw new Error("Missing sender public key for type 1 envelope");
    }
    return toString(
      concat([params.type, params.senderPublicKey, params.iv, params.sealed]),
      encoding,
    );
  }
  // default to type 0 envelope
  return toString(concat([params.type, params.iv, params.sealed]), encoding);
}

export function deserialize(params: CryptoTypes.DecodingParams): CryptoTypes.EncodingParams {
  const { encoded, encoding = BASE64 } = params;
  const bytes = fromString(encoded, encoding);
  const type = bytes.slice(ZERO_INDEX, TYPE_LENGTH);
  const slice1 = TYPE_LENGTH;
  if (decodeTypeByte(type) === TYPE_1) {
    const slice2 = slice1 + KEY_LENGTH;
    const slice3 = slice2 + IV_LENGTH;
    const senderPublicKey = bytes.slice(slice1, slice2);
    const iv = bytes.slice(slice2, slice3);
    const sealed = bytes.slice(slice3);
    return { type, sealed, iv, senderPublicKey };
  }
  if (decodeTypeByte(type) === TYPE_2) {
    const sealed = bytes.slice(slice1);
    // iv is not used in type 2 envelopes
    const iv = randomBytes(IV_LENGTH);
    return { type, sealed, iv };
  }
  // default to type 0 envelope
  const slice2 = slice1 + IV_LENGTH;
  const iv = bytes.slice(slice1, slice2);
  const sealed = bytes.slice(slice2);
  return { type, sealed, iv };
}

export function validateDecoding(
  encoded: string,
  opts?: CryptoTypes.DecodeOptions,
): CryptoTypes.EncodingValidation {
  const deserialized = deserialize({ encoded, encoding: opts?.encoding });
  return validateEncoding({
    type: decodeTypeByte(deserialized.type),
    senderPublicKey:
      typeof deserialized.senderPublicKey !== "undefined"
        ? toString(deserialized.senderPublicKey, BASE16)
        : undefined,
    receiverPublicKey: opts?.receiverPublicKey,
  });
}

export function validateEncoding(opts?: CryptoTypes.EncodeOptions): CryptoTypes.EncodingValidation {
  const type = opts?.type || TYPE_0;
  if (type === TYPE_1) {
    if (typeof opts?.senderPublicKey === "undefined") {
      throw new Error("missing sender public key");
    }
    if (typeof opts?.receiverPublicKey === "undefined") {
      throw new Error("missing receiver public key");
    }
  }
  return {
    type,
    senderPublicKey: opts?.senderPublicKey,
    receiverPublicKey: opts?.receiverPublicKey,
  };
}

export function isTypeOneEnvelope(
  result: CryptoTypes.EncodingValidation,
): result is CryptoTypes.TypeOneParams {
  return (
    result.type === TYPE_1 &&
    typeof result.senderPublicKey === "string" &&
    typeof result.receiverPublicKey === "string"
  );
}

export function isTypeTwoEnvelope(
  result: CryptoTypes.EncodingValidation,
): result is CryptoTypes.TypeOneParams {
  return result.type === TYPE_2;
}
export function getCryptoKeyFromKeyData(keyData: P256KeyDataType): EC.KeyPair {
  const ec = new EC("p256");
  const key = ec.keyFromPublic(
    {
      x: Buffer.from(keyData.x, "base64").toString("hex"),
      y: Buffer.from(keyData.y, "base64").toString("hex"),
    },
    "hex",
  );
  return key;
}

function base64UrlToBase64(base64Url: string) {
  let base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
  const padding = base64.length % 4;
  if (padding > 0) {
    base64 += "=".repeat(4 - padding);
  }
  return base64;
}

function base64UrlDecode(base64Url: string) {
  return Buffer.from(base64UrlToBase64(base64Url), "base64");
}

export function verifyP256Jwt<T>(token: string, keyData: P256KeyDataType) {
  const [headerBase64Url, payloadBase64Url, signatureBase64Url] = token.split(".");

  // Decode the signature
  const signatureBuffer = base64UrlDecode(signatureBase64Url);

  // Check if signature length is correct (64 bytes for P-256)
  if (signatureBuffer.length !== 64) {
    throw new Error("Invalid signature length");
  }

  // Extract r and s from the signature
  const r = signatureBuffer.slice(0, 32).toString("hex");
  const s = signatureBuffer.slice(32, 64).toString("hex");

  // Create the signing input
  const signingInput = `${headerBase64Url}.${payloadBase64Url}`;

  const sha256 = new SHA256();
  const buffer = sha256.update(Buffer.from(signingInput)).digest();

  const key = getCryptoKeyFromKeyData(keyData);

  // Convert the hash to hex format
  const hashHex = Buffer.from(buffer).toString("hex");

  // Verify the signature
  const isValid = key.verify(hashHex, { r, s });

  if (!isValid) {
    throw new Error("Invalid signature");
  }
  const data = decodeJWT(token) as unknown as { payload: T };
  return data.payload;
}
