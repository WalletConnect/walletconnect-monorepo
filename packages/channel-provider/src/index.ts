import ChannelProvider from './provider'
import WalletConnectConnection from './connection'
import { IWalletConnectConnectionOptions } from '@walletconnect/types'
import { Node as NodeTypes } from "@counterfactual/types";
import { BigNumber } from "ethers/utils";
class WalletConnectChannelProvider extends ChannelProvider {
  constructor (opts: IWalletConnectConnectionOptions) {
    const connection = new WalletConnectConnection(opts)
    super(connection)
  }

  public deposit = async (
    amount: BigNumber,
    assetId: string,
    notifyCounterparty: boolean = false,
  ): Promise<NodeTypes.DepositResult> => {
    const result = await this._send(
      NodeTypes.RpcMethodName.DEPOSIT,
      [
        amount,
        this.multisigAddress,  //TODO where do we get multisigAddress?
        notifyCounterparty,
        assetId,
       ],
    )
    return result;
  };

  public getAppInstances = async (): Promise<any> => {
    const result = await this._send(
      NodeTypes.RpcMethodName.GET_APP_INSTANCES,
      [],
    );
    return result;
  };

  public getFreeBalance = async (
    assetId: string,
  ): Promise<NodeTypes.GetFreeBalanceStateResult> => {
    const result = await this._send(
      NodeTypes.RpcMethodName.GET_FREE_BALANCE_STATE,
      [
        this.multisigAddress, //TODO
        assetId,
      ],
    );
    return result;
  }

  public getProposedAppInstances = async (): Promise<
    NodeTypes.GetProposedAppInstancesResult | undefined
  > => {
    const result = await this._send(
      NodeTypes.RpcMethodName.GET_PROPOSED_APP_INSTANCES,
      [],
    );
    return result;
  };

  public getProposedAppInstance = async (
    appInstanceId: string,
  ): Promise<NodeTypes.GetProposedAppInstanceResult | undefined> => {
    const result = await this._send(
      NodeTypes.RpcMethodName.GET_PROPOSED_APP_INSTANCES,
      [
        appInstanceId,
      ],
    );
    return result;
  };

  public getAppInstanceDetails = async (
    appInstanceId: string,
  ): Promise<NodeTypes.GetAppInstanceDetailsResult | undefined> => {
    const result = await this._send(
      NodeTypes.RpcMethodName.GET_APP_INSTANCE_DETAILS,
      [
        appInstanceId,
      ],
    );
    return result;
  };

  public getAppState = async (
    appInstanceId: string,
  ): Promise<NodeTypes.GetStateResult | undefined> => {
    const result = await this._send(
      NodeTypes.RpcMethodName.GET_STATE,
      [
        appInstanceId,
      ],
    );
    return result;
  };

  public takeAction = async (
    appInstanceId: string,
    action: any,
  ): Promise<NodeTypes.TakeActionResult> => {
    const result = await this._send(
      NodeTypes.RpcMethodName.TAKE_ACTION,
      [
        action,
        appInstanceId,
      ],
    );
    return result;
  };

  public updateState = async (
    appInstanceId: string,
    newState: any,
  ): Promise<NodeTypes.UpdateStateResult> => {
    const result = await this._send(
      NodeTypes.RpcMethodName.UPDATE_STATE,
      [
        appInstanceId,
        newState,
      ],
    );
    return result;
  };

  public proposeInstallVirtualApp = async (
    params: NodeTypes.ProposeInstallVirtualParams, //TODO THIS HAS TO CHANGE
  ): Promise<NodeTypes.ProposeInstallVirtualResult> => {
    const result = await this._send(
      NodeTypes.RpcMethodName.PROPOSE_INSTALL_VIRTUAL,
      [params],
    );
    return result;
  };

  public proposeInstallApp = async (
    params: NodeTypes.ProposeInstallParams, //TODO THIS HAS TO CHANGE
  ): Promise<NodeTypes.ProposeInstallResult> => {
    const result = await this._send(
      NodeTypes.RpcMethodName.PROPOSE_INSTALL,
      [params],
    );
    return result;
  };

  public installVirtualApp = async (
    appInstanceId: string,
  ): Promise<NodeTypes.InstallVirtualResult> => {
    const result = await this._send(
      NodeTypes.RpcMethodName.INSTALL_VIRTUAL,
      [
        appInstanceId,
        [this.nodePublicIdentifier], //TODO How do we find this?
      ],
    );
    return result;
  };

  public installApp = async (appInstanceId: string): Promise<NodeTypes.InstallResult> => {
    const result = await this._send(
      NodeTypes.RpcMethodName.INSTALL,
      [
        appInstanceId,
      ],
    );
    return result;
  };

  public uninstallApp = async (appInstanceId: string): Promise<NodeTypes.UninstallResult> => {
    const result = await this._send(
      NodeTypes.RpcMethodName.UNINSTALL,
      [
        appInstanceId,
      ],
    );
    return result;
  };

  public uninstallVirtualApp = async (
    appInstanceId: string,
  ): Promise<NodeTypes.UninstallVirtualResult> => {
    const result = await this._send(
      NodeTypes.RpcMethodName.UNINSTALL_VIRTUAL,
      [
        appInstanceId,
        this.nodePublicIdentifier, //TODO
      ],
    );
    return result;
  };

  public rejectInstallApp = async (appInstanceId: string): Promise<NodeTypes.UninstallResult> => {
    const result = await this._send(
      NodeTypes.RpcMethodName.REJECT_INSTALL,
      [
        appInstanceId,
      ],
    );
    return result;
  };

  public rejectInstallVirtualApp = async (
    appInstanceId: string,
  ): Promise<NodeTypes.UninstallVirtualResult> => {
    const result = await this._send(
      NodeTypes.RpcMethodName.REJECT_INSTALL,
      [
        appInstanceId,
      ],
    );
    return result;
  };

  public withdraw = async (
    assetId: string,
    amount: BigNumber,
    recipient: string,
  ): Promise<NodeTypes.WithdrawResult> => {
    const result = await this._send(
      NodeTypes.RpcMethodName.WITHDRAW,
      [
        amount,
        this.multisigAddress, //TODO
        recipient,
        assetId,
      ],
    );
    return result;
  };
}

export default WalletConnectChannelProvider
