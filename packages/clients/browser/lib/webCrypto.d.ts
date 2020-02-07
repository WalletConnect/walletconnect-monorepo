import { IJsonRpcResponseSuccess, IJsonRpcResponseError, IJsonRpcRequest, IEncryptionPayload } from '@walletconnect/types';
export declare function exportKey(cryptoKey: CryptoKey): Promise<ArrayBuffer>;
export declare function importKey(buffer: ArrayBuffer, type?: string): Promise<CryptoKey>;
export declare function generateKey(length?: number): Promise<ArrayBuffer>;
export declare function createHmac(data: ArrayBuffer, key: ArrayBuffer): Promise<ArrayBuffer>;
export declare function verifyHmac(payload: IEncryptionPayload, key: ArrayBuffer): Promise<boolean>;
export declare function aesCbcEncrypt(data: ArrayBuffer, key: ArrayBuffer, iv: ArrayBuffer): Promise<ArrayBuffer>;
export declare function aesCbcDecrypt(data: ArrayBuffer, key: ArrayBuffer, iv: ArrayBuffer): Promise<ArrayBuffer>;
export declare function encrypt(data: IJsonRpcRequest | IJsonRpcResponseSuccess | IJsonRpcResponseError, key: ArrayBuffer): Promise<IEncryptionPayload>;
export declare function decrypt(payload: IEncryptionPayload, key: ArrayBuffer): Promise<IJsonRpcRequest | IJsonRpcResponseSuccess | IJsonRpcResponseError | null>;
//# sourceMappingURL=webCrypto.d.ts.map