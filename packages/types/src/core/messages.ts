import { Logger } from "@walletconnect/logger";
import { ICore } from "./core";

export type MessageRecord = Record<string, string>;

export abstract class IMessageTracker {
  public abstract messages: Map<string, MessageRecord>;

  public abstract name: string;

  public abstract readonly context: string;

  constructor(public logger: Logger, public core: ICore) {}

  public abstract init(): Promise<void>;

  public abstract set(topic: string, message: string): Promise<string>;

  public abstract get(topic: string): MessageRecord;

  public abstract has(topic: string, message: string): boolean;

  public abstract del(topic: string): Promise<void>;
}
