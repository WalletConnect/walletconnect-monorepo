import {
  CryptoTypes,
  BASE16,
  BASE64,
  UTF8,
  ZERO_INDEX,
  IV_LENGTH,
  KEY_LENGTH,
} from "@walletconnect/types";

import { toString } from "uint8arrays/to-string";
import { fromString } from "uint8arrays/from-string";
import { concat } from "uint8arrays/concat";
import { SupportedEncodings } from "uint8arrays/util/bases";

import { HKDF } from "@stablelib/hkdf";
import { SHA256, hash } from "@stablelib/sha256";
import * as x25519 from "@stablelib/x25519";
import { randomBytes } from "@stablelib/random";
import { ChaCha20Poly1305 } from "@stablelib/chacha20poly1305";

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

export function deriveSharedKey(privateKeyA: string, publicKeyB: string): string {
  const sharedKey = x25519.sharedKey(
    fromString(privateKeyA, BASE16),
    fromString(publicKeyB, BASE16),
  );
  return toString(sharedKey, BASE16);
}

export function deriveSymmetricKey(sharedKey: string) {
  const hkdf = new HKDF(SHA256, fromString(sharedKey, BASE16));
  const symKey = hkdf.expand(KEY_LENGTH);
  return toString(symKey, BASE16);
}

export async function sha256(
  str: string,
  inputEncoding: SupportedEncodings = BASE16,
  outputEncoding: SupportedEncodings = BASE16,
): Promise<string> {
  return toString(hash(fromString(str, inputEncoding)), outputEncoding);
}

export async function encrypt(params: CryptoTypes.EncryptParams): Promise<string> {
  const iv =
    typeof params.iv !== "undefined" ? fromString(params.iv, BASE16) : randomBytes(IV_LENGTH);
  const box = new ChaCha20Poly1305(fromString(params.symKey, BASE16));
  const sealed = box.seal(iv, fromString(params.message, UTF8));
  return serialize({ sealed, iv });
}

export async function decrypt(params: CryptoTypes.DecryptParams): Promise<string> {
  const box = new ChaCha20Poly1305(fromString(params.symKey, BASE16));
  const { sealed, iv } = deserialize(params.encoded);
  const message = box.open(iv, sealed);
  if (message === null) throw new Error("Failed to decrypt");
  return toString(message, UTF8);
}

export function serialize(params: CryptoTypes.EncodingParams): string {
  return toString(concat([params.iv, params.sealed]), BASE64);
}

export function deserialize(encoded: string): CryptoTypes.EncodingParams {
  const array = fromString(encoded, BASE64);
  const iv = array.slice(ZERO_INDEX, IV_LENGTH);
  const sealed = array.slice(IV_LENGTH);
  return { sealed, iv };
}
