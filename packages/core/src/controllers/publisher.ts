import { EventEmitter } from "events";
import { HEARTBEAT_EVENTS } from "@walletconnect/heartbeat";
import { JsonRpcPayload, RequestArguments } from "@walletconnect/jsonrpc-types";
import { generateChildLogger, getLoggerContext, Logger } from "@walletconnect/logger";
import { RelayJsonRpc } from "@walletconnect/relay-api";
import { IPublisher, IRelayer, RelayerTypes } from "@walletconnect/types";
import {
  getRelayProtocolApi,
  getRelayProtocolName,
  isUndefined,
  createExpiringPromise,
} from "@walletconnect/utils";
import { getBigIntRpcId } from "@walletconnect/jsonrpc-utils";
import { FIVE_MINUTES, ONE_MINUTE, ONE_SECOND, toMiliseconds } from "@walletconnect/time";

import { PUBLISHER_CONTEXT, PUBLISHER_DEFAULT_TTL, RELAYER_EVENTS } from "../constants/index.js";

type IPublishType = {
  attestation?: string;
  attempt: number;
  request: RequestArguments;
  opts?: RelayerTypes.PublishOptions;
};

export class Publisher extends IPublisher {
  public events = new EventEmitter();
  public name = PUBLISHER_CONTEXT;
  public queue = new Map<string, IPublishType>();

  private publishTimeout = toMiliseconds(ONE_MINUTE);
  private initialPublishTimeout = toMiliseconds(ONE_SECOND * 15);
  private needsTransportRestart = false;

  constructor(
    public relayer: IRelayer,
    public logger: Logger,
  ) {
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
    const prompt = opts?.prompt || false;
    const tag = opts?.tag || 0;
    const id = opts?.id || (getBigIntRpcId().toString() as any);

    const api = getRelayProtocolApi(getRelayProtocolName().protocol);

    const request: RequestArguments<RelayJsonRpc.PublishParams> = {
      id,
      method: opts?.publishMethod || api.publish,
      params: {
        topic,
        message,
        ttl,
        prompt,
        tag,
        attestation: opts?.attestation,
        ...opts?.tvf,
      },
    };

    const failedPublishMessage = `Failed to publish payload, please try again. id:${id} tag:${tag}`;
    try {
      if (isUndefined(request.params?.prompt)) delete request.params?.prompt;
      if (isUndefined(request.params?.tag)) delete request.params?.tag;

      /**
       * attempt to publish the payload for <initialPublishTimeout> seconds,
       * if the publish fails, add the payload to the queue and it will be retried on every pulse
       * until it is successfully published or <publishTimeout> seconds have passed
       */
      const publishPromise = new Promise<void>(async (resolve) => {
        const onPublish = ({ id }: { id: string }) => {
          if (request.id?.toString() === id.toString()) {
            this.removeRequestFromQueue(id);
            this.relayer.events.removeListener(RELAYER_EVENTS.publish, onPublish);
            resolve();
          }
        };
        this.relayer.events.on(RELAYER_EVENTS.publish, onPublish);
        const initialPublish = createExpiringPromise(
          new Promise((resolve, reject) => {
            this.rpcPublish(request, opts)
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
          this.queue.set(id, { request, opts, attempt: 1 });
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

  public publishCustom: IPublisher["publishCustom"] = async (params) => {
    this.logger.debug(`Publishing custom payload`);
    this.logger.trace({ type: "method", method: "publishCustom", params });

    const { payload, opts = {} } = params;
    const { attestation, tvf, publishMethod, prompt, tag, ttl = FIVE_MINUTES } = opts;

    const id = opts.id || (getBigIntRpcId().toString() as any);
    const api = getRelayProtocolApi(getRelayProtocolName().protocol);
    const method = publishMethod || api.publish;
    const request: RequestArguments<RelayJsonRpc.PublishParams> = {
      id,
      method,
      params: {
        ...payload,
        ttl,
        prompt,
        tag,
        attestation,
        ...tvf,
      },
    };
    const failedPublishMessage = `Failed to publish custom payload, please try again. id:${id} tag:${tag}`;
    try {
      if (isUndefined(request.params?.prompt)) delete request.params?.prompt;
      if (isUndefined(request.params?.tag)) delete request.params?.tag;

      /**
       * attempt to publish the payload for <initialPublishTimeout> seconds,
       * if the publish fails, add the payload to the queue and it will be retried on every pulse
       * until it is successfully published or <publishTimeout> seconds have passed
       */
      const publishPromise = new Promise<void>(async (resolve) => {
        const onPublish = ({ id }: { id: string }) => {
          if (request.id?.toString() === id.toString()) {
            this.removeRequestFromQueue(id);
            this.relayer.events.removeListener(RELAYER_EVENTS.publish, onPublish);
            resolve();
          }
        };
        this.relayer.events.on(RELAYER_EVENTS.publish, onPublish);
        const initialPublish = createExpiringPromise(
          new Promise((resolve, reject) => {
            this.rpcPublish(request, opts)
              .then(resolve)
              .catch((e) => {
                this.logger.warn(e, e?.message);
                reject(e);
              });
          }),
          this.initialPublishTimeout,
          `Failed initial custom payload publish, retrying.... method:${method} id:${id} tag:${tag}`,
        );
        try {
          await initialPublish;
          this.events.removeListener(RELAYER_EVENTS.publish, onPublish);
        } catch (e) {
          this.queue.set(id, { request, opts, attempt: 1 });
          this.logger.warn(e, (e as Error)?.message);
        }
      });
      this.logger.trace({
        type: "method",
        method: "publish",
        params: { id, payload, opts },
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

  private async rpcPublish(request: RequestArguments, opts?: RelayerTypes.PublishOptions) {
    this.logger.debug(`Outgoing Relay Payload`);
    this.logger.trace({ type: "message", direction: "outgoing", request });
    const result = await this.relayer.request(request);

    this.relayer.events.emit(RELAYER_EVENTS.publish, { ...request, ...opts });
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
      this.logger.warn(
        {},
        `Publisher: queue->publishing: ${params.request.id}, tag: ${params.request.params?.tag}, attempt: ${attempt}`,
      );
      await this.rpcPublish(params.request, params.opts);
      this.logger.warn({}, `Publisher: queue->published: ${params.request.id}`);
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
