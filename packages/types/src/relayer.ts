import { Logger } from "pino";
import { IKeyValueStorage } from "keyvaluestorage";
import { IJsonRpcProvider, JsonRpcPayload, IEvents } from "@walletconnect/jsonrpc-types";

import { IClient } from "./client";
import { ISubscription, SubscriptionParams } from "./subscription";
import { IJsonRpcHistory } from "./history";
import { IHeartBeat, IRelayerStorage, Storage } from ".";

export declare namespace RelayerTypes {
  export interface ProtocolOptions {
    protocol: string;
    params?: any;
  }

  export interface PublishOptions {
    relay: ProtocolOptions;
    ttl?: number;
  }

  export interface SubscribeOptions {
    relay: ProtocolOptions;
  }

  export interface UnsubscribeOptions {
    relay: ProtocolOptions;
  }

  export type RequestOptions = PublishOptions | SubscribeOptions | UnsubscribeOptions;

  export interface PayloadEvent {
    topic: string;
    payload: JsonRpcPayload;
  }
}

export interface PublishParams {
  topic: string;
  payload: JsonRpcPayload;
  opts: Required<RelayerTypes.PublishOptions>;
}

export abstract class IRelayerEncoder {
  public abstract encode(
    topic: string,
    payload: JsonRpcPayload,
    nonce?: number | string,
  ): Promise<string>;

  public abstract decode(
    topic: string,
    encrypted: string,
    nonce?: number | string,
  ): Promise<JsonRpcPayload>;
}

export interface RelayerOptions {
  logger?: string | Logger;
  provider?: string | IJsonRpcProvider;
  storage?: Storage;
  keyValueStorage?: IKeyValueStorage;
  apiKey?: string;
}

export abstract class IRelayer extends IEvents {
  public abstract logger: Logger;

  public abstract storage: IRelayerStorage;

  public abstract queue: Map<number, PublishParams>;

  public abstract pending: Map<string, SubscriptionParams>;

  public abstract subscriptions: ISubscription;

  public abstract history: IJsonRpcHistory;

  public abstract provider: IJsonRpcProvider;

  public abstract name: string;

  public abstract readonly context: string;

  public abstract readonly connected: boolean;

  public abstract readonly connecting: boolean;

  constructor(
    public heartbeat: IHeartBeat,
    public encoder: IRelayerEncoder,
    opts?: RelayerOptions,
  ) {
    super();
  }

  public abstract init(): Promise<void>;

  public abstract publish(
    topic: string,
    payload: JsonRpcPayload,
    opts?: RelayerTypes.PublishOptions,
  ): Promise<void>;

  public abstract subscribe(topic: string, opts?: RelayerTypes.SubscribeOptions): Promise<string>;

  public abstract unsubscribe(topic: string, opts?: RelayerTypes.UnsubscribeOptions): Promise<void>;
}
