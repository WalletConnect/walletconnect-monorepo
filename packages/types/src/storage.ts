import { Logger } from "pino";
import { IKeyValueStorage } from "keyvaluestorage";

import { IClient } from "./client";
import { JsonRpcRecord } from "./history";
import { SubscriptionParams } from "./subscription";

export type StorageKeyMap = Record<string, Record<string, string>>;

export abstract class IStorage {
  public abstract name: string;

  public abstract readonly context: string;

  public abstract version: string;

  public abstract keyMap: StorageKeyMap;

  public abstract prefix: string;

  constructor(
    public client: IClient,
    public logger: Logger,
    public keyValueStorage: IKeyValueStorage,
  ) {
    this.client = client;
    this.keyValueStorage = keyValueStorage;
  }

  public abstract setKeyChain(context: string, keychain: Map<string, string>): Promise<void>;
  public abstract getKeyChain(context: string): Promise<Map<string, string> | undefined>;

  public abstract setSequenceState<Sequence = any>(
    context: string,
    sequences: Sequence[],
  ): Promise<void>;
  public abstract getSequenceState<Sequence = any>(
    context: string,
  ): Promise<Sequence[] | undefined>;

  public abstract setJsonRpcRecords(context: string, records: JsonRpcRecord[]): Promise<void>;
  public abstract getJsonRpcRecords(context: string): Promise<JsonRpcRecord[] | undefined>;

  public abstract setRelayerSubscriptions(
    context: string,
    subscriptions: SubscriptionParams[],
  ): Promise<void>;
  public abstract getRelayerSubscriptions(
    context: string,
  ): Promise<SubscriptionParams[] | undefined>;

  public abstract getStorageKey(context: string): string;
  public abstract getStorageKeyName(context: string): string;
  public abstract isValidStorageKeyName(name: string): boolean;
}
