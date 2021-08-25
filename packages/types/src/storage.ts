import { IKeyValueStorage } from "keyvaluestorage";
import { Logger } from "pino";

import { IClient } from "./client";
import { JsonRpcRecord } from "./history";
import { SubscriptionParams } from "./subscription";

export type StorageKeyMap = Record<string, Record<string, string>>;

export abstract class IStorage {
  public abstract version: string;
  public abstract keyMap: StorageKeyMap;

  public abstract prefix: string;

  constructor(public client: IClient, public keyValueStorage: IKeyValueStorage) {
    this.client = client;
    this.keyValueStorage = keyValueStorage;
  }

  public abstract setKeyChain(logger: Logger, keychain: Map<string, string>): Promise<void>;
  public abstract getKeyChain(logger: Logger): Promise<Map<string, string> | undefined>;

  public abstract setSequenceState<Sequence = any>(
    logger: Logger,
    sequences: Sequence[],
  ): Promise<void>;
  public abstract getSequenceState<Sequence = any>(logger: Logger): Promise<Sequence[] | undefined>;

  public abstract setJsonRpcRecords(logger: Logger, records: JsonRpcRecord[]): Promise<void>;
  public abstract getJsonRpcRecords(logger: Logger): Promise<JsonRpcRecord[] | undefined>;

  public abstract setRelayerSubscriptions(
    logger: Logger,
    subscriptions: SubscriptionParams[],
  ): Promise<void>;
  public abstract getRelayerSubscriptions(
    logger: Logger,
  ): Promise<SubscriptionParams[] | undefined>;

  public abstract getStorageKeyName(logger: Logger): string;
  public abstract isValidStorageKeyName(name: string): boolean;
}
