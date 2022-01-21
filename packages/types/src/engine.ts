import { JsonRpcPayload } from "@walletconnect/jsonrpc-types";

import { RelayerTypes } from "./relayer";
import { ISequence, SequenceTypes } from "./sequence";

export abstract class IEngine<
  Pending = SequenceTypes.Pending,
  Settled = SequenceTypes.Settled,
  Update = SequenceTypes.Update,
  Upgrade = SequenceTypes.Upgrade,
  Extension = SequenceTypes.Extension,
  CreateParams = SequenceTypes.CreateParams,
  RespondParams = SequenceTypes.RespondParams,
  RequestParams = SequenceTypes.RequestParams,
  UpdateParams = SequenceTypes.UpdateParams,
  UpgradeParams = SequenceTypes.UpgradeParams,
  ExtendParams = SequenceTypes.ExtendParams,
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
  public abstract update(params: UpdateParams): Promise<Settled>;
  public abstract upgrade(params: UpgradeParams): Promise<Settled>;
  public abstract extend(params: ExtendParams): Promise<Settled>;
  public abstract request(params: RequestParams): Promise<any>;
  public abstract delete(params: DeleteParams): Promise<void>;
  public abstract notify(params: NotifyParams): Promise<void>;

  protected abstract propose(params?: ProposeParams): Promise<Pending>;
  protected abstract settle(params: SettleParams): Promise<Settled>;
  protected abstract onResponse(payloadEvent: RelayerTypes.PayloadEvent): Promise<void>;
  protected abstract onAcknowledge(payloadEvent: RelayerTypes.PayloadEvent): Promise<void>;
  protected abstract onMessage(payloadEvent: RelayerTypes.PayloadEvent): Promise<void>;
  protected abstract onPayload(payloadEvent: RelayerTypes.PayloadEvent): Promise<void>;
  protected abstract onUpdate(payloadEvent: RelayerTypes.PayloadEvent): Promise<void>;
  protected abstract onUpgrade(payloadEvent: RelayerTypes.PayloadEvent): Promise<void>;
  protected abstract onNotification(payloadEvent: RelayerTypes.PayloadEvent): Promise<void>;

  protected abstract handleUpdate(
    topic: string,
    update: Update,
    participant: Participant,
  ): Promise<Update>;
  protected abstract handleUpgrade(
    topic: string,
    upgrade: Upgrade,
    participant: Participant,
  ): Promise<Upgrade>;
  protected abstract handleExtension(
    topic: string,
    extension: Extension,
    participant: Participant,
  ): Promise<Extension>;
}
