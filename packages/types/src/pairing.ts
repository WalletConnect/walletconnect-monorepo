import { SequenceTypes, ISequence } from "./sequence";
import { AppMetadata, SignalTypes } from "./misc";
import { IEngine } from "./engine";

export declare namespace PairingTypes {
  export type Status = SequenceTypes.Status;

  export type JsonRpc = SequenceTypes.JsonRpc;

  export type Events = SequenceTypes.Events;

  export type Config = SequenceTypes.Config<Events, JsonRpc, Status>;

  export type Relay = SequenceTypes.Relay;

  export type BasePermissions = Omit<SequenceTypes.BasePermissions, "blockchain">;

  export type ProposedPermissions = Omit<SequenceTypes.ProposedPermissions, "blockchain">;

  export type SettledPermissions = Omit<SequenceTypes.SettledPermissions, "blockchain">;

  export type Permissions = Omit<SequenceTypes.Permissions, "blockchain">;

  export type ProposeParams = SequenceTypes.ProposeParams;

  export type CreateParams = SequenceTypes.CreateParams;

  // URI method is specific to Pairing
  export type Signal = SignalTypes.Uri;

  export type Participant = SequenceTypes.Participant;

  export type ProposedPeer = SequenceTypes.ProposedPeer;

  export type Proposal = SequenceTypes.Proposal<Signal, ProposedPeer, ProposedPermissions>;

  export type ProposedStatus = SequenceTypes.ProposedStatus;

  export type RespondedStatus = SequenceTypes.RespondedStatus;

  export type PendingStatus = SequenceTypes.PendingStatus;

  export type BasePending = SequenceTypes.BasePending<Participant, Proposal>;

  export type ProposedPending = SequenceTypes.ProposedPending<Participant, Proposal>;

  export type RespondedPending = SequenceTypes.RespondedPending<Participant, Proposal, State>;

  export type Pending = SequenceTypes.Pending<Participant, Proposal, State>;

  export type RespondParams = SequenceTypes.RespondParams<Proposal>;

  export type SettleParams = SequenceTypes.SettleParams<State, Participant, Permissions>;

  export type UpgradeParams = SequenceTypes.UpgradeParams<Permissions>;

  export type UpdateParams = SequenceTypes.UpdateParams<State>;

  export type RequestParams = SequenceTypes.RequestParams;

  export type Upgrade = SequenceTypes.Upgrade<Permissions>;

  export type Update = SequenceTypes.Update<State>;

  export type Request = SequenceTypes.Request;

  export type PayloadEvent = SequenceTypes.PayloadEvent;

  export type RequestEvent = SequenceTypes.RequestEvent;

  export type ResponseEvent = SequenceTypes.ResponseEvent;

  export type DeleteParams = SequenceTypes.DeleteParams;

  export type Settled = SequenceTypes.Settled<State, Participant, Permissions>;

  export type Created = SequenceTypes.Created<State, Participant, Permissions>;

  export type Approval = SequenceTypes.Approval<State, Participant>;

  export type Rejection = SequenceTypes.Rejection;

  export type Response = Rejection | Approval;

  export type Success = SequenceTypes.Success<State, Participant>;

  export type Failed = SequenceTypes.Failed;

  export type Outcome = Failed | Success;

  export interface State {
    metadata?: AppMetadata;
  }

  export type DefaultSignalParams = SequenceTypes.DefaultSignalParams<ProposedPeer>;

  export type Notification = SequenceTypes.Notification;

  export type NotificationEvent = SequenceTypes.NotificationEvent;

  export type NotifyParams = SequenceTypes.NotifyParams;

  export type Engine = IEngine<
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
    SettleParams,
    NotifyParams,
    Participant,
    Permissions
  >;
}

export abstract class IPairing extends ISequence<
  PairingTypes.Engine,
  PairingTypes.Config,
  PairingTypes.Pending,
  PairingTypes.Settled,
  PairingTypes.Upgrade,
  PairingTypes.Update,
  PairingTypes.State,
  PairingTypes.Permissions,
  PairingTypes.CreateParams,
  PairingTypes.RespondParams,
  PairingTypes.RequestParams,
  PairingTypes.UpgradeParams,
  PairingTypes.UpdateParams,
  PairingTypes.DeleteParams,
  PairingTypes.ProposeParams,
  PairingTypes.SettleParams,
  PairingTypes.NotifyParams,
  PairingTypes.Participant,
  PairingTypes.Signal,
  PairingTypes.DefaultSignalParams,
  PairingTypes.ProposedPermissions
> {}
