import { IEvents } from "@json-rpc-tools/types";
import { Logger } from "pino";
import { IClient } from "./client";

export declare namespace CryptoTypes {
  export interface Participant {
    publicKey: string;
  }

  export type Self = Participant;

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

export abstract class IKeyChain {
  public abstract init(): Promise<void>;

  public abstract has(tag: string, opts?: any): Promise<boolean>;
  public abstract set(tag: string, key: string, opts?: any): Promise<void>;
  public abstract get(tag: string, opts?: any): Promise<string>;
  public abstract del(tag: string, opts?: any): Promise<void>;
}

export abstract class ICrypto {
  public abstract context: string;

  constructor(public client: IClient, public keychain: IKeyChain) {}

  public abstract init(): Promise<void>;

  public abstract hasKeys(tag: string): Promise<boolean>;

  public abstract generateKeyPair(): Promise<string>;

  public abstract generateSharedKey(
    self: CryptoTypes.Participant,
    peer: CryptoTypes.Participant,
    overrideTopic?: string,
  ): Promise<string>;

  public abstract encrypt(topic: string, message: string): Promise<string>;

  public abstract decrypt(topic: string, encrypted: string): Promise<string>;
}
