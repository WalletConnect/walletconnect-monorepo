import { generateChildLogger, getLoggerContext, Logger } from "@walletconnect/logger";
import { ICore, IKeyChain } from "@walletconnect/types";
import { getInternalError, mapToObj, objToMap } from "@walletconnect/utils";

import {
  CORE_STORAGE_PREFIX,
  KEYCHAIN_CONTEXT,
  KEYCHAIN_STORAGE_VERSION,
} from "../constants/index.js";

export class KeyChain implements IKeyChain {
  public keychain = new Map<string, string>();
  public name = KEYCHAIN_CONTEXT;
  public version = KEYCHAIN_STORAGE_VERSION;

  private initialized = false;
  private storagePrefix = CORE_STORAGE_PREFIX;

  constructor(
    public core: ICore,
    public logger: Logger,
  ) {
    this.core = core;
    this.logger = generateChildLogger(logger, this.name);
  }

  public init: IKeyChain["init"] = async () => {
    if (!this.initialized) {
      const keychain = await this.getKeyChain();
      if (typeof keychain !== "undefined") {
        this.keychain = keychain;
      }
      this.initialized = true;
    }
  };

  get context() {
    return getLoggerContext(this.logger);
  }

  get storageKey() {
    return this.storagePrefix + this.version + this.core.customStoragePrefix + "//" + this.name;
  }

  public has: IKeyChain["has"] = (tag) => {
    this.isInitialized();
    return this.keychain.has(tag);
  };

  public set: IKeyChain["set"] = async (tag, key) => {
    this.isInitialized();
    this.keychain.set(tag, key);
    await this.persist();
  };

  public get: IKeyChain["get"] = (tag) => {
    this.isInitialized();
    const key = this.keychain.get(tag);
    if (typeof key === "undefined") {
      const { message } = getInternalError("NO_MATCHING_KEY", `${this.name}: ${tag}`);
      throw new Error(message);
    }
    return key;
  };

  public del: IKeyChain["del"] = async (tag) => {
    this.isInitialized();
    this.keychain.delete(tag);
    await this.persist();
  };

  // ---------- Private ----------------------------------------------- //

  private async setKeyChain(keychain: Map<string, string>) {
    await this.core.storage.setItem<Record<string, string>>(this.storageKey, mapToObj(keychain));
  }

  private async getKeyChain() {
    const keychain = await this.core.storage.getItem<Record<string, string>>(this.storageKey);
    return typeof keychain !== "undefined" ? objToMap(keychain) : undefined;
  }

  private async persist() {
    await this.setKeyChain(this.keychain);
  }

  private isInitialized() {
    if (!this.initialized) {
      const { message } = getInternalError("NOT_INITIALIZED", this.name);
      throw new Error(message);
    }
  }
}
