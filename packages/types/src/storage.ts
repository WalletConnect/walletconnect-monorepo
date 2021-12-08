import { Logger } from "pino";
import { IKeyValueStorage } from "keyvaluestorage";

import { JsonRpcRecord } from "./history";
import { SubscriptionActive } from "./subscription";

export type StorageKeyMap = Record<string, Record<string, string>>;

export type Storage = IClientStorage | IRelayerStorage;

export interface StorageConfig {
  protocol: string;
  version: number;
  context: string;
}

export abstract class IBaseStorage {
  public abstract name: string;

  public abstract readonly context: string;

  public abstract version: string;

  public abstract keyMap: StorageKeyMap;

  public abstract prefix: string;

  constructor(
    public logger: Logger,
    public keyValueStorage: IKeyValueStorage,
    public config: StorageConfig,
  ) {}

  public abstract getStorageKey(context: string): string;
  public abstract getStorageKeyName(context: string): string;
  public abstract isValidStorageKeyName(name: string): boolean;
}

export abstract class IRelayerStorage extends IBaseStorage {
  constructor(
    public logger: Logger,
    public keyValueStorage: IKeyValueStorage,
    public config: StorageConfig,
  ) {
    super(logger, keyValueStorage, config);
  }

  public abstract setJsonRpcRecords(context: string, records: JsonRpcRecord[]): Promise<void>;
  public abstract getJsonRpcRecords(context: string): Promise<JsonRpcRecord[] | undefined>;

  public abstract setRelayerSubscriptions(
    context: string,
    subscriptions: SubscriptionActive[],
  ): Promise<void>;
  public abstract getRelayerSubscriptions(
    context: string,
  ): Promise<SubscriptionActive[] | undefined>;
}

export abstract class IClientStorage extends IRelayerStorage {
  constructor(
    public logger: Logger,
    public keyValueStorage: IKeyValueStorage,
    public config: StorageConfig,
  ) {
    super(logger, keyValueStorage, config);
  }

  public abstract setKeyChain(context: string, keychain: Map<string, string>): Promise<void>;
  public abstract getKeyChain(context: string): Promise<Map<string, string> | undefined>;

  public abstract setSequenceStore<Sequence = any>(
    context: string,
    sequences: Sequence[],
  ): Promise<void>;
  public abstract getSequenceStore<Sequence = any>(
    context: string,
  ): Promise<Sequence[] | undefined>;
}
