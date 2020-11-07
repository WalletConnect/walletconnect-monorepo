export interface KeyPair {
  privateKey: string;
  publicKey: string;
}

export interface EncryptedBuffer {
  iv: Buffer;
  mac: Buffer;
  data: Buffer;
}

export interface KeyParams {
  sharedKey: string;
  publicKey: string;
}

export interface EncryptParams extends KeyParams {
  message: string;
}

export interface DecryptParams extends KeyParams {
  encrypted: string;
}
