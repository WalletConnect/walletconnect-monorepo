import { EventEmitter } from "events";
import { IPOSClientEngine, POSClientEngineTypes } from "./engine.js";
import { SessionTypes } from "@walletconnect/types";

export declare namespace POSClientTypes {
  type Event =
    | "qr_ready"
    | "connection_rejected"
    | "connection_failed"
    | "connected"
    | "payment_requested"
    | "payment_rejected"
    | "payment_broadcasted"
    | "payment_failed"
    | "payment_successful"
    | "disconnected";

  interface EventArguments {
    qr_ready: { uri: string; userId?: string };
    connection_rejected: any;
    connection_failed: { error: { message: string; code: number } };
    connected: { session: SessionTypes.Struct; userId?: string };
    payment_requested: {
      paymentIntent: PaymentIntent;
      transaction: POSClientEngineTypes.Transaction;
      sessionTopic: string;
      userId?: string;
    };
    payment_rejected: {
      error?: { message?: string; code: number };
      paymentIntent: PaymentIntent;
      sessionTopic: string;
      userId?: string;
    };
    payment_broadcasted: {
      paymentIntent: PaymentIntent;
      transaction: POSClientEngineTypes.Transaction;
      result: any;
      sessionTopic: string;
      userId?: string;
    };
    payment_failed: {
      error?: { message?: string; code: number };
      transaction: any;
      sessionTopic: string;
      userId?: string;
    };
    payment_successful: {
      transaction: POSClientEngineTypes.Transaction;
      result: any;
      sessionTopic: string;
      userId?: string;
    };
    disconnected: { sessionTopic: string; userId?: string };
  }

  interface Options {
    projectId: string;
    deviceId: string;
    metadata: Metadata;
    storageOptions?: {
      databaseName: string;
    };
    loggerOptions?: {
      posLevel?: "info" | "debug" | "warn" | "error" | "silent";
      signLevel?: "info" | "debug" | "warn" | "error" | "silent";
    };
  }

  type Metadata = {
    merchantName: string;
    description: string;
    url: string;
    logoIcon: string;
  };

  type Network = {
    name: string;
    chainId: string;
  };

  type Token = {
    network: Network;
    symbol: string;
    standard: string;
    address: string;
  };

  type PaymentIntent = {
    token: Token;
    amount: string;
    recipient: string;
  };
}

export abstract class IPOSClient {
  public abstract readonly name: string;
  public abstract engine: IPOSClientEngine;
  public abstract events: EventEmitter;
  public abstract metadata: POSClientTypes.Metadata;
  /** the first session in the client */
  public abstract session?: SessionTypes.Struct;
  /** all sessions in the client */
  public abstract sessions: SessionTypes.Struct[];

  constructor(public opts: POSClientTypes.Options) {}

  // ---------- Public Methods ----------------------------------------------- //

  public abstract setTokens: IPOSClientEngine["setTokens"];
  public abstract connect: IPOSClientEngine["connect"];
  public abstract createPaymentIntent: IPOSClientEngine["createPaymentIntent"];
  public abstract restart: IPOSClientEngine["restart"];
  public abstract sendPaymentsToWallet: IPOSClientEngine["sendPaymentsToWallet"];
  public abstract disconnect: IPOSClientEngine["disconnect"];

  // ---------- Event Handlers ----------------------------------------------- //
  public abstract on: <E extends POSClientTypes.Event>(
    event: E,
    listener: (args: POSClientTypes.EventArguments[E]) => void,
  ) => EventEmitter;

  public abstract once: <E extends POSClientTypes.Event>(
    event: E,
    listener: (args: POSClientTypes.EventArguments[E]) => void,
  ) => EventEmitter;

  public abstract off: <E extends POSClientTypes.Event>(
    event: E,
    listener: (args: POSClientTypes.EventArguments[E]) => void,
  ) => EventEmitter;

  public abstract removeListener: <E extends POSClientTypes.Event>(
    event: E,
    listener: (args: POSClientTypes.EventArguments[E]) => void,
  ) => EventEmitter;
}
