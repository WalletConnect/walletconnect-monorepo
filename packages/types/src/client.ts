import { IEvents } from "@walletconnect/events";
import { IHeartBeat } from "@walletconnect/heartbeat";
import { IKeyValueStorage, KeyValueStorageOptions } from "keyvaluestorage";
import { Logger } from "pino";
import { ICrypto, IKeyChain } from "./crypto";
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

export abstract class IClient extends IEvents {
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

  constructor(public opts?: ClientOptions) {
    super();
  }
}
