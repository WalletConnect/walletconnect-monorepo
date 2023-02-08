import { ErrorResponse } from "@walletconnect/jsonrpc-types";
import { Logger } from "@walletconnect/logger";
import { ICore } from "./core";

export abstract class IStore<Key, Value> {
  public abstract map: Map<Key, Value>;

  public abstract readonly context: string;

  public abstract readonly length: number;

  public abstract readonly keys: Key[];

  public abstract readonly values: Value[];

  constructor(
    public core: ICore,
    public logger: Logger,
    public name: string,
    // @ts-ignore
    storagePrefix?: string,
  ) {}

  public abstract init(): Promise<void>;

  public abstract set(key: Key, value: Value): Promise<void>;

  public abstract get(key: Key): Value;

  public abstract getAll(filter?: Partial<Value>): Value[];

  public abstract update(key: Key, update: Partial<Value>): Promise<void>;

  public abstract delete(key: Key, reason: ErrorResponse): Promise<void>;
}
