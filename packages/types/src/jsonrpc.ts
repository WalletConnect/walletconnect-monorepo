import { JsonRpcRequest, JsonRpcResult } from "@walletconnect/jsonrpc-types";
import { PairingTypes, RelayerTypes, SessionTypes } from ".";

export declare namespace PairingJsonRpc {
  // -- approve ----------------------------------------- //

  export interface ApproveParams {
    relay: RelayerTypes.ProtocolOptions;
    responder: PairingTypes.Participant;
    expiry: number;
    state: PairingTypes.State;
  }

  export interface ApproveRequest extends JsonRpcRequest {
    method: "wc_pairingApprove";
    params: ApproveParams;
  }

  export interface ApproveResult extends JsonRpcResult {
    result: true;
  }

  // -- reject ----------------------------------------- //

  export interface RejectParams {
    reason: string;
  }

  export interface RejectRequest extends JsonRpcRequest {
    method: "wc_pairingReject";
    params: RejectParams;
  }

  export interface RejectResult extends JsonRpcResult {
    result: true;
  }

  // -- update ----------------------------------------- //

  export interface UpdateParams {
    state: Partial<PairingTypes.State>;
  }

  export interface UpdateRequest extends JsonRpcRequest {
    method: "wc_pairingUpdate";
    params: UpdateParams;
  }

  export interface UpdateResult extends JsonRpcResult {
    result: true;
  }

  // -- upgrade ----------------------------------------- //

  export interface UpgradeParams {
    permissions: Partial<PairingTypes.Permissions>;
  }

  export interface UpgradeRequest extends JsonRpcRequest {
    method: "wc_pairingUpgrade";
    params: UpgradeParams;
  }

  export interface UpgradeResult extends JsonRpcResult {
    result: true;
  }

  // -- delete ----------------------------------------- //

  export interface DeleteParams {
    reason: string;
  }

  export interface DeleteRequest extends JsonRpcRequest {
    method: "wc_pairingDelete";
    params: DeleteParams;
  }

  export interface DeleteResult extends JsonRpcResult {
    result: true;
  }

  // -- payload ----------------------------------------- //

  export interface PayloadParams {
    request: {
      method: string;
      params: any;
    };
  }

  export interface PayloadRequest extends JsonRpcRequest {
    method: "wc_pairingPayload";
    params: PayloadParams;
  }

  export interface PayloadResult extends JsonRpcResult {
    result: any;
  }

  // -- ping ----------------------------------------- //

  // eslint-disable-next-line @typescript-eslint/no-empty-interface
  export interface PingParams {}

  export interface PingRequest extends JsonRpcRequest {
    method: "wc_pairingPing";
    f;
    params: PingParams;
  }

  export interface PingResult extends JsonRpcResult {
    result: true;
  }

  // -- notification ----------------------------------------- //

  export interface NotificationParams {
    type: string;
    data: any;
  }

  export interface NotificationRequest extends JsonRpcRequest {
    method: "wc_pairingNotification";
    params: NotificationParams;
  }

  export interface NotificationResult extends JsonRpcResult {
    result: true;
  }
}

export declare namespace SessionJsonRpc {
  // -- propose ----------------------------------------- //

  export interface ProposeParams {
    topic: string;
    relay: RelayerTypes.ProtocolOptions;
    proposer: SessionTypes.Participant;
    signal: SessionTypes.Signal;
    permissions: SessionTypes.Permissions;
    ttl: number;
  }

  export interface ProposeRequest extends JsonRpcRequest {
    method: "wc_sessionPropose";
    params: ProposeParams;
  }

  export interface ProposeResult extends JsonRpcResult {
    result: true;
  }

  // -- approve ----------------------------------------- //

  export interface ApproveParams {
    relay: RelayerTypes.ProtocolOptions;
    responder: SessionTypes.Participant;
    expiry: number;
    state: SessionTypes.State;
  }

  export interface ApproveRequest extends JsonRpcRequest {
    method: "wc_sessionApprove";
    params: ApproveParams;
  }

  export interface ApproveResult extends JsonRpcResult {
    result: true;
  }

  // -- reject ----------------------------------------- //

  export interface RejectParams {
    reason: string;
  }

  export interface RejectRequest extends JsonRpcRequest {
    method: "wc_sessionReject";
    params: RejectParams;
  }

  export interface RejectResult extends JsonRpcResult {
    result: true;
  }

  // -- update ----------------------------------------- //

  export interface UpdateParams {
    state: Partial<SessionTypes.State>;
  }

  export interface UpdateRequest extends JsonRpcRequest {
    method: "wc_sessionUpdate";
    params: UpdateParams;
  }

  export interface UpdateResult extends JsonRpcResult {
    result: true;
  }

  // -- upgrade ----------------------------------------- //

  export interface UpgradeParams {
    permissions: Partial<SessionTypes.Permissions>;
  }

  export interface UpgradeRequest extends JsonRpcRequest {
    method: "wc_sessionUpgrade";
    params: UpgradeParams;
  }

  export interface UpgradeResult extends JsonRpcResult {
    result: true;
  }

  // -- delete ----------------------------------------- //

  export interface DeleteParams {
    reason: string;
  }

  export interface DeleteRequest extends JsonRpcRequest {
    method: "wc_sessionDelete";
    params: DeleteParams;
  }

  export interface DeleteResult extends JsonRpcResult {
    result: true;
  }

  // -- payload ----------------------------------------- //

  export interface PayloadParams {
    request: {
      method: string;
      params: any;
    };
    chainId?: string;
  }

  export interface PayloadRequest extends JsonRpcRequest {
    method: "wc_sessionPayload";
    params: PayloadParams;
  }

  export interface PayloadResult extends JsonRpcResult {
    result: any;
  }

  // -- ping ----------------------------------------- //

  // eslint-disable-next-line @typescript-eslint/no-empty-interface
  export interface PingParams {}

  export interface PingRequest extends JsonRpcRequest {
    method: "wc_sessionPing";
    params: PingParams;
  }

  export interface PingResult extends JsonRpcResult {
    result: true;
  }

  // -- notification ----------------------------------------- //

  export interface NotificationParams {
    type: string;
    data: any;
  }

  export interface NotificationRequest extends JsonRpcRequest {
    method: "wc_sessionNotification";
    params: NotificationParams;
  }

  export interface NotificationResult extends JsonRpcResult {
    result: true;
  }
}
