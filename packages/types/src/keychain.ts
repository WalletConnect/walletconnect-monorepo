import { Logger } from "pino";
import { IClient } from "./client";

export abstract class IKeyChain {
  public abstract keychain: Map<string, string>;

  public abstract name: string;

  public abstract readonly context: string;

  constructor(public client: IClient, public logger: Logger) {}

  public abstract init(): Promise<void>;

  public abstract has(tag: string, opts?: any): Promise<boolean>;

  public abstract set(tag: string, key: string, opts?: any): Promise<void>;

  public abstract get(tag: string, opts?: any): Promise<string>;

  public abstract del(tag: string, opts?: any): Promise<void>;
}
