export declare namespace CryptoTypes {
  export interface Participant {
    publicKey: string;
  }

  export type Self = KeyPair;

  export interface Peer<M = any> extends Participant {
    metadata?: M;
  }

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
    iv?: string;
  }

  export interface DecryptParams extends KeyParams {
    encrypted: string;
  }
}
