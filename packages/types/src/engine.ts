import { JsonRpcPayload } from "@walletconnect/jsonrpc-types";
import { ClientTypes } from "./client";
import { ICrypto } from "./crypto";
import { IPairing } from "./pairing";
import { IProposal } from "./proposal";
import { IRelayer, RelayerTypes } from "./relayer";
import { ISession, SessionTypes } from "./session";

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

  type CreatePairingParams = RelayerTypes.ProtocolOptions;

  interface CreateSessionParams {
    relays: RelayerTypes.ProtocolOptions[];
    metadata: ClientTypes.Metadata;
    pairingTopic?: string;
    methods?: SessionTypes.Methods;
    chains?: SessionTypes.Chains;
    events?: SessionTypes.Events;
  }

  type CreateSessionReturn = Promise<{ uri: string; approval: Promise<void> }>;
}

export abstract class IEngine {
  constructor(
    public relayer: IRelayer,
    public crypto: ICrypto,
    public session: ISession,
    public pairing: IPairing,
    public proposal: IProposal,
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
