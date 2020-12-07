import { Logger } from "pino";
import { IJsonRpcProvider, JsonRpcPayload, IEvents } from "@json-rpc-tools/types";

import { CryptoTypes } from "./crypto";

export declare namespace RelayTypes {
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
    ttl?: number;
    decryptKeys?: CryptoTypes.DecryptKeys;
  }
}

export abstract class IRelay extends IEvents {
  public abstract provider: IJsonRpcProvider;

  public abstract context: string;

  constructor(public logger: Logger, provider?: string | IJsonRpcProvider) {
    super();
  }

  public abstract init(): Promise<void>;

  public abstract publish(
    topic: string,
    payload: JsonRpcPayload,
    opts?: RelayTypes.PublishOptions,
  ): Promise<void>;

  public abstract subscribe(
    topic: string,
    listener: (payload: JsonRpcPayload) => void,
    opts?: RelayTypes.SubscribeOptions,
  ): Promise<string>;

  public abstract unsubscribe(id: string, opts?: RelayTypes.SubscribeOptions): Promise<void>;
}
