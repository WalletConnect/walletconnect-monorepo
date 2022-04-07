import { CryptoTypes } from "@walletconnect/types";

import { toString } from "uint8arrays/to-string";
import { fromString } from "uint8arrays/from-string";
import { concat } from "uint8arrays/concat";

import { HKDF } from "@stablelib/hkdf";
import { SHA256, hash } from "@stablelib/sha256";
import * as x25519 from "@stablelib/x25519";
import { randomBytes } from "@stablelib/random";
import { ChaCha20Poly1305 } from "@stablelib/chacha20poly1305";

const BASE16 = "base16";
const BASE64 = "base64";
const UTF8 = "utf8";

const ZERO_INDEX = 0;
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

export async function sha256(msg: string): Promise<string> {
  return toString(hash(fromString(msg, BASE16)), BASE16);
}

export async function encrypt(symKey: string, plaintext: string, _iv?: string): Promise<string> {
  const iv = typeof _iv !== "undefined" ? fromString(_iv, BASE16) : randomBytes(IV_LENGTH);
  const box = new ChaCha20Poly1305(fromString(symKey, BASE16));
  const sealed = box.seal(iv, fromString(plaintext, UTF8));
  return toString(sealed, BASE16);
}

export async function decrypt(symKey: string, sealed: string, iv: string): Promise<string> {
  const box = new ChaCha20Poly1305(fromString(symKey, BASE16));
  const plaintext = box.open(fromString(iv, BASE16), fromString(sealed, BASE16));
  if (plaintext === null) throw new Error("Failed to decrypt");
  return toString(plaintext, UTF8);
}

export function serialize(sealed: Uint8Array, iv: Uint8Array): string {
  return toString(concat([iv, sealed]), BASE64);
}

export function deserialize(encoded: string): { sealed: Uint8Array; iv: Uint8Array } {
  const array = fromString(encoded, BASE64);
  const iv = array.slice(ZERO_INDEX, IV_LENGTH);
  const sealed = array.slice(IV_LENGTH);
  return { sealed, iv };
}
