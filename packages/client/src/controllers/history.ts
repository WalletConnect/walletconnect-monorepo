import { EventEmitter } from "events";
import { Logger } from "pino";
import { IClient, IJsonRpcHistory, JsonRpcRecord } from "@walletconnect/types";
import { isJsonRpcError, JsonRpcRequest, JsonRpcResponse } from "@json-rpc-tools/utils";
import { generateChildLogger, getLoggerContext } from "@pedrouid/pino-utils";

import { HISTORY_CONTEXT, HISTORY_EVENTS } from "../constants";

export class JsonRpcHistory extends IJsonRpcHistory {
  public records = new Map<number, JsonRpcRecord>();

  public events = new EventEmitter();

  public context: string = HISTORY_CONTEXT;

  private cached: JsonRpcRecord[] = [];

  constructor(public client: IClient, public logger: Logger) {
    super(client, logger);
    this.client;
    this.logger = generateChildLogger(logger, this.context);
    this.registerEventListeners();
  }

  public async init(): Promise<void> {
    this.logger.trace(`Initialized`);
    await this.restore();
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

  public async set(topic: string, request: JsonRpcRequest, chainId?: string): Promise<void> {
    await this.isEnabled();
    this.logger.debug(`Setting JSON-RPC request history record`);
    this.logger.trace({ type: "method", method: "set", topic, request, chainId });
    if (this.records.has(request.id)) {
      const errorMessage = `Record already exists for ${this.getHistoryContext()} matching id: ${
        request.id
      }`;
      this.logger.error(errorMessage);
      throw new Error(errorMessage);
    }
    const record: JsonRpcRecord = {
      id: request.id,
      topic,
      request: { method: request.method, params: request.params || null },
      chainId,
    };
    this.records.set(record.id, record);
    this.events.emit(HISTORY_EVENTS.created, record);
  }

  public async update(topic: string, response: JsonRpcResponse): Promise<void> {
    await this.isEnabled();
    this.logger.debug(`Updating JSON-RPC response history record`);
    this.logger.trace({ type: "method", method: "update", topic, response });
    if (!this.records.has(response.id)) return;
    const record = await this.getRecord(response.id);
    if (record.topic !== topic) return;
    if (typeof record.response !== "undefined") return;
    record.response = isJsonRpcError(response)
      ? { error: response.error }
      : { result: response.result };
    this.records.set(record.id, record);
    this.events.emit(HISTORY_EVENTS.updated, record);
  }

  public async get(topic: string, id: number): Promise<JsonRpcRecord> {
    await this.isEnabled();
    this.logger.debug(`Getting record`);
    this.logger.trace({ type: "method", method: "get", topic, id });
    const record = await this.getRecord(id);
    if (record.topic !== topic) {
      const errorMessage = `Mismatched topic for ${this.getHistoryContext()} with id: ${id}`;
      this.logger.error(errorMessage);
      throw new Error(errorMessage);
    }
    return record;
  }

  public async delete(topic: string, id?: number): Promise<void> {
    await this.isEnabled();
    this.logger.debug(`Deleting record`);
    this.logger.trace({ type: "method", method: "delete", id });
    this.values.forEach((record: JsonRpcRecord) => {
      if (record.topic === topic) {
        if (typeof id !== "undefined" && record.id !== id) return;
        this.records.delete(record.id);
        this.events.emit(HISTORY_EVENTS.deleted, record);
      }
    });
  }

  public async exists(topic: string, id: number): Promise<boolean> {
    await this.isEnabled();
    if (!this.records.has(id)) return false;
    const record = await this.getRecord(id);
    return record.topic === topic;
  }

  public on(event: string, listener: any): void {
    this.events.on(event, listener);
  }

  public once(event: string, listener: any): void {
    this.events.once(event, listener);
  }

  public off(event: string, listener: any): void {
    this.events.off(event, listener);
  }

  public removeListener(event: string, listener: any): void {
    this.events.removeListener(event, listener);
  }

  // ---------- Private ----------------------------------------------- //

  private getNestedContext(length: number) {
    const nestedContext = getLoggerContext(this.logger).split("/");
    return nestedContext.slice(nestedContext.length - length, nestedContext.length);
  }

  private getHistoryContext() {
    return this.getNestedContext(2).join(" ");
  }

  private getStorageKey() {
    const storageKeyPrefix = `${this.client.protocol}@${this.client.version}:${this.client.context}`;
    const recordContext = this.getNestedContext(2).join(":");
    return `${storageKeyPrefix}//${recordContext}`;
  }

  private async getRecord(id: number): Promise<JsonRpcRecord> {
    await this.isEnabled();
    const record = this.records.get(id);
    if (!record) {
      const errorMessage = `No matching ${this.getHistoryContext()} with id: ${id}`;
      this.logger.error(errorMessage);
      throw new Error(errorMessage);
    }
    return record;
  }

  private async persist() {
    await this.client.storage.setItem<JsonRpcRecord[]>(this.getStorageKey(), this.values);
  }

  private async restore() {
    try {
      const persisted = await this.client.storage.getItem<JsonRpcRecord[]>(this.getStorageKey());
      if (typeof persisted === "undefined") return;
      if (!persisted.length) return;
      if (this.records.size) {
        const errorMessage = `Restore will override already set ${this.getHistoryContext()}`;
        this.logger.error(errorMessage);
        throw new Error(errorMessage);
      }
      this.cached = persisted;
      await Promise.all(
        this.cached.map(async record => {
          this.records.set(record.id, record);
        }),
      );
      await this.enable();
      this.logger.debug(`Successfully Restored records for ${this.getHistoryContext()}`);
      this.logger.trace({ type: "method", method: "restore", records: this.values });
    } catch (e) {
      this.logger.debug(`Failed to Restore records for ${this.getHistoryContext()}`);
      this.logger.error(e);
    }
  }

  private async reset(): Promise<void> {
    await this.disable();
    await Promise.all(
      this.cached.map(async record => {
        this.records.set(record.id, record);
      }),
    );
    await this.enable();
  }

  private async isEnabled(): Promise<void> {
    if (!this.cached.length) return;
    return new Promise(resolve => {
      this.events.once("enabled", () => resolve());
    });
  }

  private async enable(): Promise<void> {
    this.cached = [];
    this.events.emit("enabled");
  }

  private async disable(): Promise<void> {
    if (!this.cached.length) {
      this.cached = this.values;
    }
    this.events.emit("disabled");
  }

  private registerEventListeners(): void {
    this.events.on(HISTORY_EVENTS.created, (record: JsonRpcRecord) => {
      this.logger.info(`Emitting ${HISTORY_EVENTS.created}`);
      this.logger.debug({ type: "event", event: HISTORY_EVENTS.created, record });
      this.persist();
    });
    this.events.on(HISTORY_EVENTS.updated, (record: JsonRpcRecord) => {
      this.logger.info(`Emitting ${HISTORY_EVENTS.updated}`);
      this.logger.debug({ type: "event", event: HISTORY_EVENTS.updated, record });
      this.persist();
    });

    this.events.on(HISTORY_EVENTS.deleted, (record: JsonRpcRecord) => {
      this.logger.info(`Emitting ${HISTORY_EVENTS.deleted}`);
      this.logger.debug({ type: "event", event: HISTORY_EVENTS.deleted, record });
      this.persist();
    });
  }
}
