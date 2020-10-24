export interface KeyPair {
  privateKey: string;
  publicKey: string;
}

export interface EncryptedBuffer {
  iv: Buffer;
  mac: Buffer;
  data: Buffer;
}

export interface EncryptParams {
  message: string;
  sharedKey: string;
  publicKey: string;
}

export interface DecryptParams {
  encrypted: string;
  sharedKey: string;
  publicKey: string;
}
