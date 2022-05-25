import EventEmmiter from "events";
import { Logger } from "pino";
import { IEngine } from "./engine";
import { IPairing } from "./pairing";
import { IProposal, ProposalTypes } from "./proposal";
import { ISession, SessionTypes } from "./session";
import { IJsonRpcHistory } from "../core/history";
import { CoreTypes, ICore } from "../core/core";
import { IExpirer } from "./expirer";

export declare namespace SignClientTypes {
  type Event =
    | "session_proposal"
    | "session_update"
    | "session_extend"
    | "session_ping"
    | "pairing_ping"
    | "session_delete"
    | "pairing_delete"
    | "session_expire"
    | "pairing_expire"
    | "session_request"
    | "session_event"
    | "proposal_expire";

  interface BaseEventArgs<T = unknown> {
    id: number;
    topic: string;
    params: T;
  }

  interface EventArguments {
    session_proposal: Omit<BaseEventArgs<ProposalTypes.Struct>, "topic">;
    session_update: BaseEventArgs<{ namespaces: SessionTypes.Namespaces }>;
    session_extend: Omit<BaseEventArgs, "params">;
    session_ping: Omit<BaseEventArgs, "params">;
    pairing_ping: Omit<BaseEventArgs, "params">;
    session_delete: Omit<BaseEventArgs, "params">;
    pairing_delete: Omit<BaseEventArgs, "params">;
    session_expire: { topic: string };
    pairing_expire: { topic: string };
    session_request: BaseEventArgs<{
      request: { method: string; params: any };
      chainId: string;
    }>;
    session_event: BaseEventArgs<{
      event: { name: string; data: any };
      chainId: string;
    }>;
    proposal_expire: { id: number };
  }

  type Metadata = {
    name: string;
    description: string;
    url: string;
    icons: string[];
  };

  interface Options extends CoreTypes.Options {
    core?: ICore;
    metadata?: Metadata;
  }
}

export abstract class ISignClientEvents extends EventEmmiter {
  constructor() {
    super();
  }

  public abstract emit: <E extends SignClientTypes.Event>(
    event: E,
    args: SignClientTypes.EventArguments[E],
  ) => boolean;

  public abstract on: <E extends SignClientTypes.Event>(
    event: E,
    listener: (args: SignClientTypes.EventArguments[E]) => any,
  ) => this;

  public abstract once: <E extends SignClientTypes.Event>(
    event: E,
    listener: (args: SignClientTypes.EventArguments[E]) => any,
  ) => this;

  public abstract off: <E extends SignClientTypes.Event>(
    event: E,
    listener: (args: SignClientTypes.EventArguments[E]) => any,
  ) => this;

  public abstract removeListener: <E extends SignClientTypes.Event>(
    event: E,
    listener: (args: SignClientTypes.EventArguments[E]) => any,
  ) => this;
}

export abstract class ISignClient {
  public readonly protocol = "wc";
  public readonly version = 2;

  public abstract readonly name: string;
  public abstract readonly context: string;
  public abstract readonly metadata: SignClientTypes.Metadata;

  public abstract core: ICore;
  public abstract logger: Logger;
  public abstract events: ISignClientEvents;
  public abstract engine: IEngine;
  public abstract pairing: IPairing;
  public abstract session: ISession;
  public abstract proposal: IProposal;
  public abstract history: IJsonRpcHistory;
  public abstract expirer: IExpirer;

  constructor(public opts?: SignClientTypes.Options) {}

  public abstract connect: IEngine["connect"];
  public abstract pair: IEngine["pair"];
  public abstract approve: IEngine["approve"];
  public abstract reject: IEngine["reject"];
  public abstract update: IEngine["update"];
  public abstract extend: IEngine["extend"];
  public abstract request: IEngine["request"];
  public abstract respond: IEngine["respond"];
  public abstract ping: IEngine["ping"];
  public abstract emit: IEngine["emit"];
  public abstract disconnect: IEngine["disconnect"];
  public abstract find: IEngine["find"];
}
