import { Logger } from "pino";
import { IJsonRpcProvider, JsonRpcPayload } from "rpc-json-types";

import { DecryptParams, EncryptParams, KeyParams } from "./crypto";
import { IEvents } from "./events";

export declare namespace RelayTypes {
  export interface ProtocolOptions {
    protocol: string;
    params?: any;
  }

  export interface JsonRpcMethods {
    isConnected: string;
    connect: string;
    disconnect: string;
    publish: string;
    subscribe: string;
    subscription: string;
    unsubscribe: string;
  }

  export interface SubscribeParams {
    topic: string;
    ttl: number;
  }

  export interface PublishParams {
    topic: string;
    message: string;
    ttl: number;
  }

  export interface SubscriptionParams {
    id: string;
    data: {
      topic: string;
      message: string;
    };
  }

  export interface UnsubscribeParams {
    id: string;
  }

  export interface PublishOptions {
    relay: ProtocolOptions;
    encryptKeys?: KeyParams;
  }
  export interface SubscribeOptions {
    relay: ProtocolOptions;
    decryptKeys?: KeyParams;
  }
}

export abstract class IRelay extends IEvents {
  public abstract provider: IJsonRpcProvider;

  public abstract context: string;

  constructor(public logger: Logger, provider?: IJsonRpcProvider) {
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
