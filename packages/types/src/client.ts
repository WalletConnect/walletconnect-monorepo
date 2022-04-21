import EventEmmiter from "events";
import { Logger } from "pino";
import { IKeyValueStorage, KeyValueStorageOptions } from "@walletconnect/keyvaluestorage";
import { IHeartBeat } from "@walletconnect/heartbeat";
import { ICrypto } from "./crypto";
import { IKeyChain } from "./keychain";
import { IEngine } from "./engine";
import { IPairing } from "./pairing";
import { IProposal, ProposalTypes } from "./proposal";
import { IRelayer } from "./relayer";
import { ISession, SessionTypes } from "./session";
import { IJsonRpcHistory } from "./history";

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
    | "pairing_delete";

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
  }

  type Metadata = {
    name: string;
    description: string;
    url: string;
    icons: string[];
  };

  type Options = Partial<{
    projectId: string;
    name: string;
    relayUrl: string;
    logger: string | Logger;
    keychain: IKeyChain;
    metadata?: Metadata;
    storageOptions?: KeyValueStorageOptions;
  }>;
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
  public abstract readonly relayUrl?: string;
  public abstract readonly projectId?: string;

  public abstract pairing: IPairing;
  public abstract session: ISession;
  public abstract proposal: IProposal;
  public abstract logger: Logger;
  public abstract heartbeat: IHeartBeat;
  public abstract crypto: ICrypto;
  public abstract relayer: IRelayer;
  public abstract storage: IKeyValueStorage;
  public abstract events: IClientEvents;
  public abstract engine: IEngine;
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
