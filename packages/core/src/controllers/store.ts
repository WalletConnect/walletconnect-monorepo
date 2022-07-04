import { generateChildLogger, getLoggerContext } from "@walletconnect/logger";
import { ICore, IStore, PairingTypes, ProposalTypes, SessionTypes } from "@walletconnect/types";
import { getInternalError, isProposalStruct, isSessionStruct } from "@walletconnect/utils";
import { Logger } from "pino";
import { CORE_STORAGE_PREFIX, STORE_STORAGE_VERSION } from "../constants";
import isEqual from "lodash.isequal";

type StoreStruct = SessionTypes.Struct | PairingTypes.Struct | ProposalTypes.Struct;

export class Store<Key, Data extends StoreStruct> extends IStore<Key, Data> {
  public map = new Map<Key, Data>();
  public version = STORE_STORAGE_VERSION;

  private cached: Data[] = [];
  private initialized = false;

  private storagePrefix = CORE_STORAGE_PREFIX;

  constructor(
    public core: ICore,
    public logger: Logger,
    public name: string,
    storagePrefix = CORE_STORAGE_PREFIX,
  ) {
    super(core, logger, name, storagePrefix);
    this.logger = generateChildLogger(logger, this.name);
    this.storagePrefix = storagePrefix;
  }

  public init: IStore<Key, Data>["init"] = async () => {
    if (!this.initialized) {
      this.logger.trace(`Initialized`);

      await this.restore();

      this.cached.forEach(value => {
        if (isProposalStruct(value)) {
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

  get context() {
    return getLoggerContext(this.logger);
  }

  get storageKey(): string {
    return this.storagePrefix + this.version + "//" + this.name;
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

  public get: IStore<Key, Data>["get"] = key => {
    this.isInitialized();
    this.logger.debug(`Getting value`);
    this.logger.trace({ type: "method", method: "get", key });
    const value = this.getData(key);
    return value;
  };

  public getAll: IStore<Key, Data>["getAll"] = filter => {
    if (!filter) return this.values;

    return this.values.filter(value =>
      Object.keys(filter).every(key => isEqual(value[key], filter[key])),
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
    await this.persist();
  };

  // ---------- Private ----------------------------------------------- //

  private async setDataStore(value: Data[]) {
    await this.core.storage.setItem<Data[]>(this.storageKey, value);
  }

  private async getDataStore() {
    const value = await this.core.storage.getItem<Data[]>(this.storageKey);
    return value;
  }

  private getData(key: Key) {
    const value = this.map.get(key);
    if (!value) {
      const { message } = getInternalError("NO_MATCHING_KEY", `${this.name}: ${key}`);
      this.logger.error(message);
      throw new Error(message);
    }
    return value;
  }

  private async persist() {
    await this.setDataStore(this.values);
    this.core.events.emit(`${this.context}_sync`, { values: this.values });
  }

  private async restore() {
    try {
      const persisted = await this.getDataStore();
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
    if (!this.initialized) {
      const { message } = getInternalError("NOT_INITIALIZED", this.name);
      throw new Error(message);
    }
  }
}
