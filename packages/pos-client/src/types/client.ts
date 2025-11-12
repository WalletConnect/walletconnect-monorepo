import { EventEmitter } from "events";
import { IPOSClientEngine, POSClientEngineTypes } from "./engine.js";
import type { SessionTypes } from "@walletconnect/types";

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
    qr_ready: { uri: string };
    connection_rejected: any;
    connection_failed: { error: { message: string; code: number } };
    connected: { session: SessionTypes.Struct };
    payment_requested: {
      paymentIntent: PaymentIntent;
      transaction: POSClientEngineTypes.Transaction;
    };
    payment_rejected: { error?: { message?: string; code: number }; paymentIntent: PaymentIntent };
    payment_broadcasted: {
      paymentIntent: PaymentIntent;
      transaction: POSClientEngineTypes.Transaction;
      result: any;
    };
    payment_failed: { error?: { message?: string; code: number }; transaction: any };
    payment_successful: { transaction: POSClientEngineTypes.Transaction; result: any };
    disconnected: any;
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
  public abstract session?: SessionTypes.Struct;

  constructor(public opts: POSClientTypes.Options) {}

  // ---------- Public Methods ----------------------------------------------- //

  public abstract setTokens: IPOSClientEngine["setTokens"];
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
