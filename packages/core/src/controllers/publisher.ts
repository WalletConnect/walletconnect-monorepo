import { HEARTBEAT_EVENTS } from "@walletconnect/heartbeat";
import { RequestArguments } from "@walletconnect/jsonrpc-types";
import { generateChildLogger, getLoggerContext, Logger } from "@walletconnect/logger";
import { RelayJsonRpc } from "@walletconnect/relay-api";
import { IPublisher, IRelayer, PublisherTypes, RelayerTypes } from "@walletconnect/types";
import {
  getRelayProtocolApi,
  getRelayProtocolName,
  hashMessage,
  isUndefined,
  createExpiringPromise,
} from "@walletconnect/utils";
import { EventEmitter } from "events";

import { PUBLISHER_CONTEXT, PUBLISHER_DEFAULT_TTL, RELAYER_EVENTS } from "../constants";

export class Publisher extends IPublisher {
  public events = new EventEmitter();
  public name = PUBLISHER_CONTEXT;
  public queue = new Map<string, PublisherTypes.Params>();
  private publishTimeout = 10_000;

  constructor(public relayer: IRelayer, public logger: Logger) {
    super(relayer, logger);
    this.relayer = relayer;
    this.logger = generateChildLogger(logger, this.name);
    this.registerEventListeners();
  }

  get context() {
    return getLoggerContext(this.logger);
  }

  public publish: IPublisher["publish"] = async (topic, message, opts) => {
    this.logger.debug(`Publishing Payload`);
    this.logger.trace({ type: "method", method: "publish", params: { topic, message, opts } });
    try {
      const ttl = opts?.ttl || PUBLISHER_DEFAULT_TTL;
      const relay = getRelayProtocolName(opts);
      const prompt = opts?.prompt || false;
      const tag = opts?.tag || 0;
      const params = { topic, message, opts: { ttl, relay, prompt, tag } };
      const hash = hashMessage(message);
      this.queue.set(hash, params);
      try {
        const publish = await createExpiringPromise(
          this.rpcPublish(topic, message, ttl, relay, prompt, tag),
          this.publishTimeout,
        );
        await publish;
        this.relayer.events.emit(RELAYER_EVENTS.publish, params);
      } catch (err) {
        this.logger.debug(`Publishing Payload stalled`);
        this.relayer.events.emit(RELAYER_EVENTS.connection_stalled);
        return;
      }
      this.onPublish(hash, params);
      this.logger.debug(`Successfully Published Payload`);
      this.logger.trace({ type: "method", method: "publish", params: { topic, message, opts } });
    } catch (e) {
      this.logger.debug(`Failed to Publish Payload`);
      this.logger.error(e as any);
      throw e;
    }
  };

  public on: IPublisher["on"] = (event, listener) => {
    this.events.on(event, listener);
  };

  public once: IPublisher["once"] = (event, listener) => {
    this.events.once(event, listener);
  };

  public off: IPublisher["off"] = (event, listener) => {
    this.events.off(event, listener);
  };

  public removeListener: IPublisher["removeListener"] = (event, listener) => {
    this.events.removeListener(event, listener);
  };

  // ---------- Private ----------------------------------------------- //

  private rpcPublish(
    topic: string,
    message: string,
    ttl: number,
    relay: RelayerTypes.ProtocolOptions,
    prompt?: boolean,
    tag?: number,
  ) {
    const api = getRelayProtocolApi(relay.protocol);
    const request: RequestArguments<RelayJsonRpc.PublishParams> = {
      method: api.publish,
      params: {
        topic,
        message,
        ttl,
        prompt,
        tag,
      },
    };
    if (isUndefined(request.params?.prompt)) delete request.params?.prompt;
    if (isUndefined(request.params?.tag)) delete request.params?.tag;
    this.logger.debug(`Outgoing Relay Payload`);
    this.logger.trace({ type: "message", direction: "outgoing", request });
    return this.relayer.request(request);
  }

  private onPublish(hash: string, _params: PublisherTypes.Params) {
    this.queue.delete(hash);
  }

  private checkQueue() {
    this.queue.forEach(async (params) => {
      const { topic, message, opts } = params;
      await this.publish(topic, message, opts);
    });
  }

  private registerEventListeners() {
    this.relayer.core.heartbeat.on(HEARTBEAT_EVENTS.pulse, () => {
      this.checkQueue();
    });
  }
}
