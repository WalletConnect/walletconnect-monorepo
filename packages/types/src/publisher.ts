import { Logger } from "pino";
import { IEvents, JsonRpcPayload } from "@walletconnect/jsonrpc-types";

import { IRelayer, RelayerTypes } from "./relayer";

export declare namespace PublisherTypes {
  export interface Params {
    topic: string;
    payload: JsonRpcPayload;
    opts: Required<RelayerTypes.PublishOptions>;
  }
}

export abstract class IPublisher extends IEvents {
  public abstract name: string;

  public abstract readonly context: string;

  constructor(public relayer: IRelayer, public logger: Logger) {
    super();
  }

  public abstract init(): Promise<void>;

  public abstract publish(
    topic: string,
    payload: JsonRpcPayload,
    opts?: RelayerTypes.PublishOptions,
  ): Promise<void>;
}
