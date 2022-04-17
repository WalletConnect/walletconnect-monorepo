import { IEvents } from "@walletconnect/events";
import { IHeartBeat } from "@walletconnect/heartbeat";
import { IKeyValueStorage, KeyValueStorageOptions } from "keyvaluestorage";
import { Logger } from "pino";
import { ICrypto, IKeyChain } from "./crypto";
import { IEngine } from "./engine";
import { IPairing } from "./pairing";
import { IProposal } from "./proposal";
import { IRelayer } from "./relayer";
import { ISession } from "./session";
import { IJsonRpcHistory } from "./history";

export declare namespace ClientTypes {
  type Metadata = {
    name: string;
    description: string;
    url: string;
    icons: string[];
  };

  type Options = Partial<{
    projectId: string;
    name: string;
    relayUrl: string;
    logger: string | Logger;
    keychain: IKeyChain;
    metadata?: Metadata;
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
  public abstract readonly metadata: ClientTypes.Metadata;
  public abstract readonly relayUrl?: string;
  public abstract readonly projectId?: string;

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
  public abstract history: IJsonRpcHistory;

  constructor(public opts?: ClientTypes.Options) {}

  public abstract on: IEvents["on"];
  public abstract once: IEvents["once"];
  public abstract off: IEvents["off"];
  public abstract removeListener: IEvents["removeListener"];

  public abstract connect: IEngine["createSession"];
  public abstract pair: IEngine["pair"];
  public abstract approve: IEngine["approve"];
  public abstract reject: IEngine["reject"];
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
