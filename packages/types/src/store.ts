import { Logger } from "pino";
import { IClient } from "./client";
import { Reason } from "./misc";

export abstract class IStore<Data> {
  public abstract data: Map<string, Data>;

  public abstract readonly context: string;

  public abstract readonly length: number;

  public abstract readonly topics: string[];

  public abstract readonly values: Data[];

  constructor(public client: IClient, public logger: Logger, public name: string) {}

  public abstract init(): Promise<void>;

  public abstract set(topic: string, data: Data): Promise<void>;

  public abstract get(topic: string): Promise<Data>;

  public abstract update(topic: string, update: Partial<Data>): Promise<void>;

  public abstract delete(topic: string, reason: Reason): Promise<void>;
}
