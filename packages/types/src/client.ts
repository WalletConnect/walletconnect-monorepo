import EventEmmiter from "events";
import { Logger } from "pino";
import { IEngine } from "./engine";
import { IPairing } from "./pairing";
import { IProposal, ProposalTypes } from "./proposal";
import { ISession, SessionTypes } from "./session";
import { IJsonRpcHistory } from "./history";
import { CoreTypes, ICore } from "./core";
import { IExpirer } from "./expirer";
import { JsonRpcRequest } from "@walletconnect/jsonrpc-types";

export declare namespace ClientTypes {
  type Event =
    | "session_proposal"
    | "session_update"
    | "session_extend"
    | "session_ping"
    | "pairing_ping"
    | "session_delete"
    | "pairing_delete"
    | "session_expired"
    | "pairing_expired"
    | "request"
    | "event";

  interface EventArguments {
    session_proposal: JsonRpcRequest<ProposalTypes.Struct>;
    session_update: JsonRpcRequest<{ namespaces: SessionTypes.Namespaces }>;
    session_extend: JsonRpcRequest<{ topic: string }>;
    session_ping: JsonRpcRequest<{ topic: string }>;
    pairing_ping: JsonRpcRequest<{ topic: string }>;
    session_delete: JsonRpcRequest<{ topic: string }>;
    pairing_delete: JsonRpcRequest<{ topic: string }>;
    session_expired: { topic: string };
    pairing_expired: { topic: string };
    request: JsonRpcRequest<{
      topic: string;
      request: {
        method: string;
        params: any;
      };
      chainId?: string;
    }>;
    event: JsonRpcRequest<{
      topic: string;
      event: {
        name: string;
        data: any;
      };
      chainId?: string;
    }>;
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

export abstract class IClientEvents extends EventEmmiter {
  constructor() {
    super();
  }

  public abstract emit: <E extends ClientTypes.Event>(
    event: E,
    args: ClientTypes.EventArguments[E],
  ) => boolean;

  public abstract on: <E extends ClientTypes.Event>(
    event: E,
    listener: (args: ClientTypes.EventArguments[E]) => any,
  ) => this;

  public abstract once: <E extends ClientTypes.Event>(
    event: E,
    listener: (args: ClientTypes.EventArguments[E]) => any,
  ) => this;

  public abstract off: <E extends ClientTypes.Event>(
    event: E,
    listener: (args: ClientTypes.EventArguments[E]) => any,
  ) => this;

  public abstract removeListener: <E extends ClientTypes.Event>(
    event: E,
    listener: (args: ClientTypes.EventArguments[E]) => any,
  ) => this;
}

export abstract class IClient {
  public readonly protocol = "wc";
  public readonly version = 2;

  public abstract readonly name: string;
  public abstract readonly context: string;
  public abstract readonly metadata: ClientTypes.Metadata;

  public abstract core: ICore;
  public abstract logger: Logger;
  public abstract events: IClientEvents;
  public abstract engine: IEngine;
  public abstract pairing: IPairing;
  public abstract session: ISession;
  public abstract proposal: IProposal;
  public abstract history: IJsonRpcHistory;
  public abstract expirer: IExpirer;

  constructor(public opts?: ClientTypes.Options) {}

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
