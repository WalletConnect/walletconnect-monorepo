import { IEvents } from "@walletconnect/jsonrpc-types";
import { Logger } from "pino";

import { Reason } from "./misc";
import { IRelayerStorage } from "./storage";
import { RelayerTypes } from "./relayer";

export abstract class ISubscriptionTopicMap {
  public map = new Map<string, string[]>();

  public abstract readonly topics: string[];

  public abstract set(topic: string, id: string): void;

  public abstract get(topic: string): string[];

  public abstract exists(topic: string, id: string): boolean;

  public abstract delete(topic: string, id?: string): void;

  public abstract clear(): void;
}

export interface SubscriptionParams extends RelayerTypes.SubscribeOptions {
  topic: string;
}

export interface SubscriptionActive extends SubscriptionParams {
  id: string;
}

export declare namespace SubscriptionEvent {
  export type Created = SubscriptionActive;

  export interface Deleted extends SubscriptionActive {
    reason: Reason;
  }

  export type Expired = Deleted;
}

export abstract class ISubscription extends IEvents {
  public abstract subscriptions: Map<string, SubscriptionActive>;

  public abstract topicMap: ISubscriptionTopicMap;

  public abstract readonly length: number;

  public abstract readonly ids: string[];

  public abstract readonly values: SubscriptionActive[];

  public abstract readonly topics: string[];

  public abstract name: string;

  public abstract readonly context: string;

  constructor(public logger: Logger, public storage: IRelayerStorage) {
    super();
  }

  public abstract init(): Promise<void>;

  public abstract set(id: string, subscription: SubscriptionActive): Promise<void>;

  public abstract get(id: string): Promise<SubscriptionActive>;

  public abstract delete(id: string, reason: Reason): Promise<void>;

  public abstract exists(id: string, topic: string): Promise<boolean>;

  public abstract enable(): Promise<void>;

  public abstract disable(): Promise<void>;
}
