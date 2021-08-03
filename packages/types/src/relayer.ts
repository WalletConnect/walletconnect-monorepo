import { Logger } from "pino";
import { IJsonRpcProvider, JsonRpcPayload, IEvents } from "@walletconnect/jsonrpc-types";

import { IClient } from "./client";
import { ISubscription } from "./subscription";

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

  export interface PayloadEvent {
    topic: string;
    payload: JsonRpcPayload;
  }
}

export abstract class IRelayer extends IEvents {
  public abstract subscriptions: ISubscription;

  public abstract provider: IJsonRpcProvider;

  public abstract context: string;

  public abstract readonly connected: boolean;

  constructor(public client: IClient, public logger: Logger, provider?: string | IJsonRpcProvider) {
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
    expiry: number,
    opts?: RelayerTypes.SubscribeOptions,
  ): Promise<string>;

  public abstract unsubscribe(
    topic: string,
    id: string,
    opts?: RelayerTypes.SubscribeOptions,
  ): Promise<void>;
}
