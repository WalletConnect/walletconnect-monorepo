import { ErrorResponse } from "@walletconnect/jsonrpc-types";
import { Logger } from "pino";
import { ICore } from "./core";

export abstract class IStore<Key, Value> {
  public abstract map: Map<Key, Value>;

  public abstract readonly context: string;

  public abstract readonly length: number;

  public abstract readonly keys: Key[];

  public abstract readonly values: Value[];

  constructor(public core: ICore, public logger: Logger, public name: string) {}

  public abstract init(): Promise<void>;

  public abstract set(key: Key, value: Value): Promise<void>;

  public abstract get(key: Key): Value;

  public abstract update(key: Key, update: Partial<Value>): Promise<void>;

  public abstract delete(key: Key, reason: ErrorResponse): Promise<void>;
}
