import { Logger } from "pino";
import { IKeyValueStorage } from "keyvaluestorage";
import { generateChildLogger, getLoggerContext } from "@walletconnect/logger";
import {
  IClient,
  IStorage,
  JsonRpcRecord,
  StorageKeyMap,
  SubscriptionParams,
} from "@walletconnect/types";
import { ERROR, mapToObj, objToMap, formatStorageKeyName } from "@walletconnect/utils";

import { STORAGE_CONTEXT, STORAGE_KEYS, STORAGE_VERSION } from "../constants";

export class Storage implements IStorage {
  public name: string = STORAGE_CONTEXT;

  public version = STORAGE_VERSION;

  public keyMap: StorageKeyMap = STORAGE_KEYS;

  constructor(
    public client: IClient,
    public logger: Logger,
    public keyValueStorage: IKeyValueStorage,
  ) {
    this.client = client;
    this.logger = generateChildLogger(logger, this.name);
    this.keyValueStorage = keyValueStorage;
  }

  get context(): string {
    return getLoggerContext(this.logger);
  }

  get prefix() {
    return `${this.client.protocol}@${this.client.version}:${this.client.context}:${this.version}`;
  }

  public async setKeyChain(context: string, keychain: Map<string, string>): Promise<void> {
    const key = this.getStorageKey(context);
    await this.keyValueStorage.setItem<Record<string, string>>(key, mapToObj(keychain));
  }

  public async getKeyChain(context: string): Promise<Map<string, string> | undefined> {
    const key = this.getStorageKey(context);
    const keychain = await this.keyValueStorage.getItem<Record<string, string>>(key);
    return typeof keychain !== "undefined" ? objToMap(keychain) : undefined;
  }

  public async setSequenceState<Sequence = any>(
    context: string,
    sequences: Sequence[],
  ): Promise<void> {
    const key = this.getStorageKey(context);
    await this.keyValueStorage.setItem<Sequence[]>(key, sequences);
  }

  public async getSequenceState<Sequence = any>(context: string): Promise<Sequence[] | undefined> {
    const key = this.getStorageKey(context);
    const sequences = await this.keyValueStorage.getItem<Sequence[]>(key);
    return sequences;
  }

  public async setJsonRpcRecords(context: string, records: JsonRpcRecord[]): Promise<void> {
    const key = this.getStorageKey(context);
    await this.keyValueStorage.setItem<JsonRpcRecord[]>(key, records);
  }

  public async getJsonRpcRecords(context: string): Promise<JsonRpcRecord[] | undefined> {
    const key = this.getStorageKey(context);
    const records = await this.keyValueStorage.getItem<JsonRpcRecord[]>(key);
    return records;
  }

  public async setRelayerSubscriptions(
    context: string,
    subscriptions: SubscriptionParams[],
  ): Promise<void> {
    const key = this.getStorageKey(context);
    await this.keyValueStorage.setItem<SubscriptionParams[]>(key, subscriptions);
  }

  public async getRelayerSubscriptions(context: string): Promise<SubscriptionParams[] | undefined> {
    const key = this.getStorageKey(context);
    const subscriptions = await this.keyValueStorage.getItem<SubscriptionParams[]>(key);
    return subscriptions;
  }

  public getStorageKey(context: string): string {
    const name = this.getStorageKeyName(context);
    if (!this.isValidStorageKeyName(name)) {
      const error = ERROR.INVALID_STORAGE_KEY_NAME.format({ name });
      throw new Error(error.message);
    }
    const key = this.prefix + "//" + name;
    return key;
  }

  public getStorageKeyName(context: string): string {
    return formatStorageKeyName(context);
  }

  public isValidStorageKeyName(name: string): boolean {
    const validKeys = Object.keys(this.keyMap)
      .map(key => Object.values(this.keyMap[key]))
      .flat();
    return validKeys.includes(name.toLowerCase());
  }
}
