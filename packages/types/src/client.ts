import { IEvents } from "@walletconnect/events";
import { IHeartBeat } from "@walletconnect/heartbeat";
import { IKeyValueStorage, KeyValueStorageOptions } from "keyvaluestorage";
import { Logger } from "pino";
import { ICrypto, IKeyChain } from "./crypto";
import { EngineTypes, IEngine } from "./engine";
import { IPairing } from "./pairing";
import { IProposal } from "./proposal";
import { IRelayer } from "./relayer";
import { ISession } from "./session";

export declare namespace ClientTypes {
  interface Metadata {
    name: string;
    description: string;
    url: string;
    icons: [string];
  }

  type Options = Partial<{
    projectId: string;
    name: string;
    metadata: Metadata;
    relayUrl: string;
    logger: string | Logger;
    keychain: IKeyChain;
    storage?: IKeyValueStorage;
    storageOptions?: KeyValueStorageOptions;
  }>;
}

export abstract class IClient {
  public readonly protocol = "wc";
  public readonly version = 2;

  public abstract readonly name: string;
  public abstract readonly context: string;
  public abstract readonly storagePrefix: string;
  public abstract readonly metadata: ClientTypes.Metadata | undefined;
  public abstract readonly relayUrl: string | undefined;
  public abstract readonly projectId: string | undefined;

  public abstract pairing: IPairing;
  public abstract session: ISession;
  public abstract proposal: IProposal;
  public abstract logger: Logger;
  public abstract heartbeat: IHeartBeat;
  public abstract crypto: ICrypto;
  public abstract relayer: IRelayer;
  public abstract storage: IKeyValueStorage;
  public abstract events: IEvents["events"];
  public abstract engine: IEngine;

  constructor(public opts?: ClientTypes.Options) {}

  public abstract on(event: string, listener: (...args: any[]) => void): void;
  public abstract once(event: string, listener: (...args: any[]) => void): void;
  public abstract off(event: string, listener: (...args: any[]) => void): void;
  public abstract removeListener(event: string, listener: (...args: any[]) => void): void;

  public abstract connect(params: EngineTypes.CreateSessionParams): EngineTypes.CreateSessionReturn;
  public abstract pair(pairingUri: string): Promise<void>;
  public abstract approve(): Promise<void>;
  public abstract reject(): Promise<void>;
  public abstract updateAccounts(): Promise<void>;
  public abstract updateMethods(): Promise<void>;
  public abstract updateEvents(): Promise<void>;
  public abstract updateExpiry(): Promise<void>;
  public abstract request(): Promise<void>;
  public abstract respond(): Promise<void>;
  public abstract ping(): Promise<void>;
  public abstract emit(): Promise<void>;
  public abstract disconnect(): Promise<void>;
}
