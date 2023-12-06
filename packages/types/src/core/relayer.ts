import { IEvents } from "@walletconnect/events";
import { IJsonRpcProvider, JsonRpcPayload, RequestArguments } from "@walletconnect/jsonrpc-types";
import { Logger } from "@walletconnect/logger";

import { ICore } from "./core";
import { IMessageTracker } from "./messages";
import { IPublisher } from "./publisher";
import { ISubscriber } from "./subscriber";

export declare namespace RelayerTypes {
  export interface ProtocolOptions {
    protocol: string;
    data?: string;
  }
  export interface PublishOptions {
    relay?: ProtocolOptions;
    ttl?: number;
    prompt?: boolean;
    tag?: number;
    id?: number;
    internal?: {
      throwOnFailedPublish?: boolean;
    };
  }

  export interface SubscribeOptions {
    relay: ProtocolOptions;
  }

  export interface UnsubscribeOptions {
    id?: string;
    relay: ProtocolOptions;
  }

  export type RequestOptions = PublishOptions | SubscribeOptions | UnsubscribeOptions;

  export interface PublishPayload {
    topic: string;
    message: string;
    opts?: RelayerTypes.PublishOptions;
  }
  export interface MessageEvent {
    topic: string;
    message: string;
    publishedAt: number;
  }

  export interface RpcUrlParams {
    protocol: string;
    version: number;
    auth: string;
    relayUrl: string;
    sdkVersion: string;
    projectId?: string;
    useOnCloseEvent?: boolean;
    bundleId?: string;
  }
}

export interface RelayerOptions {
  core: ICore;
  logger?: string | Logger;
  relayUrl?: string;
  projectId?: string;
}

export interface RelayerClientMetadata {
  protocol: string;
  version: number;
  env: string;
  host?: string;
}

export abstract class IRelayer extends IEvents {
  public abstract core: ICore;

  public abstract logger: Logger;

  public abstract subscriber: ISubscriber;

  public abstract publisher: IPublisher;

  public abstract messages: IMessageTracker;

  public abstract provider: IJsonRpcProvider;

  public abstract name: string;

  public abstract transportExplicitlyClosed: boolean;

  public abstract readonly context: string;

  public abstract readonly connected: boolean;

  public abstract readonly connecting: boolean;

  constructor(
    // @ts-ignore
    opts: RelayerOptions,
  ) {
    super();
  }

  public abstract init(): Promise<void>;

  public abstract publish(
    topic: string,
    message: string,
    opts?: RelayerTypes.PublishOptions,
  ): Promise<void>;

  public abstract request(request: RequestArguments): Promise<JsonRpcPayload>;

  public abstract subscribe(topic: string, opts?: RelayerTypes.SubscribeOptions): Promise<string>;

  public abstract unsubscribe(topic: string, opts?: RelayerTypes.UnsubscribeOptions): Promise<void>;
  public abstract transportClose(): Promise<void>;
  public abstract transportOpen(relayUrl?: string): Promise<void>;
  public abstract restartTransport(relayUrl?: string): Promise<void>;
  public abstract confirmOnlineStateOrThrow(): Promise<void>;
}
