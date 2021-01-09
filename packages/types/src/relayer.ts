import { Logger } from "pino";
import { IJsonRpcProvider, JsonRpcPayload, IEvents } from "@json-rpc-tools/types";

import { CryptoTypes } from "./crypto";

export declare namespace RelayerTypes {
  export interface ProtocolOptions {
    protocol: string;
    params?: any;
  }

  export interface PublishOptions {
    relay: ProtocolOptions;
    ttl?: number;
    encryptKeys?: CryptoTypes.EncryptKeys;
  }

  export interface SubscribeOptions {
    relay: ProtocolOptions;
    decryptKeys?: CryptoTypes.DecryptKeys;
  }
}

export abstract class IRelayer extends IEvents {
  public abstract provider: IJsonRpcProvider;

  public abstract context: string;

  public abstract readonly connected: boolean;

  constructor(public logger: Logger, provider?: string | IJsonRpcProvider) {
    super();
  }

  public abstract init(): Promise<void>;

  public abstract publish(
    topic: string,
    payload: JsonRpcPayload,
    opts?: RelayerTypes.PublishOptions,
  ): Promise<void>;

  public abstract subscribe(
    topic: string,
    listener: (payload: JsonRpcPayload) => void,
    opts?: RelayerTypes.SubscribeOptions,
  ): Promise<string>;

  public abstract unsubscribe(id: string, opts?: RelayerTypes.SubscribeOptions): Promise<void>;
}
