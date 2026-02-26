import { formatJsonRpcRequest, isJsonRpcError } from "@walletconnect/jsonrpc-utils";
import { generateChildLogger, getLoggerContext, Logger } from "@walletconnect/logger";
import { IJsonRpcHistory, JsonRpcRecord, RequestEvent, ICore } from "@walletconnect/types";
import { calcExpiry, getInternalError } from "@walletconnect/utils";
import { EventEmitter } from "events";
import { THIRTY_DAYS, toMiliseconds } from "@walletconnect/time";
import { HEARTBEAT_EVENTS } from "@walletconnect/heartbeat";
import {
  CORE_STORAGE_PREFIX,
  HISTORY_CONTEXT,
  HISTORY_EVENTS,
  HISTORY_STORAGE_VERSION,
} from "../constants/index.js";

export class JsonRpcHistory extends IJsonRpcHistory {
  public records = new Map<number, JsonRpcRecord>();
  public events = new EventEmitter();
  public name = HISTORY_CONTEXT;
  public version = HISTORY_STORAGE_VERSION;

  private cached: JsonRpcRecord[] = [];
  private initialized = false;
  private storagePrefix = CORE_STORAGE_PREFIX;

  constructor(
    public core: ICore,
    public logger: Logger,
  ) {
    super(core, logger);
    this.logger = generateChildLogger(logger, this.name);
  }

  public init: IJsonRpcHistory["init"] = async () => {
    if (!this.initialized) {
      this.logger.trace(`Initialized`);
      await this.restore();
      this.cached.forEach((record) => this.records.set(record.id, record));
      this.cached = [];
      this.registerEventListeners();
      this.initialized = true;
    }
  };

  get context(): string {
    return getLoggerContext(this.logger);
  }

  get storageKey() {
    return this.storagePrefix + this.version + this.core.customStoragePrefix + "//" + this.name;
  }

  get size(): number {
    return this.records.size;
  }

  get keys(): number[] {
    return Array.from(this.records.keys());
  }

  get values() {
    return Array.from(this.records.values());
  }

  get pending(): RequestEvent[] {
    const requests: RequestEvent[] = [];
    this.values.forEach((record) => {
      if (typeof record.response !== "undefined") return;
      const requestEvent: RequestEvent = {
        topic: record.topic,
        request: formatJsonRpcRequest(record.request.method, record.request.params, record.id),
        chainId: record.chainId,
      };
      return requests.push(requestEvent);
    });
    return requests;
  }

  public set: IJsonRpcHistory["set"] = (topic, request, chainId) => {
    this.isInitialized();
    this.logger.debug(`Setting JSON-RPC request history record`);
    this.logger.trace({ type: "method", method: "set", topic, request, chainId });
    if (this.records.has(request.id)) return;
    const record: JsonRpcRecord = {
      id: request.id,
      topic,
      request: { method: request.method, params: request.params || null },
      chainId,
      expiry: calcExpiry(THIRTY_DAYS),
    };
    this.records.set(record.id, record);
    this.persist();
    this.events.emit(HISTORY_EVENTS.created, record);
  };

  public resolve: IJsonRpcHistory["resolve"] = async (response) => {
    this.isInitialized();
    this.logger.debug(`Updating JSON-RPC response history record`);
    this.logger.trace({ type: "method", method: "update", response });
    if (!this.records.has(response.id)) return;
    const record = await this.getRecord(response.id);
    if (typeof record.response !== "undefined") return;
    record.response = isJsonRpcError(response)
      ? { error: response.error }
      : { result: response.result };
    this.records.set(record.id, record);
    this.persist();
    this.events.emit(HISTORY_EVENTS.updated, record);
  };

  public get: IJsonRpcHistory["get"] = async (topic, id) => {
    this.isInitialized();
    this.logger.debug(`Getting record`);
    this.logger.trace({ type: "method", method: "get", topic, id });
    const record = await this.getRecord(id);
    return record;
  };

