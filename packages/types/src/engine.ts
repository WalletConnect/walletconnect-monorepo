import { JsonRpcPayload } from "@walletconnect/jsonrpc-types";

import { ISequence, SequenceTypes } from "./sequence";
import { SubscriptionEvent } from "./subscription";

export abstract class IEngine<
  Pending = SequenceTypes.Pending,
  Settled = SequenceTypes.Settled,
  Upgrade = SequenceTypes.Upgrade,
  Update = SequenceTypes.Update,
  CreateParams = SequenceTypes.CreateParams,
  RespondParams = SequenceTypes.RespondParams,
  RequestParams = SequenceTypes.RequestParams,
  UpgradeParams = SequenceTypes.UpgradeParams,
  UpdateParams = SequenceTypes.UpdateParams,
  DeleteParams = SequenceTypes.DeleteParams,
  ProposeParams = SequenceTypes.ProposeParams,
  SettleParams = SequenceTypes.SettleParams,
  NotifyParams = SequenceTypes.NotifyParams,
  Participant = SequenceTypes.Participant,
  Permissions = SequenceTypes.Permissions
> {
  constructor(public sequence: ISequence) {}

  public abstract find(permissions: Partial<Permissions>): Promise<Settled[]>;
  public abstract ping(topic: string, timeout?: number): Promise<void>;
  public abstract send(topic: string, payload: JsonRpcPayload, chainId?: string): Promise<void>;
  public abstract create(params?: CreateParams): Promise<Settled>;
  public abstract respond(params: RespondParams): Promise<Pending>;
  public abstract upgrade(params: UpgradeParams): Promise<Settled>;
  public abstract update(params: UpdateParams): Promise<Settled>;
  public abstract request(params: RequestParams): Promise<any>;
  public abstract delete(params: DeleteParams): Promise<void>;
  public abstract notify(params: NotifyParams): Promise<void>;

  protected abstract propose(params?: ProposeParams): Promise<Pending>;
  protected abstract settle(params: SettleParams): Promise<Settled>;
  protected abstract onResponse(payloadEvent: SubscriptionEvent.Payload): Promise<void>;
  protected abstract onAcknowledge(payloadEvent: SubscriptionEvent.Payload): Promise<void>;
  protected abstract onMessage(payloadEvent: SubscriptionEvent.Payload): Promise<void>;
  protected abstract onPayload(payloadEvent: SubscriptionEvent.Payload): Promise<void>;
  protected abstract onUpdate(payloadEvent: SubscriptionEvent.Payload): Promise<void>;
  protected abstract onUpgrade(payloadEvent: SubscriptionEvent.Payload): Promise<void>;
  protected abstract onNotification(event: SubscriptionEvent.Payload): Promise<void>;

  protected abstract handleUpdate(
    topic: string,
    params: Update,
    participant: Participant,
  ): Promise<Update>;
  protected abstract handleUpgrade(
    topic: string,
    params: Upgrade,
    participant: Participant,
  ): Promise<Upgrade>;
}
