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
  export interface EncryptKeys {
    self: Self;
    peer: Participant;
    iv?: string;
  }

  export interface EncryptParams extends EncryptKeys {
    message: string;
  }

  export interface DecryptKeys {
    self: Self;
  }

  export interface DecryptParams extends DecryptKeys {
    encrypted: string;
  }
}
