import { JsonRpcPayload } from "@walletconnect/jsonrpc-types";
import { ClientTypes } from "./client";
import { ICrypto } from "./crypto";
import { IPairing } from "./pairing";
import { IRelayer, RelayerTypes } from "./relayer";
import { ISession, SessionTypes } from "./session";

export declare namespace EngineTypes {
  interface UriParameters {
    version: number;
    topic: string;
    symKey: string;
    relayProtocol: string;
    relayData?: string;
  }

  interface DecodedRelayEvent {
    topic: string;
    payload: JsonRpcPayload<string, unknown>;
  }

  type CreatePairingParams = RelayerTypes.ProtocolOptions;

  interface CreateSessionParams {
    relay: RelayerTypes.ProtocolOptions;
    pairingTopic?: string;
    expiry?: number;
    permissions?: SessionTypes.Permissions;
    metadata?: ClientTypes.Metadata;
  }
}

export abstract class IEngine {
  constructor( private relayer: IRelayer,
    private crypto: ICrypto,
    private session: ISession,
    private pairing: IPairing) {}

  public abstract createSession(params: EngineTypes.CreateSessionParams): Promise<void>;
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
