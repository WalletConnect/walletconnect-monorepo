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

  export interface EncryptKeys {
    sharedKey: string;
    publicKey: string;
    iv?: string;
  }

  export interface EncryptParams extends EncryptKeys {
    message: string;
  }

  export interface DecryptKeys {
    sharedKey: string;
  }

  export interface DecryptParams extends DecryptKeys {
    encrypted: string;
  }
}
