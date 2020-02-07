/// <reference types="node" />
import { IJsonRpcRequest, IJsonRpcResponseSuccess, IJsonRpcResponseError, IEncryptionPayload } from '@walletconnect/types';
export declare function randomBytes(length: number): Promise<Buffer>;
export declare function generateKey(length?: number): Promise<ArrayBuffer>;
export declare function createHmac(data: Buffer, key: Buffer): Promise<Buffer>;
export declare function verifyHmac(payload: IEncryptionPayload, key: Buffer): Promise<boolean>;
export declare function aesCbcEncrypt(data: Buffer, key: Buffer, iv: Buffer): Promise<Buffer>;
export declare function aesCbcDecrypt(data: Buffer, key: Buffer, iv: Buffer): Promise<Buffer>;
export declare function encrypt(data: IJsonRpcRequest | IJsonRpcResponseSuccess | IJsonRpcResponseError, key: ArrayBuffer): Promise<IEncryptionPayload>;
export declare function decrypt(payload: IEncryptionPayload, key: ArrayBuffer): Promise<IJsonRpcRequest | IJsonRpcResponseSuccess | IJsonRpcResponseError | null>;
//# sourceMappingURL=nativeCrypto.d.ts.map