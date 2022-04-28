import { generateChildLogger, getLoggerContext } from "@walletconnect/logger";
import { ICore, IStore, PairingTypes, ProposalTypes, SessionTypes } from "@walletconnect/types";
import { ERROR, isProposalStruct, isSessionStruct } from "@walletconnect/utils";
import { Logger } from "pino";
import { STORE_STORAGE_VERSION } from "../constants";

type StoreStruct = SessionTypes.Struct | PairingTypes.Struct | ProposalTypes.Struct;

export class Store<Key, Data extends StoreStruct> extends IStore<Key, Data> {
  public map = new Map<Key, Data>();

  public version = STORE_STORAGE_VERSION;

  private cached: Data[] = [];

  private initialized = false;

  constructor(public core: ICore, public logger: Logger, public name: string) {
    super(core, logger, name);
    this.logger = generateChildLogger(logger, this.name);
  }

  public init: IStore<Key, Data>["init"] = async () => {
    this.logger.trace(`Initialized`);
    await this.initialize();
  };

  get context(): string {
    return getLoggerContext(this.logger);
  }

  get storageKey(): string {
    return this.core.storagePrefix + this.version + "//" + this.name;
  }

  get length(): number {
    return this.map.size;
  }

  get keys(): Key[] {
    return Array.from(this.map.keys());
  }

  get values(): Data[] {
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
      const error = ERROR.NO_MATCHING_TOPIC.format({
        context: this.name,
        topic: key,
      });
      this.logger.error(error.message);
      throw new Error(error.message);
    }
    return value;
  }

  private async persist() {
    await this.setDataStore(this.values);
  }

  private async restore() {
    try {
      const persisted = await this.getDataStore();
      if (typeof persisted === "undefined") return;
      if (!persisted.length) return;
      if (this.map.size) {
        const error = ERROR.RESTORE_WILL_OVERRIDE.format({
          context: this.name,
        });
        this.logger.error(error.message);
        throw new Error(error.message);
      }
      this.cached = persisted;
      this.logger.debug(`Successfully Restored value for ${this.name}`);
      this.logger.trace({ type: "method", method: "restore", value: this.values });
    } catch (e) {
      this.logger.debug(`Failed to Restore value for ${this.name}`);
      this.logger.error(e as any);
    }
  }

  private async initialize() {
    await this.restore();
    this.reset();
    this.onInit();
  }

  private reset() {
    this.cached.forEach(value => {
      if (isProposalStruct(value)) {
        // TODO(pedro) revert type casting as any
        this.map.set(value.id as any, value);
      } else if (isSessionStruct(value)) {
        // TODO(pedro) revert type casting as any
        this.map.set(value.topic as any, value);
      }
    });
  }

  private onInit() {
    this.cached = [];
    this.initialized = true;
  }

  private isInitialized() {
    if (!this.initialized) {
      throw new Error(ERROR.GENERIC.stringify());
    }
  }
}
