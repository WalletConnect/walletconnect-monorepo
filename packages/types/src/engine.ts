import { JsonRpcPayload } from "@walletconnect/jsonrpc-types";

import { ISession, SessionTypes } from "./session";

export abstract class IEngine<
  Settled = SessionTypes.Settled,
  Update = SessionTypes.Update,
  Upgrade = SessionTypes.Upgrade,
  Extension = SessionTypes.Extension,
  CreateParams = SessionTypes.CreateParams,
  RespondParams = SessionTypes.RespondParams,
  RequestParams = SessionTypes.RequestParams,
  UpdateParams = SessionTypes.UpdateParams,
  UpgradeParams = SessionTypes.UpgradeParams,
  ExtendParams = SessionTypes.ExtendParams,
  DeleteParams = SessionTypes.DeleteParams,
  ProposeParams = SessionTypes.ProposeParams,
  SettleParams = SessionTypes.SettleParams,
  NotifyParams = SessionTypes.NotifyParams,
  Participant = SessionTypes.Participant,
  Permissions = SessionTypes.Permissions
> {
  constructor(public session: ISession) {}

  public abstract find(permissions: Partial<Permissions>): Promise<Settled[]>;
  public abstract ping(topic: string, timeout?: number): Promise<void>;
  public abstract send(topic: string, payload: JsonRpcPayload, chainId?: string): Promise<void>;
  public abstract create(params?: CreateParams): Promise<Settled>;
  public abstract respond(params: RespondParams): Promise<Settled>;
  public abstract update(params: UpdateParams): Promise<Settled>;
  public abstract upgrade(params: UpgradeParams): Promise<Settled>;
  public abstract extend(params: ExtendParams): Promise<Settled>;
  public abstract request(params: RequestParams): Promise<any>;
  public abstract delete(params: DeleteParams): Promise<void>;
  public abstract notify(params: NotifyParams): Promise<void>;

  protected abstract propose(params?: ProposeParams): Promise<Settled>;
  protected abstract settle(params: SettleParams): Promise<Settled>;
  protected abstract onResponse(payloadEvent: SessionTypes.PayloadEvent): Promise<void>;
  protected abstract onAcknowledge(payloadEvent: SessionTypes.PayloadEvent): Promise<void>;
  protected abstract onMessage(payloadEvent: SessionTypes.PayloadEvent): Promise<void>;
  protected abstract onPayload(payloadEvent: SessionTypes.PayloadEvent): Promise<void>;
  protected abstract onUpdate(payloadEvent: SessionTypes.PayloadEvent): Promise<void>;
  protected abstract onUpgrade(payloadEvent: SessionTypes.PayloadEvent): Promise<void>;
  protected abstract onNotification(payloadEvent: SessionTypes.PayloadEvent): Promise<void>;

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
