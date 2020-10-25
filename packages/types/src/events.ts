import { EventEmitter } from "events";

export abstract class IEvents {
  public abstract events: EventEmitter;

  public abstract on(event: string, listener: any): void;
  public abstract once(event: string, listener: any): void;
  public abstract off(event: string, listener: any): void;
}
