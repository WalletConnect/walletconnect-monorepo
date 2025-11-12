import EventEmitter from "events";
import type { ISignClient, SessionTypes } from "@walletconnect/types";
import { IPOSClient, POSClientTypes } from "./client.js";
import { UtilsTypes } from "./index.js";
import { Logger } from "@walletconnect/logger";

export declare namespace POSClientEngineTypes {
  type EngineEvents = POSClientTypes.Event | "await_approval";

  interface EventArguments extends POSClientTypes.EventArguments {
    await_approval: { approval: () => Promise<SessionTypes.Struct> };
  }

  type TransactionParams = {
    to: string;
    from: string;
    gas: string;
    value: string;
    data: string;
    gasPrice: string;
  };

  type Transaction = {
    method: string;
    params: TransactionParams[];
    id: string;
    chainId: string;
  };

  type RPCTransactions = {
    id: string;
    jsonrpc: string;
    result: {
      transactions: Transaction[];
    };
  };

  type RPCPaymentIntent = {
    asset: string;
    recipient: string;
    amount: string;
    sender: string;
  };

  type RPCSupportedNetworksResult = {
    id: string;
    jsonrpc: string;
    result: {
      namespaces: UtilsTypes.SupportedNamespaces;
    };
  };

  type RPCCheckTransactionResult = {
    id: string;
    jsonrpc: string;
    result: {
      status: "CONFIRMED" | "FAILED" | "PENDING";
      checkIn?: number;
      error?: string;
    };
  };
}

export abstract class IPOSClientEngine {
  public abstract signClient: ISignClient;
  public abstract logger: Logger;
  public abstract tokens: POSClientTypes.Token[];
  public abstract supportedNamespaces: UtilsTypes.SupportedNamespaces;
  public abstract paymentIntents?: POSClientTypes.PaymentIntent[];
  public abstract transactions?: POSClientEngineTypes.Transaction[];

  constructor(public client: IPOSClient) {}
  // ---------- Public Methods ------------------------------------------------- //
  public abstract init(): Promise<void>;

  public abstract setTokens(params: { tokens: POSClientTypes.Token[] }): Promise<void>;
  public abstract createPaymentIntent(params: {
    paymentIntents: POSClientTypes.PaymentIntent[];
    manualControl?: boolean;
  }): Promise<void>;

  public abstract restart(params?: { reinit?: boolean }): Promise<void>;
  public abstract disconnect(): Promise<void>;

  // ---------- Event Handlers ----------------------------------------------- //
  public abstract on: <E extends POSClientEngineTypes.EngineEvents>(
    event: E,
    listener: (args: POSClientEngineTypes.EventArguments[E]) => void,
  ) => EventEmitter;

  public abstract once: <E extends POSClientEngineTypes.EngineEvents>(
    event: E,
    listener: (args: POSClientEngineTypes.EventArguments[E]) => void,
  ) => EventEmitter;

  public abstract off: <E extends POSClientTypes.Event>(
    event: E,
    listener: (args: POSClientEngineTypes.EventArguments[E]) => void,
  ) => EventEmitter;

  public abstract removeListener: <E extends POSClientEngineTypes.EngineEvents>(
    event: E,
    listener: (args: POSClientEngineTypes.EventArguments[E]) => void,
  ) => EventEmitter;

  public abstract emit: <E extends POSClientEngineTypes.EngineEvents>(
    event: E,
    args: POSClientEngineTypes.EventArguments[E],
  ) => boolean;

  // ---------- Internally used methods ----------------------------------------------- //
  public abstract prepareTransactionsFromPaymentIntents(): Promise<void>;

  public abstract onSessionConnected(params: { session: SessionTypes.Struct }): Promise<void>;

  public abstract sendTransactionsToWallet(): Promise<void>;

  public abstract awaitPaymentConfirmed(params: {
    transaction: POSClientEngineTypes.Transaction;
    result: unknown;
  }): Promise<void>;

  public abstract sendPaymentsToWallet(): Promise<void>;
}
