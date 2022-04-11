import { IEvents } from "@walletconnect/events";
import { IHeartBeat } from "@walletconnect/heartbeat";
import { IKeyValueStorage, KeyValueStorageOptions } from "keyvaluestorage";
import { Logger } from "pino";
import { ICrypto, IKeyChain } from "./crypto";
import { IEngine } from "./engine";
import { AppMetadata } from "./misc";
import { IPairing } from "./pairing";
import { IRelayer } from "./relayer";
import { ISession } from "./session";

export interface ClientOptions {
  name?: string;
  projectId?: string;
  controller?: boolean;
  metadata?: AppMetadata;
  relayUrl?: string;
  logger?: string | Logger;
  keychain?: IKeyChain;
  storage?: IKeyValueStorage;
  storageOptions?: KeyValueStorageOptions;
}

export abstract class IClient implements IEvents, IEngine {
  public readonly protocol = "wc";
  public readonly version = 2;

  public abstract readonly name: string;
  public abstract readonly context: string;
  public abstract readonly storagePrefix: string;
  public abstract readonly controller: boolean;
  public abstract readonly metadata: AppMetadata | undefined;
  public abstract readonly relayUrl: string | undefined;
  public abstract readonly projectId: string | undefined;

  public abstract pairing: IPairing;
  public abstract session: ISession;
  public abstract logger: Logger;
  public abstract heartbeat: IHeartBeat;
  public abstract crypto: ICrypto;
  public abstract relayer: IRelayer;
  public abstract keyValueStorage: IKeyValueStorage;
  public abstract events: IEvents["events"];

  constructor(public opts?: ClientOptions) {}

  public abstract on: IEvents["on"];
  public abstract once: IEvents["once"];
  public abstract off: IEvents["off"];
  public abstract removeListener: IEvents["removeListener"];

  public abstract createSession: IEngine["createSession"];
  public abstract pair: IEngine["pair"];
  public abstract approveSession: IEngine["approveSession"];
  public abstract rejectSession: IEngine["rejectSession"];
  public abstract updateAccounts: IEngine["updateAccounts"];
  public abstract updateMethods: IEngine["updateMethods"];
  public abstract updateEvents: IEngine["updateEvents"];
  public abstract updateExpiry: IEngine["updateExpiry"];
  public abstract request: IEngine["request"];
  public abstract respond: IEngine["respond"];
  public abstract ping: IEngine["ping"];
  public abstract emit: IEngine["emit"];
  public abstract disconnect: IEngine["disconnect"];
}
