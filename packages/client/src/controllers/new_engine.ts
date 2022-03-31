import { formatJsonRpcRequest } from "@walletconnect/jsonrpc-utils";
import { ONE_DAY } from "@walletconnect/time";
import {
  ICrypto,
  IExpirer,
  IPairing,
  IRelayer,
  ISequence,
  SequenceTypes,
  StoreEvent,
} from "@walletconnect/types";
import {
  calcExpiry,
  isSequenceFailed,
  isSequenceResponded,
  isSignalTypePairing,
  isStoreUpdatedEvent,
} from "@walletconnect/utils";
import { EventEmitter } from "events";
import { Logger } from "pino";
import { STORE_EVENTS } from "../constants";

export default class Engine {
  private relayer: IRelayer;
  private expirer: IExpirer;
  private logger: Logger;
  private crypto: ICrypto;
  private events: EventEmitter;
  private pairing: IPairing;

  constructor(public sequence: ISequence) {
    this.expirer = sequence.expirer;
    this.logger = sequence.logger;
    this.relayer = sequence.client.relayer;
    this.crypto = sequence.client.crypto;
    this.events = sequence.client.events;
    this.pairing = sequence.client.pairing;
    this.subscribeToPendingEvents();
    this.subscribeToSettledEvents();
  }

  /**
   * Event subscriptions
   */
  private subscribeToPendingEvents() {
    this.sequence.pending.on(
      STORE_EVENTS.created,
      async (event: StoreEvent.Created<SequenceTypes.Pending>) => {
        await this.onPendingCreatedEvent(event);
        await this.onPendingCreatedOrUpdatedEvent(event);
      },
    );

    this.sequence.pending.on(
      STORE_EVENTS.updated,
      async (event: StoreEvent.Updated<SequenceTypes.Pending>) =>
        await this.onPendingCreatedOrUpdatedEvent(event),
    );

    this.sequence.pending.on(
      STORE_EVENTS.deleted,
      async (event: StoreEvent.Deleted<SequenceTypes.Pending>) => {
        const { topic, relay } = event.sequence;
        await this.relayer.unsubscribe(topic, { relay });
        await this.expirer.del(topic);
      },
    );
  }

  private subscribeToSettledEvents() {}

  /**
   * Event listener handlers
   */
  private async onPendingCreatedEvent(event: StoreEvent.Created<SequenceTypes.Pending>) {
    const { topic, sequence } = event;
    const expiry = calcExpiry(ONE_DAY);
    await this.relayer.subscribe(topic, { relay: sequence.relay });
    await this.expirer.set(topic, { topic, expiry });
  }

  private async onPendingCreatedOrUpdatedEvent(
    event: StoreEvent.Created<SequenceTypes.Pending> | StoreEvent.Updated<SequenceTypes.Pending>,
  ) {
    const { sequence: eventSequence } = event;
    const { signal, topic: proposalTopic } = eventSequence.proposal;

    if (isSignalTypePairing(signal)) {
      const topicHasKeys = await this.crypto.hasKeys(proposalTopic);
      if (!topicHasKeys) {
        const { self, peer } = await this.pairing.settled.get(signal.params.topic);
        await this.crypto.generateSharedKey(self, peer, proposalTopic);
      }
    }

    if (isSequenceResponded(eventSequence)) {
      const eventName = this.sequence.config.events.responded;
      this.events.emit(eventName, eventSequence);

      if (!isStoreUpdatedEvent(event)) {
        const { topic: sequenceTopic, outcome, relay } = eventSequence;
        let method: string;
        let params: SequenceTypes.Response;

        if (isSequenceFailed(outcome)) {
          method = this.sequence.config.jsonrpc.reject;
          params = {
            reason: outcome.reason,
          };
        } else {
          method = this.sequence.config.jsonrpc.approve;
          params = {
            relay: outcome.relay,
            responder: outcome.responder,
            expiry: outcome.expiry,
            state: outcome.state,
          };
        }

        const request = formatJsonRpcRequest(method, params);
        const message = await this.sequence.client.crypto.encode(sequenceTopic, request);
        await this.relayer.publish(sequenceTopic, message, { relay });
      }
    } else {
      const eventName = this.sequence.config.events.proposed;
      this.sequence.events.emit(eventName, eventSequence);

      if (isSignalTypePairing(signal)) {
        const request = formatJsonRpcRequest(
          this.sequence.config.jsonrpc.propose,
          eventSequence.proposal,
        );
        await this.pairing.send(signal.params.topic, request);
      }
    }
  }
}
