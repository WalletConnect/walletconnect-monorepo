import { JsonRpcPayload } from "@walletconnect/jsonrpc-types";
import { ClientTypes } from "./client";
import { ICrypto } from "./crypto";
import { IPairing } from "./pairing";
import { IProposal } from "./proposal";
import { IRelayer, RelayerTypes } from "./relayer";
import { ISession, SessionTypes } from "./session";
import { JsonRpc } from "./jsonrpc";
import { IJsonRpcHistory } from "./history";

export declare namespace EngineTypes {
  interface UriParameters {
    protocol: string;
    version: number;
    topic: string;
    symKey: string;
    relay: RelayerTypes.ProtocolOptions;
  }

  interface DecodedRelayEvent {
    topic: string;
    payload: JsonRpcPayload<string, unknown>;
  }

  interface CreateSessionParams {
    pairingTopic?: string;
    methods?: SessionTypes.Methods;
    chains?: SessionTypes.Chains;
    events?: SessionTypes.Events;
    relays?: RelayerTypes.ProtocolOptions[];
  }

  type CreateSessionReturn = Promise<{ uri?: string; approval: Promise<void> }>;
}

// -- private method interface -------------------------------------- //

export interface EnginePrivate {
  sendRequest<M extends JsonRpc.WcMethod>(
    topic: string,
    method: M,
    params: JsonRpc.RequestParams[M],
  ): Promise<void>;

  sendResponse(topic: string): Promise<void>;
}

// -- class interface ----------------------------------------------- //

export abstract class IEngine {
  constructor(
    public history: IJsonRpcHistory,
    public protocol: string,
    public version: number,
    public relayer: IRelayer,
    public crypto: ICrypto,
    public session: ISession,
    public pairing: IPairing,
    public proposal: IProposal,
    public metadata: ClientTypes.Metadata,
  ) {}

  public abstract createSession(
    params: EngineTypes.CreateSessionParams,
  ): EngineTypes.CreateSessionReturn;

  public abstract pair(pairingUri: string): Promise<void>;
  public abstract approve(): Promise<void>;
  public abstract reject(): Promise<void>;
  public abstract request(): Promise<void>;
  public abstract respond(): Promise<void>;
  public abstract ping(): Promise<void>;
  public abstract disconnect(): Promise<void>;
  public abstract emit(): Promise<void>;
  public abstract updateAccounts(): Promise<void>;
  public abstract updateMethods(): Promise<void>;
  public abstract updateEvents(): Promise<void>;
  public abstract updateExpiry(): Promise<void>;
}
