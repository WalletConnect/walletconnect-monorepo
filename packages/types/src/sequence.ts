import { Logger } from "pino";
import { JsonRpcPayload, IEvents } from "@json-rpc-tools/types";

import { IClient } from "./client";
import { CryptoTypes } from "./crypto";
import { ISubscription, SubscriptionEvent } from "./subscription";
import { IJsonRpcHistory } from "./history";

export abstract class ISequence<
  Pending,
  Settled,
  Upgrade,
  Update,
  CreateParams,
  RespondParams,
  RequestParams,
  UpgradeParams,
  UpdateParams,
  DeleteParams,
  ProposeParams,
  SettleParams
> extends IEvents {
  // pending subscriptions
  public abstract pending: ISubscription<Pending>;
  // settled subscriptions
  public abstract settled: ISubscription<Settled>;
  // jsonrpc history
  public abstract history: IJsonRpcHistory;

  // returns settled subscriptions length
  public abstract readonly length: number;
  // returns settled subscriptions topics
  public abstract readonly topics: string[];
  // returns settled subscriptions values
  public abstract readonly values: Settled[];

  // describes sequence context
  protected abstract context: string;

  constructor(public client: IClient, public logger: Logger) {
    super();
  }

  // initialize with persisted state
  public abstract init(): Promise<void>;

  // get settled subscription data
  public abstract get(topic: string): Promise<Settled>;
  // called by either to ping peer
  public abstract ping(topic: string, timeout?: number): Promise<void>;
  // send JSON-RPC to settled subscription
  public abstract send(topic: string, payload: JsonRpcPayload): Promise<void>;

  // called by proposer
  public abstract create(params?: CreateParams): Promise<Settled>;
  // called by responder
  public abstract respond(params: RespondParams): Promise<Pending>;

  // called by proposer to request JSON-RPC
  public abstract request(params: RequestParams): Promise<any>;
  // called by responder to upgrade permissions
  public abstract upgrade(params: UpgradeParams): Promise<Settled>;

  // called by either to update state
  public abstract update(params: UpdateParams): Promise<Settled>;
  // called by either to terminate
  public abstract delete(params: DeleteParams): Promise<void>;

  // ---------- Protected ----------------------------------------------- //

  // called by proposer (internally)
  protected abstract propose(params?: ProposeParams): Promise<Pending>;
  // called by both (internally)
  protected abstract settle(params: SettleParams): Promise<Settled>;

  // callback for proposed subscriptions payloads
  protected abstract onResponse(payloadEvent: SubscriptionEvent.Payload): Promise<void>;
  // callback for responded subscriptions payloads
  protected abstract onAcknowledge(payloadEvent: SubscriptionEvent.Payload): Promise<void>;
  // callback for settled subscriptions payloads
  protected abstract onMessage(payloadEvent: SubscriptionEvent.Payload): Promise<void>;
  // callback for incoming JSON-RPC payloads
  protected abstract onPayload(payloadEvent: SubscriptionEvent.Payload): Promise<void>;
  // callback for state update payloads
  protected abstract onUpdate(payloadEvent: SubscriptionEvent.Payload): Promise<void>;
  // callback for permission upgrade payloads
  protected abstract onUpgrade(payloadEvent: SubscriptionEvent.Payload): Promise<void>;
  // validates and processes state udpates
  protected abstract handleUpdate(
    settled: Settled,
    params: UpdateParams,
    participant: CryptoTypes.Participant,
  ): Promise<Update>;
  protected abstract handleUpgrade(
    settled: Settled,
    params: UpgradeParams,
    participant: CryptoTypes.Participant,
  ): Promise<Upgrade>;
}
