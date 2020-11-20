import { JsonRpcPayload, IEvents } from "rpc-json-types";
import { Logger } from "pino";

import { IClient } from "./client";
import { RelayTypes } from "./relay";

export interface SubscriptionOptions extends RelayTypes.SubscribeOptions {
  ttl: number;
  relay: RelayTypes.ProtocolOptions;
}
export interface SubscriptionParams<Data> {
  id: string;
  topic: string;
  data: Data;
  opts: SubscriptionOptions;
}

export declare namespace SubscriptionEvent {
  export interface Payload {
    topic: string;
    payload: JsonRpcPayload;
  }

  export interface Created<T> {
    topic: string;
    data: T;
  }

  export interface Updated<T> {
    topic: string;
    data: T;
    update: Partial<T>;
  }

  export interface Deleted<T> {
    topic: string;
    data: T;
    reason: string;
  }
}

export type SubscriptionEntries<T> = Record<string, SubscriptionParams<T>>;

export abstract class ISubscription<Data> extends IEvents {
  public abstract subscriptions = new Map<string, SubscriptionParams<Data>>();

  public abstract readonly length: number;

  public abstract readonly entries: SubscriptionEntries<Data>;

  constructor(
    public client: IClient,
    public logger: Logger,
    public context: string,
    public encrypted: boolean,
  ) {
    super();
  }

  public abstract init(): Promise<void>;

  public abstract set(topic: string, data: Data, opts: SubscriptionOptions): Promise<void>;

  public abstract get(topic: string): Promise<Data>;

  public abstract update(topic: string, update: Partial<Data>): Promise<void>;

  public abstract delete(topic: string, reason: string): Promise<void>;

  // ---------- Protected ----------------------------------------------- //

  protected abstract onMessage(payloadEvent: SubscriptionEvent.Payload): Promise<any>;
}
