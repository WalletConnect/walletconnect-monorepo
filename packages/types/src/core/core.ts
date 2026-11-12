import { IEvents } from "@walletconnect/events";
import { IHeartBeat } from "@walletconnect/heartbeat";
import { IKeyValueStorage, KeyValueStorageOptions } from "@walletconnect/keyvaluestorage";
import { Logger } from "@walletconnect/logger";

import { ICrypto } from "./crypto.js";
import { IRelayer } from "./relayer.js";
import { IKeyChain } from "./keychain.js";
import { IJsonRpcHistory } from "./history.js";
import { IExpirer } from "./expirer.js";
import { IPairing } from "./pairing.js";
import { IVerify } from "./verify.js";
import { IEchoClient } from "./echo.js";
import { IEventClient } from "./events.js";
export declare namespace CoreTypes {
  interface Options {
    projectId?: string;
    name?: string;
    relayUrl?: string;
    logger?: string | Logger;
    keychain?: IKeyChain;
    storage?: IKeyValueStorage;
    storageOptions?: KeyValueStorageOptions;
    maxLogBlobSizeInBytes?: number;
    customStoragePrefix?: string;
    telemetryEnabled?: boolean;
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
      linkMode?: boolean;
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
  public abstract readonly customStoragePrefix: string;
  /** Terminal lifetime shared by this Core and its controllers. */
  public abstract readonly signal: AbortSignal;

  public abstract logger: Logger;
  public abstract heartbeat: IHeartBeat;
  public abstract crypto: ICrypto;
  public abstract relayer: IRelayer;
  public abstract storage: IKeyValueStorage;
  public abstract history: IJsonRpcHistory;
  public abstract expirer: IExpirer;
  public abstract pairing: IPairing;
  public abstract verify: IVerify;
  public abstract echoClient: IEchoClient;
  public abstract linkModeSupportedApps: string[];
  public abstract eventClient: IEventClient;

  constructor(public opts?: CoreTypes.Options) {
    super();
  }

  public abstract start(): Promise<void>;
  /** Terminal shutdown. The owner must first detach clients sharing this Core. */
  public abstract dispose(): Promise<void>;
  /** @internal Reject work after terminal shutdown. */
  public abstract assertActive(): void;
  /** @internal Track admitted asynchronous controller work through shutdown. */
  public abstract run<T>(operation: () => Promise<T>): Promise<T>;
  public abstract dispatchEnvelope(params: {
    topic: string;
    message: string;
    sessionExists: boolean;
  }): void;

  public abstract addLinkModeSupportedApp(universalLink: string): Promise<void>;
}
