import { IEvents } from "@walletconnect/jsonrpc-types";
import { Logger } from "pino";

import { IClient } from "./client";
import { Reason } from "./misc";
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
  id: string;
  topic: string;
  expiry: number;
}

export declare namespace SubscriptionEvent {
  export type Created = SubscriptionParams;

  export interface Deleted extends SubscriptionParams {
    reason: Reason;
  }

  export type Expired = Deleted;
}

export abstract class ISubscription extends IEvents {
  public abstract subscriptions: Map<string, SubscriptionParams>;

  public abstract topicMap: ISubscriptionTopicMap;

  public abstract readonly length: number;

  public abstract readonly ids: string[];

  public abstract readonly values: SubscriptionParams[];

  public abstract readonly topics: string[];

  public abstract name: string;

  public abstract readonly context: string;

  constructor(public client: IClient, public logger: Logger) {
    super();
  }

  public abstract init(): Promise<void>;

  public abstract set(id: string, subscription: SubscriptionParams): Promise<void>;

  public abstract get(id: string): Promise<SubscriptionParams>;

  public abstract delete(id: string, reason: Reason): Promise<void>;

  public abstract exists(id: string, topic: string): Promise<boolean>;

  public abstract enable(): Promise<void>;

  public abstract disable(): Promise<void>;
}
