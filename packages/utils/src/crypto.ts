import { CryptoTypes } from "@walletconnect/types";
import * as eccies25519 from "ecies-25519";
import * as encUtils from "enc-utils";

export function generateKeyPair(): CryptoTypes.KeyPair {
  const keyPair = eccies25519.generateKeyPair();
  return {
    privateKey: encUtils.arrayToHex(keyPair.privateKey),
    publicKey: encUtils.arrayToHex(keyPair.publicKey),
  };
}

export function generateRandomBytes32(): string {
  return encUtils.arrayToHex(eccies25519.randomBytes(32));
}

export function deriveSharedKey(privateKeyA: string, publicKeyB: string): string {
  const sharedKey = eccies25519.derive(
    encUtils.hexToBuffer(privateKeyA),
    encUtils.hexToBuffer(publicKeyB),
  );
  return encUtils.arrayToHex(sharedKey);
}

export async function sha256(msg: string): Promise<string> {
  const hash = await eccies25519.sha256(encUtils.hexToBuffer(msg));
  return encUtils.arrayToHex(hash);
}

export async function encrypt(params: CryptoTypes.EncryptParams): Promise<string> {
  const msg = encUtils.utf8ToBuffer(params.message);
  const publicKey = encUtils.hexToArray(params.peer.publicKey);
  const sender = {
    privateKey: encUtils.hexToArray(params.self.privateKey),
    publicKey: encUtils.hexToArray(params.self.publicKey),
  };
  const iv = typeof params.iv !== "undefined" ? encUtils.hexToArray(params.iv) : undefined;
  const encrypted = await eccies25519.encrypt(msg, publicKey, { iv, sender });
  return encUtils.arrayToHex(encrypted);
}

export async function decrypt(params: CryptoTypes.DecryptParams): Promise<string> {
  const encrypted = encUtils.hexToArray(params.encrypted);
  const privateKey = encUtils.hexToArray(params.self.privateKey);
  const msg = await eccies25519.decrypt(encrypted, privateKey);
  return encUtils.arrayToUtf8(msg);
}
