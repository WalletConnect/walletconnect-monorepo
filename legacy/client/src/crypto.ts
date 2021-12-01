import * as crypto from "@walletconnect/crypto";
import * as encoding from "@walletconnect/encoding";

import {
  IJsonRpcRequest,
  IJsonRpcResponseSuccess,
  IJsonRpcResponseError,
  IEncryptionPayload,
} from "@walletconnect/legacy-types";
import {
  convertArrayBufferToBuffer,
  convertBufferToArrayBuffer,
} from "@walletconnect/legacy-utils";

export async function generateKey(length?: number): Promise<ArrayBuffer> {
  const _length = (length || 256) / 8;
  const bytes = crypto.randomBytes(_length);
  const result = convertBufferToArrayBuffer(encoding.arrayToBuffer(bytes));

  return result;
}

export async function verifyHmac(payload: IEncryptionPayload, key: Uint8Array): Promise<boolean> {
  const cipherText = encoding.hexToArray(payload.data);
  const iv = encoding.hexToArray(payload.iv);
  const hmac = encoding.hexToArray(payload.hmac);
  const hmacHex: string = encoding.arrayToHex(hmac, false);
  const unsigned = encoding.concatArrays(cipherText, iv);
  const chmac = await crypto.hmacSha256Sign(key, unsigned);
  const chmacHex: string = encoding.arrayToHex(chmac, false);

  if (encoding.removeHexPrefix(hmacHex) === encoding.removeHexPrefix(chmacHex)) {
    return true;
  }

  return false;
}

export async function encrypt(
  data: IJsonRpcRequest | IJsonRpcResponseSuccess | IJsonRpcResponseError,
  key: ArrayBuffer,
  providedIv?: ArrayBuffer,
): Promise<IEncryptionPayload> {
  const _key = encoding.bufferToArray(convertArrayBufferToBuffer(key));

  const ivArrayBuffer: ArrayBuffer = providedIv || (await generateKey(128));
  const iv = encoding.bufferToArray(convertArrayBufferToBuffer(ivArrayBuffer));
  const ivHex: string = encoding.arrayToHex(iv, false);

  const contentString: string = JSON.stringify(data);
  const content = encoding.utf8ToArray(contentString);

  const cipherText = await crypto.aesCbcEncrypt(iv, _key, content);
  const cipherTextHex: string = encoding.arrayToHex(cipherText, false);

  const unsigned = encoding.concatArrays(cipherText, iv);
  const hmac = await crypto.hmacSha256Sign(_key, unsigned);
  const hmacHex: string = encoding.arrayToHex(hmac, false);

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
  const _key = encoding.bufferToArray(convertArrayBufferToBuffer(key));

  if (!_key) {
    throw new Error("Missing key: required for decryption");
  }

  const verified: boolean = await verifyHmac(payload, _key);
  if (!verified) {
    return null;
  }

  const cipherText = encoding.hexToArray(payload.data);
  const iv = encoding.hexToArray(payload.iv);
  const buffer = await crypto.aesCbcDecrypt(iv, _key, cipherText);
  const utf8: string = encoding.arrayToUtf8(buffer);
  let data: IJsonRpcRequest;
  try {
    data = JSON.parse(utf8);
  } catch (error) {
    return null;
  }

  return data;
}
