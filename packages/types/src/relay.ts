import { IJsonRpcProvider, JsonRpcPayload } from "rpc-json-types";

import { DecryptParams, EncryptParams } from "./crypto";
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
    topic: string;
    message: string;
  }

  export interface UnsubscribeParams {
    topic: string;
  }

  export interface PublishOptions {
    relay: ProtocolOptions;
    encrypt?: Omit<EncryptParams, "message">;
  }
  export interface SubscribeOptions {
    relay: ProtocolOptions;
    decrypt?: Omit<DecryptParams, "encrypted">;
  }
}

export abstract class IRelay extends IEvents {
  public abstract provider: IJsonRpcProvider;

  constructor(provider?: IJsonRpcProvider) {
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
  ): Promise<void>;

  public abstract unsubscribe(
    topic: string,
    listener: (payload: JsonRpcPayload) => void,
    opts?: RelayTypes.SubscribeOptions,
  ): Promise<void>;
}
