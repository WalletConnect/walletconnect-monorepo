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
    type?: number;
    iv?: string;
    senderPublicKey?: string;
  }

  export interface DecryptParams {
    symKey: string;
    encoded: string;
  }

  export interface EncodingParams {
    type: Uint8Array;
    sealed: Uint8Array;
    iv: Uint8Array;
    senderPublicKey?: Uint8Array;
  }

  export interface EncodeOptions {
    type?: number;
    senderPublicKey?: string;
    receiverPublicKey?: string;
  }

  export interface DecodeOptions {
    receiverPublicKey?: string;
  }

  export interface EncodingValidation {
    type: number;
    senderPublicKey?: string;
    receiverPublicKey?: string;
  }

  export interface TypeOneParams {
    type: 1;
    senderPublicKey: string;
    receiverPublicKey: string;
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

  public abstract encode(
    topic: string,
    payload: JsonRpcPayload,
    opts?: CryptoTypes.EncodeOptions,
  ): Promise<string>;

  public abstract decode(
    topic: string,
    encoded: string,
    opts?: CryptoTypes.DecodeOptions,
  ): Promise<JsonRpcPayload>;

  public abstract signJWT(subject: string): Promise<string>;
}
