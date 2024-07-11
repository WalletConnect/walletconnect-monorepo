import { Logger } from "@walletconnect/logger";
import { ICore } from "./core";

export declare namespace EventClientTypes {
  export interface Event {
    eventId: string;
    bundleId: string;
    timestamp: number;
    props: Props;
  }

  export interface Props {
    event: string;
    type: string;
    properties: Properties;
  }

  export interface Properties {
    topic: string;
    trace: Trace;
  }

  export type Trace = string[];
}

export abstract class IEventClient {
  public abstract readonly context: string;

  constructor(public core: ICore, public logger: Logger) {}

  public abstract createEvent(params: {
    event?: "ERROR";
    type: string;
    properties: {
      topic: string;
      trace: EventClientTypes.Trace;
    };
  }): Promise<EventClientTypes.Event>;
}
