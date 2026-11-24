import { chacha20poly1305 } from "@noble/ciphers/chacha";
import { hkdf } from "@noble/hashes/hkdf";
import { randomBytes } from "@noble/hashes/utils";
import { sha256 } from "@noble/hashes/sha256";
import { x25519 } from "@noble/curves/ed25519";
import { p256 } from "@noble/curves/p256";
import { CryptoTypes } from "@walletconnect/types";
import { decodeJWT } from "@walletconnect/relay-auth";
import { concat, fromString, toString } from "uint8arrays";

export const BASE10 = "base10";
export const BASE16 = "base16";
export const BASE64 = "base64pad";
export const BASE64URL = "base64url";
export const UTF8 = "utf8";

export const TYPE_0 = 0;
export const TYPE_1 = 1;
export const TYPE_2 = 2;

export type P256KeyDataType = {
  crv: "P-256" | string;
  ext: true | boolean;
  key_ops: ["verify"] | string[];
  kty: string;
  x: string;
  y: string;
};

const ZERO_INDEX = 0;
const TYPE_LENGTH = 1;
const IV_LENGTH = 12;
const KEY_LENGTH = 32;

export function generateKeyPair(): CryptoTypes.KeyPair {
  const privateKey = x25519.utils.randomPrivateKey();
  const publicKey = x25519.getPublicKey(privateKey);
  return {
    privateKey: toString(privateKey, BASE16),
    publicKey: toString(publicKey, BASE16),
  };
}

export function generateRandomBytes32(): string {
  const random = randomBytes(KEY_LENGTH);
  return toString(random, BASE16);
}

export function deriveSymKey(privateKeyA: string, publicKeyB: string): string {
  const sharedKey = x25519.getSharedSecret(
    fromString(privateKeyA, BASE16),
    fromString(publicKeyB, BASE16),
  );
  const symKey = hkdf(sha256, sharedKey, undefined, undefined, KEY_LENGTH);
  return toString(symKey, BASE16);
}

export function hashKey(key: string): string {
  const result = sha256(fromString(key, BASE16));
  return toString(result, BASE16);
}

export function hashMessage(message: string): string {
  const result = sha256(fromString(message, UTF8));
  return toString(result, BASE16);
}

/**
 * Verify v4 `cth` for a Sign v2 envelope: base64url (no padding) SHA-256 of the envelope bytes,
 * the base64-decoded `message` as published. Not `hashMessage(message)`, which hashes the base64
 * text and is what legacy SDKs compare to an attestation's `id`.
 */
export function hashEnvelope(message: string): string {
  return toString(sha256(fromString(message, BASE64)), BASE64URL);
}

/** Verify v4 `sub`: base64url (no padding) SHA-256 of a plaintext's UTF-8 bytes. */
export function hashPlaintext(plaintext: string): string {
  return toString(sha256(fromString(plaintext, UTF8)), BASE64URL);
}

/**
 * The `sub` and `cth` claims of a Verify v4 App Signature, decoded without checking its signature
 * (the Relay did). Undefined when it isn't a JWT with a string `sub`.
 */
export function decodeAppSignatureClaims(jwt: string): { sub: string; cth?: string } | undefined {
  const parts = jwt.split(".");
  if (parts.length !== 3) return undefined;
  try {
    const claims = JSON.parse(toString(fromString(parts[1].replace(/=+$/, ""), BASE64URL), UTF8));
    if (typeof claims?.sub !== "string") return undefined;
    if (claims.cth != null && typeof claims.cth !== "string") return undefined;
    return { sub: claims.sub, ...(claims.cth != null && { cth: claims.cth }) };
  } catch {
    return undefined;
  }
}

export function encodeTypeByte(type: number): Uint8Array {
  return fromString(`${type}`, BASE10);
}

export function decodeTypeByte(byte: Uint8Array): number {
  return Number(toString(byte, BASE10));
}

function toBase64URL(base64: string): string {
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

function fromBase64URL(base64url: string): string {
  const base64 = base64url.replace(/-/g, "+").replace(/_/g, "/");
  const padding = (4 - (base64.length % 4)) % 4;
  return base64 + "=".repeat(padding);
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
  const key = fromString(params.symKey, BASE16);
  const box = chacha20poly1305(key, iv);
  const sealed = box.encrypt(fromString(params.message, UTF8));
  const result = serialize({ type, sealed, iv, senderPublicKey });
  return params.encoding === BASE64URL ? toBase64URL(result) : result;
}

export function decrypt(params: CryptoTypes.DecryptParams): string {
  const key = fromString(params.symKey, BASE16);
  const { sealed, iv } = deserialize({ encoded: params.encoded, encoding: params.encoding });
  const box = chacha20poly1305(key, iv);
  const message = box.decrypt(sealed);
  if (message === null) throw new Error("Failed to decrypt");
  return toString(message, UTF8);
}

export function encodeTypeTwoEnvelope(
  message: string,
  encoding?: CryptoTypes.EncodingType,
): string {
  const type = encodeTypeByte(TYPE_2);
  // iv is not used in type 2 envelopes
  const iv = randomBytes(IV_LENGTH);
  const sealed = fromString(message, UTF8);
  const result = serialize({ type, sealed, iv });
  return encoding === BASE64URL ? toBase64URL(result) : result;
}

export function decodeTypeTwoEnvelope(
  encoded: string,
  encoding?: CryptoTypes.EncodingType,
): string {
  const { sealed } = deserialize({ encoded, encoding });
  return toString(sealed, UTF8);
}

export function serialize(params: CryptoTypes.EncodingParams): string {
  if (decodeTypeByte(params.type) === TYPE_2) {
    return toString(concat([params.type, params.sealed]), BASE64);
  }
  if (decodeTypeByte(params.type) === TYPE_1) {
    if (typeof params.senderPublicKey === "undefined") {
      throw new Error("Missing sender public key for type 1 envelope");
    }
    return toString(
      concat([params.type, params.senderPublicKey, params.iv, params.sealed]),
      BASE64,
    );
  }
  // default to type 0 envelope
  return toString(concat([params.type, params.iv, params.sealed]), BASE64);
}

export function deserialize(params: CryptoTypes.DecodingParams): CryptoTypes.EncodingParams {
  const encoding = params.encoding || BASE64;
  const normalizedEncoded = encoding === BASE64URL ? fromBase64URL(params.encoded) : params.encoded;
  const bytes = fromString(normalizedEncoded, BASE64);
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

export function getCryptoKeyFromKeyData(keyData: P256KeyDataType): Uint8Array {
  const xBytes = fromString(fromBase64URL(keyData.x), BASE64);
  const yBytes = fromString(fromBase64URL(keyData.y), BASE64);

  return concat([new Uint8Array([0x04]), xBytes, yBytes]);
}

export function verifyP256Jwt<T>(token: string, keyData: P256KeyDataType) {
  const [headerBase64Url, payloadBase64Url, signatureBase64Url] = token.split(".");

  const signatureBytes = fromString(fromBase64URL(signatureBase64Url), BASE64);

  if (signatureBytes.length !== 64) {
    throw new Error("Invalid signature length");
  }

  const r = signatureBytes.slice(0, 32);
  const s = signatureBytes.slice(32, 64);

  const signingInput = `${headerBase64Url}.${payloadBase64Url}`;
  const messageHash = sha256(signingInput);
  const publicKey = getCryptoKeyFromKeyData(keyData);

  const isValid = p256.verify(concat([r, s]), messageHash, publicKey);

  if (!isValid) {
    throw new Error("Invalid signature");
  }

  const data = decodeJWT(token) as unknown as { payload: T };
  return data.payload;
}
