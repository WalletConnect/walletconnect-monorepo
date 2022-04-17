import { generateChildLogger, getLoggerContext } from "@walletconnect/logger";
import { IClient, IKeyChain } from "@walletconnect/types";
import { ERROR, formatStorageKeyName, mapToObj, objToMap } from "@walletconnect/utils";
import { Logger } from "pino";
import { KEYCHAIN_CONTEXT, KEYCHAIN_STORAGE_VERSION } from "../constants";

export class KeyChain implements IKeyChain {
  public keychain = new Map<string, string>();

  public name = KEYCHAIN_CONTEXT;

  public version = KEYCHAIN_STORAGE_VERSION;

  constructor(public client: IClient, public logger: Logger) {
    this.client = client;
    this.logger = generateChildLogger(logger, this.name);
  }

  get context() {
    return getLoggerContext(this.logger);
  }

  get storageKey() {
    return this.client.storagePrefix + this.version + "//" + formatStorageKeyName(this.context);
  }

  public init: IKeyChain["init"] = async () => {
    await this.restore();
  };

  public has: IKeyChain["has"] = async tag => {
    return this.keychain.has(tag);
  };

  public set: IKeyChain["set"] = async (tag, key) => {
    this.keychain.set(tag, key);
    await this.persist();
  };

  public get: IKeyChain["get"] = async tag => {
    const key = this.keychain.get(tag);
    if (typeof key === "undefined") {
      throw new Error(ERROR.NO_MATCHING_KEY.format({ tag }).message);
    }
    return key;
  };

  public del: IKeyChain["del"] = async tag => {
    this.keychain.delete(tag);
    await this.persist();
  };

  // ---------- Private ----------------------------------------------- //

  private async setKeyChain(keychain: Map<string, string>) {
    await this.client.storage.setItem<Record<string, string>>(this.storageKey, mapToObj(keychain));
  }

  private async getKeyChain() {
    const keychain = await this.client.storage.getItem<Record<string, string>>(this.storageKey);
    return typeof keychain !== "undefined" ? objToMap(keychain) : undefined;
  }

  private async restore() {
    const keychain = await this.getKeyChain();
    if (typeof keychain !== "undefined") {
      this.keychain = keychain;
    }
  }

  private async persist() {
    await this.setKeyChain(this.keychain);
  }
}
