import {
  ErrorResponse,
  IEvents,
  JsonRpcRequest,
  JsonRpcResponse,
  RequestArguments,
} from "@walletconnect/jsonrpc-types";
import { Logger } from "pino";

import { IClient } from "./client";
import { RequestEvent } from "./misc";

export interface JsonRpcRecord {
  id: number;
  topic: string;
  request: RequestArguments;
  chainId?: string;
  response?: { result: any } | { error: ErrorResponse };
}

export abstract class IJsonRpcHistory extends IEvents {
  public records = new Map<number, JsonRpcRecord>();

  public abstract readonly context: string;

  public abstract readonly size: number;

  public abstract readonly keys: number[];

  public abstract readonly values: JsonRpcRecord[];

  public abstract readonly pending: RequestEvent[];

  constructor(public client: IClient, public logger: Logger) {
    super();
  }

  public abstract init(): Promise<void>;

  public abstract set(topic: string, request: JsonRpcRequest, chainId?: string): Promise<void>;

  public abstract get(topic: string, id: number): Promise<JsonRpcRecord>;

  public abstract resolve(response: JsonRpcResponse): Promise<void>;

  public abstract delete(topic: string, id?: number): Promise<void>;

  public abstract exists(topic: string, id: number): Promise<boolean>;
}
