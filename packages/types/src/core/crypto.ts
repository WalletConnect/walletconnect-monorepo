import { JsonRpcPayload } from "@walletconnect/jsonrpc-types";
import { Logger } from "pino";
import { ICore } from "./core";
import { IKeyChain } from "./keychain";

export declare namespace CryptoTypes {
  export interface Participant {
    publicKey: string;
  }

  export interface KeyPair {
    privateKey: string;
    publicKey: string;
  }

  export interface EncryptParams {
    message: string;
    symKey: string;
    iv?: string;
  }

  export interface DecryptParams {
    symKey: string;
    encoded: string;
  }

  export interface EncodingParams {
    sealed: Uint8Array;
    iv: Uint8Array;
  }

  export interface EncodeOptions {
    type?: number;
    senderPublicKey?: string;
    receiverPublicKey?: string;
  }

  export interface DecodeOptions {
    receiverPublicKey?: string;
  }
}

export abstract class ICrypto {
  public abstract name: string;

  public abstract readonly context: string;

  public abstract keychain: IKeyChain;

  constructor(
    public core: ICore,
    public logger: Logger,
    // @ts-ignore
    keychain?: IKeyChain,
  ) {}

  public abstract init(): Promise<void>;

  public abstract hasKeys(tag: string): boolean;

  public abstract getClientId(): Promise<string>;

  public abstract generateKeyPair(): Promise<string>;

  public abstract generateSharedKey(
    selfPublicKey: string,
    peerPublicKey: string,
    overrideTopic?: string,
  ): Promise<string>;

  public abstract setSymKey(symKey: string, overrideTopic?: string): Promise<string>;

  public abstract deleteKeyPair(publicKey: string): Promise<void>;

  public abstract deleteSymKey(topic: string): Promise<void>;

  public abstract encrypt(topic: string, message: string): string;

  public abstract decrypt(topic: string, encoded: string): string;

  public abstract encode(
    topic: string,
    payload: JsonRpcPayload,
    opts?: CryptoTypes.EncodeOptions,
  ): string;

  public abstract decode(
    topic: string,
    encoded: string,
    opts?: CryptoTypes.DecodeOptions,
  ): JsonRpcPayload;

  public abstract signJWT(subject: string): Promise<string>;
}
