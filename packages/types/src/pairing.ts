import { Logger } from "pino";
import { IEvents, JsonRpcPayload } from "@walletconnect/jsonrpc-types";

import { IClient } from "./client";
import { IExpirer } from "./expirer";
import { IJsonRpcHistory } from "./history";
import { RelayerTypes } from "./relayer";
import { SessionTypes } from "./session";
import { IStore } from "./store";

export declare namespace PairingTypes {
  export interface Events {
    created: string;
    deleted: string;
    sync: string;
  }
  export interface JsonRpc {
    extend: string;
    delete: string;
    ping: string;
  }

  export interface Config<E = Events, J = JsonRpc> {
    ttl: number;
    events: E;
    jsonrpc: J;
  }
  export interface SessionRecord {
    topic: string;
    participants: SessionTypes.Participants;
  }
  export interface Settled {
    topic: string;
    relay: RelayerTypes.ProtocolOptions;
    expiry: number;
    sessions: SessionRecord[];
  }
  export interface CreateParams {
    ttl?: number;
    relay?: RelayerTypes.ProtocolOptions;
  }

  export interface PairParams {
    topic: string;
    symKey: string;
    relay: RelayerTypes.ProtocolOptions;
  }
}

export abstract class IPairing<
  Config = PairingTypes.Config,
  Settled = PairingTypes.Settled,
  CreateParams = PairingTypes.CreateParams,
  PairParams = PairingTypes.PairParams
> extends IEvents {
  // stored pairings
  public abstract store: IStore<Settled>;
  // jsonrpc history
  public abstract history: IJsonRpcHistory;
  // pairing expiry
  public abstract expirer: IExpirer;

  // returns settled sessions length
  public abstract readonly length: number;
  // returns settled sessions topics
  public abstract readonly topics: string[];
  // returns settled sessions values
  public abstract readonly values: Settled[];

  // controller configuration
  public abstract readonly name: string;
  public abstract readonly context: string;
  public abstract readonly config: Config;

  constructor(public client: IClient, public logger: Logger) {
    super();
  }

  // initialize with persisted state
  public abstract init(): Promise<void>;

  // get settled session state
  public abstract get(topic: string): Promise<Settled>;

  // find compatible settled session
  public abstract find(permissions: Partial<Permissions>): Promise<Settled[]>;

  // called by either to ping peer
  public abstract ping(topic: string, timeout?: number): Promise<void>;
  // called by either to send JSON-RPC
  public abstract send(topic: string, payload: JsonRpcPayload, chainId?: string): Promise<void>;

  // called by proposer to create pairing
  public abstract create(params?: CreateParams): Promise<Settled>;

  // called by responder to pair pairing
  public abstract pair(params?: PairParams): Promise<Settled>;
}
