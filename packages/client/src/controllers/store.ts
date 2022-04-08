import { generateChildLogger, getLoggerContext } from "@walletconnect/logger";
import { IClient, IStore, PairingTypes, Reason, SessionTypes } from "@walletconnect/types";
import { ERROR, formatMessageContext, formatStorageKeyName } from "@walletconnect/utils";
import { Logger } from "pino";
import { STORE_STORAGE_VERSION } from "../constants";

export class Store<Data = SessionTypes.Data | PairingTypes.Data> extends IStore<Data> {
  public data = new Map<string, Data>();
  public version: string = STORE_STORAGE_VERSION;

  private cached: Data[] = [];

  constructor(public client: IClient, public logger: Logger, public name: string) {
    super(client, logger, name);
    this.logger = generateChildLogger(logger, this.name);
  }

  public async init(): Promise<void> {
    this.logger.trace(`Initialized`);
    await this.initialize();
  }

  get context(): string {
    return getLoggerContext(this.logger);
  }

  get storageKey(): string {
    return this.client.storagePrefix + this.version + "//" + formatStorageKeyName(this.context);
  }

  get length(): number {
    return this.data.size;
  }

  get topics(): string[] {
    return Array.from(this.data.keys());
  }

  get values(): Data[] {
    return Array.from(this.data.values());
  }

  public async set(topic: string, data: Data): Promise<void> {
    if (this.data.has(topic)) {
      this.update(topic, data);
    } else {
      this.logger.debug(`Setting data`);
      this.logger.trace({ type: "method", method: "set", topic, data });
      this.data.set(topic, data);
      this.persist();
    }
  }

  public async get(topic: string): Promise<Data> {
    this.logger.debug(`Getting data`);
    this.logger.trace({ type: "method", method: "get", topic });
    const data = await this.getData(topic);
    return data;
  }

  public async update(topic: string, update: Partial<Data>): Promise<void> {
    this.logger.debug(`Updating data`);
    this.logger.trace({ type: "method", method: "update", topic, update });
    const data = { ...(await this.getData(topic)), ...update };
    this.data.set(topic, data);
    this.persist();
  }

  public async delete(topic: string, reason: Reason): Promise<void> {
    if (!this.data.has(topic)) return;
    this.logger.debug(`Deleting data`);
    this.logger.trace({ type: "method", method: "delete", topic, reason });
    const data = await this.getData(topic);
    this.data.delete(topic);
    this.persist();
  }

  // ---------- Private ----------------------------------------------- //

  private async setDataStore(data: Data[]): Promise<void> {
    await this.client.keyValueStorage.setItem<Data[]>(this.storageKey, data);
  }

  private async getDataStore(): Promise<Data[] | undefined> {
    const data = await this.client.keyValueStorage.getItem<Data[]>(this.storageKey);
    return data;
  }

  private async getData(topic: string): Promise<Data> {
    const data = this.data.get(topic);
    if (!data) {
      const error = ERROR.NO_MATCHING_TOPIC.format({
        context: formatMessageContext(this.context),
        topic,
      });
      this.logger.error(error.message);
      throw new Error(error.message);
    }
    return data;
  }

  private async persist() {
    await this.setDataStore(this.values);
  }

  private async restore() {
    try {
      const persisted = await this.getDataStore();
      if (typeof persisted === "undefined") return;
      if (!persisted.length) return;
      if (this.data.size) {
        const error = ERROR.RESTORE_WILL_OVERRIDE.format({
          context: formatMessageContext(this.context),
        });
        this.logger.error(error.message);
        throw new Error(error.message);
      }
      this.cached = persisted;
      this.logger.debug(`Successfully Restored data for ${formatMessageContext(this.context)}`);
      this.logger.trace({ type: "method", method: "restore", data: this.values });
    } catch (e) {
      this.logger.debug(`Failed to Restore data for ${formatMessageContext(this.context)}`);
      this.logger.error(e as any);
    }
  }

  private async initialize() {
    await this.restore();
    this.reset();
    this.onInit();
  }

  private reset() {
    this.cached.forEach(data => this.data.set(data.topic, data));
  }

  private onInit() {
    this.cached = [];
  }
}
