import { CryptoTypes } from "@walletconnect/types";
import * as ecies25519 from "@walletconnect/ecies-25519";
import * as encoding from "@walletconnect/encoding";

export function generateKeyPair(): CryptoTypes.KeyPair {
  const keyPair = ecies25519.generateKeyPair();
  return {
    privateKey: encoding.arrayToHex(keyPair.privateKey),
    publicKey: encoding.arrayToHex(keyPair.publicKey),
  };
}

export function generateRandomBytes32(): string {
  return encoding.arrayToHex(ecies25519.randomBytes(32));
}

export function deriveSharedKey(privateKeyA: string, publicKeyB: string): string {
  const sharedKey = ecies25519.derive(
    encoding.hexToArray(privateKeyA),
    encoding.hexToArray(publicKeyB),
  );
  return encoding.arrayToHex(sharedKey);
}

export async function sha256(msg: string): Promise<string> {
  const hash = await ecies25519.sha256(encoding.hexToArray(msg));
  return encoding.arrayToHex(hash);
}

export async function encrypt(params: CryptoTypes.EncryptParams): Promise<string> {
  const msg = encoding.utf8ToArray(params.message);
  const sharedKey = encoding.hexToArray(params.sharedKey);
  const publicKey = encoding.hexToArray(params.publicKey);
  const iv = typeof params.iv !== "undefined" ? encoding.hexToArray(params.iv) : undefined;
  const encrypted = await ecies25519.encryptWithSharedKey(msg, sharedKey, publicKey, iv);
  return encoding.arrayToHex(encrypted);
}

export async function decrypt(params: CryptoTypes.DecryptParams): Promise<string> {
  const encrypted = encoding.hexToArray(params.encrypted);
  const sharedKey = encoding.hexToArray(params.sharedKey);
  const msg = await ecies25519.decryptWithSharedKey(encrypted, sharedKey);
  return encoding.arrayToUtf8(msg);
}
