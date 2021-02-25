import { Logger } from "pino";
import { IEvents } from "@json-rpc-tools/types";

import { IClient } from "./client";
import { ISequence } from "./sequence";

export abstract class ITimeout extends IEvents {
  public abstract timeout: Map<string, NodeJS.Timeout>;
  protected abstract context: string;
  constructor(public client: IClient, public logger: Logger, public sequence: ISequence) {
    super();
  }
  public abstract init(): Promise<void>;
  public abstract set(topic: string, expiry: number): void;
  public abstract get(topic: string): NodeJS.Timeout;
  public abstract has(topic: string): boolean;
  public abstract delete(topic: string): void;
}
