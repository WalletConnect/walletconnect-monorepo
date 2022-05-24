import { Logger } from "pino";
import { IEvents } from "@walletconnect/events";
import { IHeartBeat } from "@walletconnect/heartbeat";
import { IKeyValueStorage, KeyValueStorageOptions } from "@walletconnect/keyvaluestorage";

import { ICrypto } from "./crypto";
import { IRelayer } from "./relayer";
import { IKeyChain } from "./keychain";

export declare namespace CoreTypes {
  interface Options {
    projectId?: string;
    name?: string;
    relayUrl?: string;
    logger?: string | Logger;
    keychain?: IKeyChain;
    storageOptions?: KeyValueStorageOptions;
  }
}

export abstract class ICore extends IEvents {
  public readonly protocol = "wc";
  public readonly version = 2;

  public abstract readonly name: string;
  public abstract readonly context: string;
  public abstract readonly relayUrl?: string;
  public abstract readonly projectId?: string;

  public abstract logger: Logger;
  public abstract heartbeat: IHeartBeat;
  public abstract crypto: ICrypto;
  public abstract relayer: IRelayer;
  public abstract storage: IKeyValueStorage;

  constructor(public opts?: CoreTypes.Options) {
    super();
  }

  public abstract start(): Promise<void>;
}
