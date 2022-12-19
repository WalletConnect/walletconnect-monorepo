import EventEmmiter, { EventEmitter } from "events";
import { ICore, ProposalTypes } from "@walletconnect/types";
import { AuthClientTypes } from "@walletconnect/auth-client";
import { IWeb3WalletEngine } from "./engine";
import { Logger } from "@walletconnect/logger";
import { PendingRequest } from "../controllers";

export declare namespace Web3WalletTypes {
  type Event = "session_proposal" | "session_request" | "auth_request";

  interface BaseEventArgs<T = unknown> {
    id: number;
    topic: string;
    params: T;
  }

  type SessionRequest = BaseEventArgs<{
    request: { method: string; params: any };
    chainId: string;
  }>;

  type SessionProposal = Omit<BaseEventArgs<ProposalTypes.Struct>, "topic">;

  type AuthRequest = BaseEventArgs<AuthClientTypes.AuthRequestEventArgs>;

  interface EventArguments {
    session_proposal: Omit<BaseEventArgs<ProposalTypes.Struct>, "topic">;
    session_request: SessionRequest;
    auth_request: AuthRequest;
  }

  interface Options {
    core: ICore;
    metadata: Metadata;
    name?: string;
  }

  type Metadata = AuthClientTypes.Metadata;
}

export abstract class IWeb3WalletEvents extends EventEmmiter {
  constructor() {
    super();
  }

  public abstract emit: <E extends Web3WalletTypes.Event>(
    event: E,
    args: Web3WalletTypes.EventArguments[E],
  ) => boolean;

  public abstract on: <E extends Web3WalletTypes.Event>(
    event: E,
    listener: (args: Web3WalletTypes.EventArguments[E]) => any,
  ) => this;

  public abstract once: <E extends Web3WalletTypes.Event>(
    event: E,
    listener: (args: Web3WalletTypes.EventArguments[E]) => any,
  ) => this;

  public abstract off: <E extends Web3WalletTypes.Event>(
    event: E,
    listener: (args: Web3WalletTypes.EventArguments[E]) => any,
  ) => this;

  public abstract removeListener: <E extends Web3WalletTypes.Event>(
    event: E,
    listener: (args: Web3WalletTypes.EventArguments[E]) => any,
  ) => this;
}

export abstract class IWeb3Wallet {
  public abstract readonly name: string;
  public abstract engine: IWeb3WalletEngine;
  public abstract events: EventEmitter;
  public abstract logger: Logger;
  public abstract core: ICore;
  public abstract pendingRequest: PendingRequest;
  public abstract metadata: Web3WalletTypes.Metadata;

  constructor(public opts: Web3WalletTypes.Options) {}

  // ---------- Public Methods ----------------------------------------------- //
  // sign //
  public abstract approveSession: IWeb3WalletEngine["approveSession"];
  public abstract rejectSession: IWeb3WalletEngine["rejectSession"];
  public abstract updateSession: IWeb3WalletEngine["updateSession"];
  public abstract extendSession: IWeb3WalletEngine["extendSession"];
  public abstract respondSessionRequest: IWeb3WalletEngine["respondSessionRequest"];
  public abstract disconnectSession: IWeb3WalletEngine["disconnectSession"];
  public abstract emitSessionEvent: IWeb3WalletEngine["emitSessionEvent"];
  public abstract getActiveSessions: IWeb3WalletEngine["getActiveSessions"];
  public abstract getPendingSessionProposals: IWeb3WalletEngine["getPendingSessionProposals"];
  public abstract getPendingSessionRequests: IWeb3WalletEngine["getPendingSessionRequests"];
  // auth //
  public abstract respondAuthRequest: IWeb3WalletEngine["respondAuthRequest"];
  public abstract getPendingAuthRequests: IWeb3WalletEngine["getPendingAuthRequests"];
  public abstract formatMessage: IWeb3WalletEngine["formatMessage"];

  // ---------- Event Handlers ----------------------------------------------- //
  public abstract on: <E extends Web3WalletTypes.Event>(
    event: E,
    listener: (args: Web3WalletTypes.EventArguments[E]) => void,
  ) => EventEmitter;

  public abstract once: <E extends Web3WalletTypes.Event>(
    event: E,
    listener: (args: Web3WalletTypes.EventArguments[E]) => void,
  ) => EventEmitter;

  public abstract off: <E extends Web3WalletTypes.Event>(
    event: E,
    listener: (args: Web3WalletTypes.EventArguments[E]) => void,
  ) => EventEmitter;

  public abstract removeListener: <E extends Web3WalletTypes.Event>(
    event: E,
    listener: (args: Web3WalletTypes.EventArguments[E]) => void,
  ) => EventEmitter;
}
