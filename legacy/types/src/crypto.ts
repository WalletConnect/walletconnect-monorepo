import { IJsonRpcRequest, IJsonRpcResponseError, IJsonRpcResponseSuccess } from "./jsonrpc";

export interface ICryptoLib {
  generateKey: (length?: number) => Promise<ArrayBuffer>;
  encrypt: (
    data: IJsonRpcRequest | IJsonRpcResponseSuccess | IJsonRpcResponseError,
    key: ArrayBuffer,
    iv?: ArrayBuffer,
  ) => Promise<IEncryptionPayload>;
  decrypt: (
    payload: IEncryptionPayload,
    key: ArrayBuffer,
  ) => Promise<IJsonRpcRequest | IJsonRpcResponseSuccess | IJsonRpcResponseError | null>;
}

export interface IEncryptionPayload {
  data: string;
  hmac: string;
  iv: string;
}
