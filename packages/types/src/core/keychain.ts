import { Logger } from "pino";
import { ICore } from "./core";

export abstract class IKeyChain {
  public abstract keychain: Map<string, string>;

  public abstract name: string;

  public abstract readonly context: string;

  constructor(public core: ICore, public logger: Logger) {}

  public abstract init(): Promise<void>;

  public abstract has(tag: string, opts?: any): boolean;

  public abstract set(tag: string, key: string, opts?: any): Promise<void>;

  public abstract get(tag: string, opts?: any): string;

  public abstract del(tag: string, opts?: any): Promise<void>;
}
