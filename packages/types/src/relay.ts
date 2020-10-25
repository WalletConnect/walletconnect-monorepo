import { IJsonRpcProvider, JsonRpcPayload } from "rpc-json-types";

import { DecryptParams, EncryptParams } from "./crypto";
import { IEvents } from "./events";

export interface RelayProtocolOptions {
  protocol: string;
  params?: any;
}

export interface RelaySubscribeParams {
  topic: string;
  ttl: number;
}

export interface RelayPublishParams {
  topic: string;
  message: string;
  ttl: number;
}

export interface RelaySubscriptionParams {
  topic: string;
  message: string;
}

export interface RelayUnsubscribeParams {
  topic: string;
}

export interface RelayPublishOptions {
  relay: RelayProtocolOptions;
  encrypt?: Omit<EncryptParams, "message">;
}
export interface RelaySubscribeOptions {
  relay: RelayProtocolOptions;
  decrypt?: Omit<DecryptParams, "encrypted">;
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
    opts?: RelayPublishOptions,
  ): Promise<void>;

  public abstract subscribe(
    topic: string,
    listener: (payload: JsonRpcPayload) => void,
    opts?: RelaySubscribeOptions,
  ): Promise<void>;

  public abstract unsubscribe(
    topic: string,
    listener: (payload: JsonRpcPayload) => void,
    opts?: RelaySubscribeOptions,
  ): Promise<void>;
}
