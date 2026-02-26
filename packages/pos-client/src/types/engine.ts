import EventEmitter from "events";
import { ISignClient, SessionTypes } from "@walletconnect/types";
import { IPOSClient, POSClientTypes } from "./client.js";
import { UtilsTypes } from "./index.js";
import { Logger } from "@walletconnect/logger";

export declare namespace POSClientEngineTypes {
  /**
   * @param userId - Arbitrary user ID to map a user to a session
   */
  interface ConnectParams {
    userId: string;
  }

  type EngineEvents = POSClientTypes.Event | "await_approval";

  interface EventArguments extends POSClientTypes.EventArguments {
    await_approval: {
      approval: () => Promise<SessionTypes.Struct>;
      paymentIntents: POSClientTypes.PaymentIntent[];
      userId?: string;
      manualControl: boolean;
    };
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

  type DisconnectParams = {
    sessionTopic?: string;
  };

  type CreatePaymentIntentParams = {
    paymentIntents: POSClientTypes.PaymentIntent[];
    manualControl?: boolean;
    sessionTopic?: string;
    userId?: string;
  };

  type RestartParams = {
    reinit?: boolean;
    sessionTopic?: string;
    userId?: string;
  };

  type SetTokensParams = {
    tokens: POSClientTypes.Token[];
  };

  type AwaitPaymentConfirmedParams = {
    transaction: POSClientEngineTypes.Transaction;
    result: unknown;
    sessionTopic: string;
    userId?: string;
  };

  type SendPaymentsToWalletParams = {
    sessionTopic?: string;
    userId?: string;
  };

  type SendTransactionsToWalletParams = {
    sessionTopic: string;
    userId?: string;
  };

  type PrepareTransactionsFromPaymentIntentsParams = {
    sessionTopic?: string;
    userId?: string;
  };

  type OnSessionConnectedParams = {
    session: SessionTypes.Struct;
    userId?: string;
    manualControl?: boolean;
  };
}

export abstract class IPOSClientEngine {
  public abstract signClient: ISignClient;
  public abstract logger: Logger;
  public abstract tokens: POSClientTypes.Token[];
  public abstract supportedNamespaces: UtilsTypes.SupportedNamespaces;
  public abstract paymentIntents: Record<string, POSClientTypes.PaymentIntent[]>;
  public abstract transactions: Record<string, POSClientEngineTypes.Transaction[]>;

  constructor(public client: IPOSClient) {}
  // ---------- Public Methods ------------------------------------------------- //
  public abstract init(): Promise<void>;

  public abstract setTokens(params: POSClientEngineTypes.SetTokensParams): Promise<void>;

  public abstract connect(params: POSClientEngineTypes.ConnectParams): Promise<SessionTypes.Struct>;

  public abstract createPaymentIntent(
    params: POSClientEngineTypes.CreatePaymentIntentParams,
  ): Promise<void>;

  public abstract restart(params?: POSClientEngineTypes.RestartParams): Promise<void>;

  public abstract disconnect(params?: POSClientEngineTypes.DisconnectParams): Promise<void>;

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
  public abstract prepareTransactionsFromPaymentIntents(
    params: POSClientEngineTypes.PrepareTransactionsFromPaymentIntentsParams,
  ): Promise<void>;

  public abstract onSessionConnected(
    params: POSClientEngineTypes.OnSessionConnectedParams,
  ): Promise<void>;

  public abstract sendTransactionsToWallet(
    params: POSClientEngineTypes.SendTransactionsToWalletParams,
  ): Promise<void>;

  public abstract awaitPaymentConfirmed(
    params: POSClientEngineTypes.AwaitPaymentConfirmedParams,
  ): Promise<void>;

  public abstract sendPaymentsToWallet(
    params?: POSClientEngineTypes.SendPaymentsToWalletParams,
  ): Promise<void>;
}
