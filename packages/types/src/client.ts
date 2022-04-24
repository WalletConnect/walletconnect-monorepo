import EventEmmiter from "events";
import { JsonRpcTypes } from "./jsonrpc";
import { Logger } from "pino";
import { IEngine } from "./engine";
import { IPairing } from "./pairing";
import { IProposal, ProposalTypes } from "./proposal";
import { ISession, SessionTypes } from "./session";
import { IJsonRpcHistory } from "./history";
import { CoreTypes, ICore } from "./core";
import { JsonRpcRequest } from "@walletconnect/jsonrpc-types";

export declare namespace ClientTypes {
  type Event =
    | "session_proposal"
    | "update_accounts"
    | "update_methods"
    | "update_events"
    | "update_expiry"
    | "session_ping"
    | "pairing_ping"
    | "session_delete"
    | "pairing_delete"
    | "request"
    | "event";

  interface EventArguments {
    session_proposal: ProposalTypes.Struct;
    update_accounts: { topic: string; accounts: SessionTypes.Accounts };
    update_methods: { topic: string; methods: SessionTypes.Methods };
    update_events: { topic: string; events: SessionTypes.Events };
    update_expiry: { topic: string; expiry: number };
    session_ping: { topic: string };
    pairing_ping: { topic: string };
    session_delete: { topic: string };
    pairing_delete: { topic: string };
    request: {
      topic: string;
      request: {
        method: string;
        params: any;
      };
      chainId?: string;
    };
    event: {
      topic: string;
      event: {
        name: string;
        data: any;
      };
      chainId?: string;
    };
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
  public abstract readonly storagePrefix: string;
  public abstract readonly metadata: ClientTypes.Metadata;

  public abstract core: ICore;
  public abstract logger: Logger;
  public abstract events: IClientEvents;
  public abstract engine: IEngine;
  public abstract pairing: IPairing;
  public abstract session: ISession;
  public abstract proposal: IProposal;
  public abstract history: IJsonRpcHistory;

  constructor(public opts?: ClientTypes.Options) {}

  public abstract connect: IEngine["connect"];
  public abstract pair: IEngine["pair"];
  public abstract approve: IEngine["approve"];
  public abstract reject: IEngine["reject"];
  public abstract updateAccounts: IEngine["updateAccounts"];
  public abstract updateMethods: IEngine["updateMethods"];
  public abstract updateEvents: IEngine["updateEvents"];
  public abstract updateExpiry: IEngine["updateExpiry"];
  public abstract request: IEngine["request"];
  public abstract respond: IEngine["respond"];
  public abstract ping: IEngine["ping"];
  public abstract emit: IEngine["emit"];
  public abstract disconnect: IEngine["disconnect"];
}
