import { generateChildLogger, getLoggerContext } from "@walletconnect/logger";
import { IClient, IStore, PairingTypes, ProposalTypes, SessionTypes } from "@walletconnect/types";
import {
  ERROR,
  formatMessageContext,
  formatStorageKeyName,
  isProposalStruct,
  isSessionStruct,
} from "@walletconnect/utils";
import { Logger } from "pino";
import { STORE_STORAGE_VERSION } from "../constants";

type StoreStruct = SessionTypes.Struct | PairingTypes.Struct | ProposalTypes.Struct;

export class Store<Data extends StoreStruct> extends IStore<Data> {
  public data = new Map<string, Data>();

  public version = STORE_STORAGE_VERSION;

  private cached: Data[] = [];

  constructor(public client: IClient, public logger: Logger, public name: string) {
    super(client, logger, name);
    this.logger = generateChildLogger(logger, this.name);
  }

  public init: IStore<Data>["init"] = async () => {
    this.logger.trace(`Initialized`);
    await this.initialize();
  };

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

  public set: IStore<Data>["set"] = async (topic, data) => {
    if (this.data.has(topic)) {
      this.update(topic, data);
    } else {
      this.logger.debug(`Setting data`);
      this.logger.trace({ type: "method", method: "set", topic, data });
      this.data.set(topic, data);
      this.persist();
    }
  };

  public get: IStore<Data>["get"] = async topic => {
    this.logger.debug(`Getting data`);
    this.logger.trace({ type: "method", method: "get", topic });
    const data = await this.getData(topic);
    return data;
  };

  public update: IStore<Data>["update"] = async (topic, update) => {
    this.logger.debug(`Updating data`);
    this.logger.trace({ type: "method", method: "update", topic, update });
    const data = { ...(await this.getData(topic)), ...update };
    this.data.set(topic, data);
    this.persist();
  };

  public delete: IStore<Data>["delete"] = async (topic, reason) => {
    if (!this.data.has(topic)) return;
    this.logger.debug(`Deleting data`);
    this.logger.trace({ type: "method", method: "delete", topic, reason });
    this.data.delete(topic);
    this.persist();
  };

  // ---------- Private ----------------------------------------------- //

  private async setDataStore(data: Data[]): Promise<void> {
    await this.client.storage.setItem<Data[]>(this.storageKey, data);
  }

  private async getDataStore(): Promise<Data[] | undefined> {
    const data = await this.client.storage.getItem<Data[]>(this.storageKey);
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
    this.cached.forEach(data => {
      if (isProposalStruct(data)) {
        this.data.set(data.proposer.publicKey, data);
      } else if (isSessionStruct(data)) {
        this.data.set(data.topic, data);
      }
    });
  }

  private onInit() {
    this.cached = [];
  }
}
