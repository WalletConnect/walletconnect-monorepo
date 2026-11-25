import { isEqual } from "es-toolkit/compat";
import { generateChildLogger, getLoggerContext, Logger } from "@walletconnect/logger";
import { ICore, IStore } from "@walletconnect/types";
import {
  getInternalError,
  isProposalStruct,
  isSessionStruct,
  isUndefined,
} from "@walletconnect/utils";
import { CORE_STORAGE_PREFIX, STORE_STORAGE_VERSION } from "../constants/index.js";

export class Store<Key, Data extends Record<string, any>> extends IStore<Key, Data> {
  public map = new Map<Key, Data>();
  public version = STORE_STORAGE_VERSION;

  private cached: Data[] = [];
  private initialized = false;
  private disposed = false;
  private readonly pending = new Set<Promise<unknown>>();

  /**
   * Regenerates the value key to retrieve it from cache
   */
  private getKey: ((data: Data) => Key) | undefined;

  private storagePrefix = CORE_STORAGE_PREFIX;

  // stores recently deleted key to return different rejection message when key is not found
  private recentlyDeleted: Key[] = [];
  private recentlyDeletedLimit = 200;

  /**
   * @param {ICore} core Core
   * @param {Logger} logger Logger
   * @param {string} name Store's name
   * @param {Store<Key, Data>["getKey"]} getKey Regenerates the value key to retrieve it from cache
   * @param {string} storagePrefix Prefixes value keys
   */
  constructor(
    public core: ICore,
    public logger: Logger,
    public name: string,
    storagePrefix: string = CORE_STORAGE_PREFIX,
    getKey: Store<Key, Data>["getKey"] = undefined,
  ) {
    super(core, logger, name, storagePrefix);
    this.logger = generateChildLogger(logger, this.name);
    this.storagePrefix = storagePrefix;
    this.getKey = getKey;
  }

  public init: IStore<Key, Data>["init"] = async () => {
    this.assertActive();
    if (!this.initialized) {
      this.logger.trace(`Initialized`);

      await this.restore();
      this.assertActive();

      this.cached.forEach((value) => {
        if (this.getKey && value !== null && !isUndefined(value)) {
          this.map.set(this.getKey(value), value);
        } else if (isProposalStruct(value)) {
          // TODO(pedro) revert type casting as any
          this.map.set(value.id as any, value);
        } else if (isSessionStruct(value)) {
          // TODO(pedro) revert type casting as any
          this.map.set(value.topic as any, value);
        }
      });

      this.cached = [];
      this.initialized = true;
    }
  };

  public async dispose(): Promise<void> {
    this.disposed = true;
    await Promise.allSettled(this.pending);
    this.map.clear();
    this.cached = [];
  }

  private assertActive() {
    this.core.assertActive();
    if (this.disposed) throw new Error(`WalletConnect ${this.name} store is disposed`);
  }

  get context() {
    return getLoggerContext(this.logger);
  }

  get storageKey() {
    return this.storagePrefix + this.version + this.core.customStoragePrefix + "//" + this.name;
  }

  get length() {
    return this.map.size;
  }

  get keys() {
    return Array.from(this.map.keys());
  }

  get values() {
    return Array.from(this.map.values());
  }

  public set: IStore<Key, Data>["set"] = async (key, value) => {
    this.isInitialized();
    if (this.map.has(key)) {
      await this.update(key, value);
    } else {
      this.logger.debug(`Setting value`);
      this.logger.trace({ type: "method", method: "set", key, value });
      this.map.set(key, value);
      await this.persist();
    }
  };

  public get: IStore<Key, Data>["get"] = (key) => {
    this.isInitialized();
    this.logger.debug(`Getting value`);
    this.logger.trace({ type: "method", method: "get", key });
    const value = this.getData(key);
    return value;
  };

  public getAll: IStore<Key, Data>["getAll"] = (filter) => {
    this.isInitialized();
    if (!filter) return this.values;

    return this.values.filter((value) =>
      Object.keys(filter).every((key) => isEqual(value[key], filter[key])),
    );
  };

  public update: IStore<Key, Data>["update"] = async (key, update) => {
    this.isInitialized();
    this.logger.debug(`Updating value`);
    this.logger.trace({ type: "method", method: "update", key, update });
    const value = { ...this.getData(key), ...update };
    this.map.set(key, value);
    await this.persist();
  };

  public delete: IStore<Key, Data>["delete"] = async (key, reason) => {
    this.isInitialized();
    if (!this.map.has(key)) return;
    this.logger.debug(`Deleting value`);
    this.logger.trace({ type: "method", method: "delete", key, reason });
    this.map.delete(key);
    this.addToRecentlyDeleted(key);
    await this.persist();
  };

  // ---------- Private ----------------------------------------------- //

  private addToRecentlyDeleted(key: Key) {
    this.recentlyDeleted.push(key);
    // limit the size of the recentlyDeleted array, truncate the 100 oldest entries.
    if (this.recentlyDeleted.length >= this.recentlyDeletedLimit) {
      this.recentlyDeleted.splice(0, this.recentlyDeletedLimit / 2);
    }
  }

  private async setDataStore(value: Data[]) {
    await this.core.run(() => this.core.storage.setItem<Data[]>(this.storageKey, value));
  }

  private async getDataStore() {
    const value = await this.core.run(() => this.core.storage.getItem<Data[]>(this.storageKey));
    return value;
  }

  private getData(key: Key) {
    const value = this.map.get(key);
    if (!value) {
      if (this.recentlyDeleted.includes(key)) {
        const { message } = getInternalError(
          "MISSING_OR_INVALID",
          `Record was recently deleted - ${this.name}: ${key}`,
        );
        this.logger.error(message);
        throw new Error(message);
      }

      const { message } = getInternalError("NO_MATCHING_KEY", `${this.name}: ${key}`);
      this.logger.error(message);
      throw new Error(message);
    }
    return value;
  }

  private async persist() {
    this.assertActive();
    const pending = this.setDataStore(this.values);
    this.pending.add(pending);
    try {
      await pending;
      this.assertActive();
    } finally {
      this.pending.delete(pending);
    }
  }

  private async restore() {
    try {
      const persisted = await this.getDataStore();
      this.assertActive();
      if (typeof persisted === "undefined") return;
      if (!persisted.length) return;
      if (this.map.size) {
        const { message } = getInternalError("RESTORE_WILL_OVERRIDE", this.name);
        this.logger.error(message);
        throw new Error(message);
      }
      this.cached = persisted;
      this.logger.debug(`Successfully Restored value for ${this.name}`);
      this.logger.trace({ type: "method", method: "restore", value: this.values });
    } catch (e) {
      this.logger.debug(`Failed to Restore value for ${this.name}`);
      this.logger.error(e as any);
    }
  }

  private isInitialized() {
    this.assertActive();
    if (!this.initialized) {
      const { message } = getInternalError("NOT_INITIALIZED", this.name);
      throw new Error(message);
    }
  }
}
