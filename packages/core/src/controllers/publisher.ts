import { HEARTBEAT_EVENTS } from "@walletconnect/heartbeat";
import { JsonRpcPayload, RequestArguments } from "@walletconnect/jsonrpc-types";
import { generateChildLogger, getLoggerContext, Logger } from "@walletconnect/logger";
import { RelayJsonRpc } from "@walletconnect/relay-api";
import { IPublisher, IRelayer, PublisherTypes } from "@walletconnect/types";
import {
  getRelayProtocolApi,
  getRelayProtocolName,
  isUndefined,
  createExpiringPromise,
} from "@walletconnect/utils";
import { EventEmitter } from "events";

import { PUBLISHER_CONTEXT, PUBLISHER_DEFAULT_TTL, RELAYER_EVENTS } from "../constants";
import { getBigIntRpcId } from "@walletconnect/jsonrpc-utils";
import { ONE_MINUTE, ONE_SECOND, toMiliseconds } from "@walletconnect/time";

type IPublishType = PublisherTypes.Params & {
  attestation?: string;
  attempt: number;
};
export class Publisher extends IPublisher {
  public events = new EventEmitter();
  public name = PUBLISHER_CONTEXT;
  public queue = new Map<string, IPublishType>();

  private publishTimeout = toMiliseconds(ONE_MINUTE);
  private initialPublishTimeout = toMiliseconds(ONE_SECOND * 15);
  private needsTransportRestart = false;

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

    const ttl = opts?.ttl || PUBLISHER_DEFAULT_TTL;
    const relay = getRelayProtocolName(opts);
    const prompt = opts?.prompt || false;
    const tag = opts?.tag || 0;
    const id = opts?.id || (getBigIntRpcId().toString() as any);
    const params = {
      topic,
      message,
      opts: {
        ttl,
        relay,
        prompt,
        tag,
        id,
        attestation: opts?.attestation,
      },
    };
    const failedPublishMessage = `Failed to publish payload, please try again. id:${id} tag:${tag}`;

    try {
      /**
       * attempt to publish the payload for <initialPublishTimeout> seconds,
       * if the publish fails, add the payload to the queue and it will be retried on every pulse
       * until it is successfully published or <publishTimeout> seconds have passed
       */
      const publishPromise = new Promise(async (resolve) => {
        const onPublish = ({ id }: { id: string }) => {
          if (params.opts.id === id) {
            this.removeRequestFromQueue(id);
            this.relayer.events.removeListener(RELAYER_EVENTS.publish, onPublish);
            resolve(params);
          }
        };
        this.relayer.events.on(RELAYER_EVENTS.publish, onPublish);
        const initialPublish = createExpiringPromise(
          new Promise((resolve, reject) => {
            this.rpcPublish({
              topic,
              message,
              ttl,
              prompt,
              tag,
              id,
              attestation: opts?.attestation,
            })
              .then(resolve)
              .catch((e) => {
                this.logger.warn(e, e?.message);
                reject(e);
              });
          }),
          this.initialPublishTimeout,
          `Failed initial publish, retrying.... id:${id} tag:${tag}`,
        );
        try {
          await initialPublish;
          this.events.removeListener(RELAYER_EVENTS.publish, onPublish);
        } catch (e) {
          this.queue.set(id, { ...params, attempt: 1 });
          this.logger.warn(e, (e as Error)?.message);
        }
      });
      this.logger.trace({
        type: "method",
        method: "publish",
        params: { id, topic, message, opts },
      });

      await createExpiringPromise(publishPromise, this.publishTimeout, failedPublishMessage);
    } catch (e) {
      this.logger.debug(`Failed to Publish Payload`);
      this.logger.error(e as any);
      if (opts?.internal?.throwOnFailedPublish) {
        throw e;
      }
    } finally {
      this.queue.delete(id);
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

  private async rpcPublish(params: {
    topic: string;
    message: string;
    ttl?: number;
    prompt?: boolean;
    tag?: number;
    id?: number;
    attestation?: string;
  }) {
    const { topic, message, ttl = PUBLISHER_DEFAULT_TTL, prompt, tag, id, attestation } = params;
    const api = getRelayProtocolApi(getRelayProtocolName().protocol);
    const request: RequestArguments<RelayJsonRpc.PublishParams> = {
      method: api.publish,
      params: {
        topic,
        message,
        ttl,
        prompt,
        tag,
        attestation,
      },
      id,
    };
    if (isUndefined(request.params?.prompt)) delete request.params?.prompt;
    if (isUndefined(request.params?.tag)) delete request.params?.tag;
    this.logger.debug(`Outgoing Relay Payload`);
    this.logger.trace({ type: "message", direction: "outgoing", request });
    const result = await this.relayer.request(request);
    this.relayer.events.emit(RELAYER_EVENTS.publish, params);
    this.logger.debug(`Successfully Published Payload`);
    return result;
  }

  private removeRequestFromQueue(id: string) {
    this.queue.delete(id);
  }

  private checkQueue() {
    this.queue.forEach(async (params, id) => {
      const attempt = params.attempt + 1;
      this.queue.set(id, { ...params, attempt });
      const { topic, message, opts, attestation } = params;
      this.logger.warn(
        {},
        `Publisher: queue->publishing: ${params.opts.id}, tag: ${params.opts.tag}, attempt: ${attempt}`,
      );
      await this.rpcPublish({
        topic,
        message,
        ttl: opts.ttl,
        prompt: opts.prompt,
        tag: opts.tag,
        id: opts.id,
        attestation,
      });
      this.logger.warn({}, `Publisher: queue->published: ${params.opts.id}`);
    });
  }

  private registerEventListeners() {
    this.relayer.core.heartbeat.on(HEARTBEAT_EVENTS.pulse, () => {
      // restart the transport if needed
      // queue will be processed on the next pulse
      if (this.needsTransportRestart) {
        this.needsTransportRestart = false;
        this.relayer.events.emit(RELAYER_EVENTS.connection_stalled);
        return;
      }
      this.checkQueue();
    });
    this.relayer.on(RELAYER_EVENTS.message_ack, (event: JsonRpcPayload) => {
      this.removeRequestFromQueue(event.id.toString());
    });
  }
}
