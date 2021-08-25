import { Logger } from "pino";
import { IKeyValueStorage } from "keyvaluestorage";
import { getLoggerContext } from "@walletconnect/logger";
import {
  IClient,
  IStorage,
  JsonRpcRecord,
  StorageKeyMap,
  SubscriptionParams,
} from "@walletconnect/types";
import { ERROR, mapToObj, objToMap } from "@walletconnect/utils";

import { STORAGE_KEYS } from "../constants";

export class Storage implements IStorage {
  public version = "0.1";

  public keyMap: StorageKeyMap = STORAGE_KEYS;

  constructor(public client: IClient, public keyValueStorage: IKeyValueStorage) {
    this.client = client;
    this.keyValueStorage = keyValueStorage;
  }

  get prefix() {
    return `${this.client.protocol}@${this.client.version}:${this.client.context}:${this.version}`;
  }

  public async setKeyChain(logger: Logger, keychain: Map<string, string>): Promise<void> {
    const key = this.getStorageKey(logger);
    await this.keyValueStorage.setItem<Record<string, string>>(key, mapToObj(keychain));
  }

  public async getKeyChain(logger: Logger): Promise<Map<string, string> | undefined> {
    const key = this.getStorageKey(logger);
    const keychain = await this.keyValueStorage.getItem<Record<string, string>>(key);
    return typeof keychain !== "undefined" ? objToMap(keychain) : undefined;
  }

  public async setSequenceState<Sequence = any>(
    logger: Logger,
    sequences: Sequence[],
  ): Promise<void> {
    const key = this.getStorageKey(logger);
    await this.keyValueStorage.setItem<Sequence[]>(key, sequences);
  }

  public async getSequenceState<Sequence = any>(logger: Logger): Promise<Sequence[] | undefined> {
    const key = this.getStorageKey(logger);
    const sequences = await this.keyValueStorage.getItem<Sequence[]>(key);
    return sequences;
  }

  public async setJsonRpcRecords(logger: Logger, records: JsonRpcRecord[]): Promise<void> {
    const key = this.getStorageKey(logger);
    await this.keyValueStorage.setItem<JsonRpcRecord[]>(key, records);
  }

  public async getJsonRpcRecords(logger: Logger): Promise<JsonRpcRecord[] | undefined> {
    const key = this.getStorageKey(logger);
    const records = await this.keyValueStorage.getItem<JsonRpcRecord[]>(key);
    return records;
  }

  public async setRelayerSubscriptions(
    logger: Logger,
    subscriptions: SubscriptionParams[],
  ): Promise<void> {
    const key = this.getStorageKey(logger);
    await this.keyValueStorage.setItem<SubscriptionParams[]>(key, subscriptions);
  }

  public async getRelayerSubscriptions(logger: Logger): Promise<SubscriptionParams[] | undefined> {
    const key = this.getStorageKey(logger);
    const subscriptions = await this.keyValueStorage.getItem<SubscriptionParams[]>(key);
    return subscriptions;
  }

  public getStorageKeyName(logger: Logger): string {
    const context = getLoggerContext(logger).split("/");
    const name = context.slice(context.length - length, context.length).join(":");
    if (!this.isValidStorageKeyName(name)) {
      const error = ERROR.MISSING_OR_INVALID.format({ name: "key name" });
      throw new Error(error.message);
    }
    return name;
  }

  public isValidStorageKeyName(name: string): boolean {
    const validKeys = Object.keys(this.keyMap)
      .map(key => Object.values(this.keyMap[key]))
      .flat();
    return validKeys.includes(name.toLowerCase());
  }

  // ---------- Private ----------------------------------------------- //

  private getStorageKey(logger: Logger): string {
    const key = this.prefix + "//" + this.getStorageKeyName(logger);
    return key;
  }
}
