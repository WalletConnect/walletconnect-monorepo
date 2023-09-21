import { IEvents } from "@walletconnect/events";
import { IHeartBeat } from "@walletconnect/heartbeat";
import { IKeyValueStorage, KeyValueStorageOptions } from "@walletconnect/keyvaluestorage";

import { ICrypto } from "./crypto";
import { IRelayer } from "./relayer";
import { IKeyChain } from "./keychain";
import { IJsonRpcHistory } from "./history";
import { IExpirer } from "./expirer";
import { IPairing } from "./pairing";
import { Logger } from "@walletconnect/logger";
import { IVerify } from "./verify";
export declare namespace CoreTypes {
  interface Options {
    projectId?: string;
    name?: string;
    relayUrl?: string;
    logger?: string | Logger;
    keychain?: IKeyChain;
    storage?: IKeyValueStorage;
    storageOptions?: KeyValueStorageOptions;
    customStoragePrefix?: string;
  }

  interface Metadata {
    name: string;
    description: string;
    url: string;
    icons: string[];
    verifyUrl?: string;
    redirect?: {
      native?: string;
      universal?: string;
    };
  }
}

export abstract class ICore extends IEvents {
  public readonly protocol = "wc";
  public readonly version = 2;

  public abstract readonly name: string;
  public abstract readonly context: string;
  public abstract readonly relayUrl?: string;
  public abstract readonly projectId?: string;
  public abstract readonly customStoragePrefix?: string;

  public abstract logger: Logger;
  public abstract heartbeat: IHeartBeat;
  public abstract crypto: ICrypto;
  public abstract relayer: IRelayer;
  public abstract storage: IKeyValueStorage;
  public abstract history: IJsonRpcHistory;
  public abstract expirer: IExpirer;
  public abstract pairing: IPairing;
  public abstract verify: IVerify;

  constructor(public opts?: CoreTypes.Options) {
    super();
  }

  public abstract start(): Promise<void>;
}
