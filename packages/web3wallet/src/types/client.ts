import EventEmmiter, { EventEmitter } from "events";
import { ICore, CoreTypes, ProposalTypes, Verify } from "@walletconnect/types";
import { AuthClientTypes } from "@walletconnect/auth-client";
import { IWeb3WalletEngine } from "./engine";
import { Logger } from "@walletconnect/logger";
import { JsonRpcPayload } from "@walletconnect/jsonrpc-utils";

export declare namespace Web3WalletTypes {
  type Event = "session_proposal" | "session_request" | "session_delete" | "auth_request";

  interface BaseEventArgs<T = unknown> {
    id: number;
    topic: string;
    params: T;
  }

  type SessionRequest = BaseEventArgs<{
    request: { method: string; params: any };
    chainId: string;
  }> & {
    verifyContext: Verify.Context;
  };

  type SessionProposal = Omit<BaseEventArgs<ProposalTypes.Struct>, "topic"> & {
    verifyContext: Verify.Context;
  };

  type AuthRequest = BaseEventArgs<AuthClientTypes.AuthRequestEventArgs>;

  type SessionDelete = Omit<BaseEventArgs, "params">;

  interface EventArguments {
    session_proposal: SessionProposal;
    session_request: SessionRequest;
    session_delete: Omit<BaseEventArgs, "params">;
    auth_request: AuthRequest;
  }

  interface Options {
    core: ICore;
    metadata: Metadata;
    name?: string;
  }

  type Metadata = CoreTypes.Metadata;

  interface INotifications {
    decryptMessage: (params: {
      topic: string;
      encryptedMessage: string;
      storageOptions?: CoreTypes.Options["storageOptions"];
      storage?: CoreTypes.Options["storage"];
    }) => Promise<JsonRpcPayload>;
    getMetadata: (params: {
      topic: string;
      storageOptions?: CoreTypes.Options["storageOptions"];
      storage?: CoreTypes.Options["storage"];
    }) => Promise<CoreTypes.Metadata>;
  }
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
  public abstract metadata: Web3WalletTypes.Metadata;

  constructor(public opts: Web3WalletTypes.Options) {}

  // ---------- Public Methods ----------------------------------------------- //

  public abstract pair: IWeb3WalletEngine["pair"];

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
  // push
  public abstract registerDeviceToken: IWeb3WalletEngine["registerDeviceToken"];

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
