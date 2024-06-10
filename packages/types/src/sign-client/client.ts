import { Logger } from "@walletconnect/logger";
import EventEmmiter from "events";
import { CoreTypes, ICore } from "../core/core";
import { IEngine } from "./engine";
import { IPendingRequest } from "./pendingRequest";
import { IProposal, ProposalTypes } from "./proposal";
import { ISession, SessionTypes } from "./session";
import { Verify } from "../core/verify";
import { IAuth, AuthTypes } from "./auth";

export declare namespace SignClientTypes {
  type Event =
    | "session_proposal"
    | "session_update"
    | "session_extend"
    | "session_ping"
    | "session_delete"
    | "session_expire"
    | "session_request"
    | "session_request_sent"
    | "session_event"
    | "session_authenticate"
    | "proposal_expire"
    | "session_request_expire";

  interface BaseEventArgs<T = unknown> {
    id: number;
    topic: string;
    params: T;
  }
  interface EventArguments {
    session_proposal: {
      verifyContext: Verify.Context;
    } & Omit<BaseEventArgs<ProposalTypes.Struct>, "topic">;
    session_update: BaseEventArgs<{ namespaces: SessionTypes.Namespaces }>;
    session_extend: Omit<BaseEventArgs, "params">;
    session_ping: Omit<BaseEventArgs, "params">;
    session_delete: Omit<BaseEventArgs, "params">;
    session_expire: { topic: string };
    session_request: {
      verifyContext: Verify.Context;
    } & BaseEventArgs<{
      request: { method: string; params: any; expiryTimestamp?: number };
      chainId: string;
    }>;
    session_request_sent: {
      request: { method: string; params: any };
      topic: string;
      chainId: string;
      id: number;
    };
    session_event: BaseEventArgs<{
      event: { name: string; data: any };
      chainId: string;
    }>;
    session_authenticate: BaseEventArgs<AuthTypes.AuthRequestEventArgs>;
    proposal_expire: { id: number };
    session_request_expire: { id: number };
  }

  type Metadata = CoreTypes.Metadata;

  type SignConfig = {
    disableRequestQueue?: boolean;
  };

  interface Options extends CoreTypes.Options {
    core?: ICore;
    metadata?: Metadata;
    signConfig?: SignConfig;
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

  public abstract removeAllListeners: <E extends SignClientTypes.Event>(event: E) => this;
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
  public abstract session: ISession;
  public abstract proposal: IProposal;
  public abstract pendingRequest: IPendingRequest;
  public abstract auth: IAuth;
  public abstract signConfig?: SignClientTypes.SignConfig;

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
  public abstract getPendingSessionRequests: IEngine["getPendingSessionRequests"];
  public abstract authenticate: IEngine["authenticate"];
  public abstract formatAuthMessage: IEngine["formatAuthMessage"];
  public abstract approveSessionAuthenticate: IEngine["approveSessionAuthenticate"];
  public abstract rejectSessionAuthenticate: IEngine["rejectSessionAuthenticate"];
}