  public delete: IJsonRpcHistory["delete"] = (topic, id) => {
    this.isInitialized();
    this.logger.debug(`Deleting record`);
    this.logger.trace({ type: "method", method: "delete", id });
    this.values.forEach((record: JsonRpcRecord) => {
      if (record.topic === topic) {
        if (typeof id !== "undefined" && record.id !== id) return;
        this.records.delete(record.id);
        this.events.emit(HISTORY_EVENTS.deleted, record);
      }
    });
    this.persist();
  };

  public exists: IJsonRpcHistory["exists"] = async (topic, id) => {
    this.isInitialized();
    if (!this.records.has(id)) return false;
    const record = await this.getRecord(id);
    return record.topic === topic;
  };

  public on: IJsonRpcHistory["on"] = (event, listener) => {
    this.events.on(event, listener);
  };

  public once: IJsonRpcHistory["once"] = (event, listener) => {
    this.events.once(event, listener);
  };

  public off: IJsonRpcHistory["off"] = (event, listener) => {
    this.events.off(event, listener);
  };

  public removeListener: IJsonRpcHistory["removeListener"] = (event, listener) => {
    this.events.removeListener(event, listener);
  };

  // ---------- Private ----------------------------------------------- //

  private async setJsonRpcRecords(records: JsonRpcRecord[]): Promise<void> {
    await this.core.storage.setItem<JsonRpcRecord[]>(this.storageKey, records);
  }

  private async getJsonRpcRecords(): Promise<JsonRpcRecord[] | undefined> {
    const records = await this.core.storage.getItem<JsonRpcRecord[]>(this.storageKey);
    return records;
  }

  private getRecord(id: number) {
    this.isInitialized();
    const record = this.records.get(id);
    if (!record) {
      const { message } = getInternalError("NO_MATCHING_KEY", `${this.name}: ${id}`);
      throw new Error(message);
    }
    return record;
  }

  private async persist() {
    await this.setJsonRpcRecords(this.values);
    this.events.emit(HISTORY_EVENTS.sync);
  }

  private async restore() {
    try {
      const persisted = await this.getJsonRpcRecords();
      if (typeof persisted === "undefined") return;
      if (!persisted.length) return;
      if (this.records.size) {
        const { message } = getInternalError("RESTORE_WILL_OVERRIDE", this.name);
        this.logger.error(message);
        throw new Error(message);
      }
      this.cached = persisted;
      this.logger.debug(`Successfully Restored records for ${this.name}`);
      this.logger.trace({ type: "method", method: "restore", records: this.values });
    } catch (e) {
      this.logger.debug(`Failed to Restore records for ${this.name}`);
      this.logger.error(e as any);
    }
  }

  private registerEventListeners(): void {
    this.events.on(HISTORY_EVENTS.created, (record: JsonRpcRecord) => {
      const eventName = HISTORY_EVENTS.created;
      this.logger.info(`Emitting ${eventName}`);
      this.logger.debug({ type: "event", event: eventName, record });
    });
    this.events.on(HISTORY_EVENTS.updated, (record: JsonRpcRecord) => {
      const eventName = HISTORY_EVENTS.updated;
      this.logger.info(`Emitting ${eventName}`);
      this.logger.debug({ type: "event", event: eventName, record });
    });

    this.events.on(HISTORY_EVENTS.deleted, (record: JsonRpcRecord) => {
      const eventName = HISTORY_EVENTS.deleted;
      this.logger.info(`Emitting ${eventName}`);
      this.logger.debug({ type: "event", event: eventName, record });
    });

    this.core.heartbeat.on(HEARTBEAT_EVENTS.pulse, () => {
      this.cleanup();
    });
  }

  private cleanup() {
    try {
      this.isInitialized();
      let deleted = false;
      this.records.forEach((record: JsonRpcRecord) => {
        const msToExpiry = toMiliseconds(record.expiry || 0) - Date.now();
        if (msToExpiry <= 0) {
          this.logger.info(`Deleting expired history log: ${record.id}`);
          this.records.delete(record.id);
          this.events.emit(HISTORY_EVENTS.deleted, record, false);
          deleted = true;
        }
      });
      if (deleted) {
        this.persist();
      }
    } catch (e) {
      this.logger.warn(e);
    }
  }

  private isInitialized() {
    if (!this.initialized) {
      const { message } = getInternalError("NOT_INITIALIZED", this.name);
      throw new Error(message);
    }
  }
}
