import { HEARTBEAT_EVENTS } from "@walletconnect/heartbeat";
import { RequestArguments } from "@walletconnect/jsonrpc-types";
import { generateChildLogger, getLoggerContext } from "@walletconnect/logger";
import { RelayJsonRpc } from "@walletconnect/relay-api";
import { IPublisher, IRelayer, PublisherTypes, RelayerTypes } from "@walletconnect/types";
import { getRelayProtocolApi, getRelayProtocolName, sha256 } from "@walletconnect/utils";
import { EventEmitter } from "events";
import { Logger } from "pino";
import { PUBLISHER_CONTEXT, PUBLISHER_DEFAULT_TTL } from "../constants";

export class Publisher extends IPublisher {
  public events = new EventEmitter();

  public name: string = PUBLISHER_CONTEXT;

  public queue = new Map<string, PublisherTypes.Params>();

  constructor(public relayer: IRelayer, public logger: Logger) {
    super(relayer, logger);
    this.relayer = relayer;
    this.logger = generateChildLogger(logger, this.name);
    this.registerEventListeners();
  }

  get context(): string {
    return getLoggerContext(this.logger);
  }

  public async init(): Promise<void> {
    this.logger.trace(`Initialized`);
    await this.initialize();
  }

  public async publish(
    topic: string,
    message: string,
    opts?: RelayerTypes.PublishOptions,
  ): Promise<void> {
    this.logger.debug(`Publishing Payload`);
    this.logger.trace({ type: "method", method: "publish", params: { topic, message, opts } });
    try {
      const ttl = opts?.ttl || PUBLISHER_DEFAULT_TTL;
      const relay = getRelayProtocolName(opts);
      const prompt = opts?.prompt || false;
      const params = { topic, message, opts: { ttl, relay, prompt } };
      const hash = await sha256(message);
      this.queue.set(hash, params);
      await this.rpcPublish(topic, message, ttl, relay, prompt);
      await this.onPublish(hash, params);
      this.logger.debug(`Successfully Published Payload`);
      this.logger.trace({ type: "method", method: "publish", params: { topic, message, opts } });
    } catch (e) {
      this.logger.debug(`Failed to Publish Payload`);
      this.logger.error(e as any);
      throw e;
    }
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

  private async initialize() {
    // if needed
  }

  private async rpcPublish(
    topic: string,
    message: string,
    ttl: number,
    relay: RelayerTypes.ProtocolOptions,
    prompt?: boolean,
  ): Promise<void> {
    const api = getRelayProtocolApi(relay.protocol);
    const request: RequestArguments<RelayJsonRpc.PublishParams> = {
      method: api.publish,
      params: {
        topic,
        message,
        ttl,
        prompt,
      },
    };
    if (typeof request.params?.prompt === "undefined") {
      delete request.params?.prompt;
    }
    this.logger.debug(`Outgoing Relay Payload`);
    this.logger.trace({ type: "message", direction: "outgoing", request });
    return this.relayer.provider.request(request);
  }

  private async onPublish(hash: string, params: PublisherTypes.Params) {
    // const { topic, message } = params;
    // await this.relayer.recordPayloadEvent({ topic, message });
    this.queue.delete(hash);
  }

  private checkQueue(): void {
    this.queue.forEach(async params => {
      const {
        topic,
        message,
        opts: { ttl, relay },
      } = params;
      const hash = await sha256(message);
      await this.rpcPublish(topic, message, ttl, relay);
      await this.onPublish(hash, params);
    });
  }

  private registerEventListeners(): void {
    this.relayer.heartbeat.on(HEARTBEAT_EVENTS.pulse, () => {
      this.checkQueue();
    });
  }
}
