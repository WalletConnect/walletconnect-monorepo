import { IEvents } from "@walletconnect/events";
import { Logger } from "@walletconnect/logger";

import { IRelayer, RelayerTypes } from "./relayer.js";

export declare namespace PublisherTypes {
  export interface Params {
    topic: string;
    message: string;
    opts: Omit<RelayerTypes.PublishOptions, "internal">;
  }
}

export abstract class IPublisher extends IEvents {
  public abstract name: string;

  public abstract readonly context: string;
  public abstract dispose(): Promise<void>;

  constructor(
    public relayer: IRelayer,
    public logger: Logger,
  ) {
    super();
  }

  public abstract publish(
    topic: string,
    message: string,
    opts?: RelayerTypes.PublishOptions,
    signal?: AbortSignal,
  ): Promise<void>;

  public abstract publishCustom(
    params: {
      payload: any;
      opts?: RelayerTypes.PublishOptions;
    },
    signal?: AbortSignal,
  ): Promise<void>;
}
