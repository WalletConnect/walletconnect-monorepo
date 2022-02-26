import { Logger } from "pino";
import { IKeyValueStorage, KeyValueStorageOptions } from "keyvaluestorage";
import { IEvents } from "@walletconnect/events";
import { IHeartBeat } from "@walletconnect/heartbeat";
import { IJsonRpcProvider } from "@walletconnect/jsonrpc-types";

import { IRelayerStorage } from "./storage";
import { ISubscriber } from "./subscriber";
import { IPublisher } from "./publisher";

export declare namespace RelayerTypes {
  export interface ProtocolOptions {
    protocol: string;
    params?: any;
  }

  export interface PublishOptions {
    relay: ProtocolOptions;
    ttl?: number;
    prompt?: boolean;
  }

  export interface SubscribeOptions {
    relay: ProtocolOptions;
  }

  export interface UnsubscribeOptions {
    id?: string;
    relay: ProtocolOptions;
  }

  export type RequestOptions = PublishOptions | SubscribeOptions | UnsubscribeOptions;

  export interface MessageEvent {
    topic: string;
    message: string;
  }
}

export interface RelayerOptions {
  heartbeat?: IHeartBeat;
  storage?: IRelayerStorage;
  keyValueStorage?: IKeyValueStorage;
  keyValueStorageOptions?: KeyValueStorageOptions;
  logger?: string | Logger;
  rpcUrl?: string;
  projectId?: string;
  relayProvider?: string | IJsonRpcProvider;
}

export type MessageRecord = Record<string, string>;

export abstract class IMessageTracker {
  public abstract messages: Map<string, MessageRecord>;

  public abstract name: string;

  public abstract readonly context: string;

  constructor(public logger: Logger, public storage: IRelayerStorage) {}

  public abstract init(): Promise<void>;

  public abstract set(topic: string, message: string): Promise<string>;

  public abstract get(topic: string): Promise<MessageRecord>;

  public abstract has(topic: string, message: string): Promise<boolean>;

  public abstract del(topic: string): Promise<void>;
}

export abstract class IRelayer extends IEvents {
  public abstract logger: Logger;

  public abstract storage: IRelayerStorage;

  public abstract heartbeat: IHeartBeat;

  public abstract subscriber: ISubscriber;

  public abstract publisher: IPublisher;

  public abstract messages: IMessageTracker;

  public abstract provider: IJsonRpcProvider;

  public abstract name: string;

  public abstract readonly context: string;

  public abstract readonly connected: boolean;

  public abstract readonly connecting: boolean;

  constructor(opts?: RelayerOptions) {
    super();
  }

  public abstract init(): Promise<void>;

  public abstract publish(
    topic: string,
    message: string,
    opts?: RelayerTypes.PublishOptions,
  ): Promise<void>;

  public abstract subscribe(topic: string, opts?: RelayerTypes.SubscribeOptions): Promise<string>;

  public abstract unsubscribe(topic: string, opts?: RelayerTypes.UnsubscribeOptions): Promise<void>;
}
