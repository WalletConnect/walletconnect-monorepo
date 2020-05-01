import * as eccryptoJS from "eccrypto-js";
import {
  IJsonRpcRequest,
  IJsonRpcResponseSuccess,
  IJsonRpcResponseError,
  IEncryptionPayload,
} from "@walletconnect/types";
import {
  convertArrayBufferToBuffer,
  convertUtf8ToBuffer,
  convertBufferToUtf8,
  convertBufferToHex,
  convertHexToBuffer,
  concatBuffers,
  removeHexPrefix,
  convertBufferToArrayBuffer,
} from "@walletconnect/utils";

export async function generateKey(length?: number): Promise<ArrayBuffer> {
  const _length = (length || 256) / 8;
  const buffer: Buffer = eccryptoJS.randomBytes(_length);
  const result = convertBufferToArrayBuffer(buffer);

  return result;
}

export async function verifyHmac(payload: IEncryptionPayload, key: Buffer): Promise<boolean> {
  const cipherText: Buffer = convertHexToBuffer(payload.data);
  const iv: Buffer = convertHexToBuffer(payload.iv);
  const hmac: Buffer = convertHexToBuffer(payload.hmac);
  const hmacHex: string = convertBufferToHex(hmac, true);
  const unsigned: Buffer = concatBuffers(cipherText, iv);
  const chmac: Buffer = await eccryptoJS.hmacSha256Sign(unsigned, key);
  const chmacHex: string = convertBufferToHex(chmac, true);

  if (removeHexPrefix(hmacHex) === removeHexPrefix(chmacHex)) {
    return true;
  }

  return false;
}

export async function encrypt(
  data: IJsonRpcRequest | IJsonRpcResponseSuccess | IJsonRpcResponseError,
  key: ArrayBuffer,
  providedIv?: ArrayBuffer,
): Promise<IEncryptionPayload> {
  const _key: Buffer = convertArrayBufferToBuffer(key);

  const ivArrayBuffer: ArrayBuffer = providedIv || (await generateKey(128));
  const iv: Buffer = convertArrayBufferToBuffer(ivArrayBuffer);
  const ivHex: string = convertBufferToHex(iv, true);

  const contentString: string = JSON.stringify(data);
  const content: Buffer = convertUtf8ToBuffer(contentString);

  const cipherText: Buffer = await eccryptoJS.aesCbcEncrypt(content, _key, iv);
  const cipherTextHex: string = convertBufferToHex(cipherText, true);

  const unsigned: Buffer = concatBuffers(cipherText, iv);
  const hmac: Buffer = await eccryptoJS.hmacSha256Sign(unsigned, _key);
  const hmacHex: string = convertBufferToHex(hmac, true);

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
  const _key: Buffer = convertArrayBufferToBuffer(key);

  if (!_key) {
    throw new Error("Missing key: required for decryption");
  }

  const verified: boolean = await verifyHmac(payload, _key);
  if (!verified) {
    return null;
  }

  const cipherText: Buffer = convertHexToBuffer(payload.data);
  const iv: Buffer = convertHexToBuffer(payload.iv);
  const buffer: Buffer = await eccryptoJS.aesCbcDecrypt(cipherText, _key, iv);
  const utf8: string = convertBufferToUtf8(buffer);
  let data: IJsonRpcRequest;
  try {
    data = JSON.parse(utf8);
  } catch (error) {
    return null;
  }

  return data;
}
