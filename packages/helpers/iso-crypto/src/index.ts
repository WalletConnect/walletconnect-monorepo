import * as isoCrypto from "@pedrouid/iso-crypto";
import {
  IEncryptionPayload,
  IJsonRpcRequest,
  IJsonRpcResponseError,
  IJsonRpcResponseSuccess,
} from "@walletconnect/types";
import { convertArrayBufferToBuffer, convertBufferToArrayBuffer } from "@walletconnect/utils";
import * as encUtils from "enc-utils";

export async function generateKey(length?: number): Promise<ArrayBuffer> {
  const _length = (length || 256) / 8;
  const bytes = isoCrypto.randomBytes(_length);
  const result = convertBufferToArrayBuffer(encUtils.arrayToBuffer(bytes));

  return result;
}

export async function verifyHmac(payload: IEncryptionPayload, key: Uint8Array): Promise<boolean> {
  const cipherText = encUtils.hexToArray(payload.data);
  const iv = encUtils.hexToArray(payload.iv);
  const hmac = encUtils.hexToArray(payload.hmac);
  const hmacHex: string = encUtils.arrayToHex(hmac, false);
  const unsigned = encUtils.concatArrays(cipherText, iv);
  const chmac = await isoCrypto.hmacSha256Sign(key, unsigned);
  const chmacHex: string = encUtils.arrayToHex(chmac, false);

  if (encUtils.removeHexPrefix(hmacHex) === encUtils.removeHexPrefix(chmacHex)) {
    return true;
  }

  return false;
}

export async function encrypt(
  data: IJsonRpcRequest | IJsonRpcResponseSuccess | IJsonRpcResponseError,
  key: ArrayBuffer,
  providedIv?: ArrayBuffer,
): Promise<IEncryptionPayload> {
  const _key = encUtils.bufferToArray(convertArrayBufferToBuffer(key));

  const ivArrayBuffer: ArrayBuffer = providedIv || (await generateKey(128));
  const iv = encUtils.bufferToArray(convertArrayBufferToBuffer(ivArrayBuffer));
  const ivHex: string = encUtils.arrayToHex(iv, false);

  const contentString: string = JSON.stringify(data);
  const content = encUtils.utf8ToArray(contentString);

  const cipherText = await isoCrypto.aesCbcEncrypt(iv, _key, content);
  const cipherTextHex: string = encUtils.arrayToHex(cipherText, false);

  const unsigned = encUtils.concatArrays(cipherText, iv);
  const hmac = await isoCrypto.hmacSha256Sign(_key, unsigned);
  const hmacHex: string = encUtils.arrayToHex(hmac, false);

  return {
    data: cipherTextHex,
    hmac: hmacHex,
    iv: ivHex,
  };
}

export async function decrypt(
  payload: IEncryptionPayload,
  key: ArrayBuffer,
): Promise<IJsonRpcRequest | IJsonRpcResponseSuccess | IJsonRpcResponseError | null> {
  const _key = encUtils.bufferToArray(convertArrayBufferToBuffer(key));

  if (!_key) {
    throw new Error("Missing key: required for decryption");
  }

  const verified: boolean = await verifyHmac(payload, _key);
  if (!verified) {
    return null;
  }

  const cipherText = encUtils.hexToArray(payload.data);
  const iv = encUtils.hexToArray(payload.iv);
  const buffer = await isoCrypto.aesCbcDecrypt(iv, _key, cipherText);
  const utf8: string = encUtils.arrayToUtf8(buffer);
  let data: IJsonRpcRequest;
  try {
    data = JSON.parse(utf8);
  } catch (error) {
    return null;
  }

  return data;
}
