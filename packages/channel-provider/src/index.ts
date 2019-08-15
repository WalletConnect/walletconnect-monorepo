import EthereumProvider from './provider'
import WalletConnectConnection from './connection'
import { IWalletConnectConnectionOptions } from '@walletconnect/types'
import { Node as NodeTypes } from "@counterfactual/types";
import { BigNumber } from "ethers/utils";

class WalletConnectChannelProvider extends EthereumProvider {
  constructor (opts: IWalletConnectConnectionOptions) {
    const connection = new WalletConnectConnection(opts)
    super(connection)
  }

  public deposit = async (
    amount: BigNumber,
    assetId: string,
    notifyCounterparty: boolean = false,
  ): Promise<NodeTypes.DepositResult> => {
    const result = await this.connection.send({
      id: Date.now(),
      method: NodeTypes.RpcMethodName.DEPOSIT,
      parameters: {
        amount,
        multisigAddress: this.opts.multisigAddress,  //TODO where do we get multisigAddress?
        notifyCounterparty,
        tokenAddress: assetId,
      } as NodeTypes.DepositParams,
    })
    return result;
  };

  public getAppInstances = async (): Promise<any> => {
    const result = await this.connection.send({
      id: Date.now(),
      method: NodeTypes.RpcMethodName.GET_APP_INSTANCES,
      parameters: {} as NodeTypes.GetAppInstancesParams,
    });

    return result;
  };

  public getFreeBalance = async (
    assetId: string,
  ): Promise<NodeTypes.GetFreeBalanceStateResult> => {
    const result = await this.connection.send({
      id: Date.now(),
      method: NodeTypes.RpcMethodName.GET_FREE_BALANCE_STATE,
      parameters: {
        multisigAddress: this.multisigAddress, //TODO where does this come from?
        tokenAddress: assetId,
      },
    });
    return result;
  }

  public getProposedAppInstances = async (): Promise<
    NodeTypes.GetProposedAppInstancesResult | undefined
  > => {
    const result = await this.connection.send({
      id: Date.now(),
      method: NodeTypes.RpcMethodName.GET_PROPOSED_APP_INSTANCES,
      parameters: {} as NodeTypes.GetProposedAppInstancesParams,
    });
    return result;
  };

  public getProposedAppInstance = async (
    appInstanceId: string,
  ): Promise<NodeTypes.GetProposedAppInstanceResult | undefined> => {
    const result = await this.connection.send({
      id: Date.now(),
      method: NodeTypes.RpcMethodName.GET_PROPOSED_APP_INSTANCES,
      parameters: {
        appInstanceId,
      } as NodeTypes.GetProposedAppInstancesParams,
    });
    return result;
  };

  public getAppInstanceDetails = async (
    appInstanceId: string,
  ): Promise<NodeTypes.GetAppInstanceDetailsResult | undefined> => {
    const result = await this.connection.send({
      id: Date.now(),
      method: NodeTypes.RpcMethodName.GET_APP_INSTANCE_DETAILS,
      parameters: {
        appInstanceId,
      } as NodeTypes.GetAppInstanceDetailsParams,
    });
    return result;
  };

  public getAppState = async (
    appInstanceId: string,
  ): Promise<NodeTypes.GetStateResult | undefined> => {
    const result = await this.connection.send({
      id: Date.now(),
      method: NodeTypes.RpcMethodName.GET_STATE,
      parameters: {
        appInstanceId,
      } as NodeTypes.GetStateParams,
    });
    return result;
  };

  public takeAction = async (
    appInstanceId: string,
    action: any,
  ): Promise<NodeTypes.TakeActionResult> => {
    const result = await this.connection.send({
      id: Date.now(),
      method: NodeTypes.RpcMethodName.TAKE_ACTION,
      parameters: {
        action,
        appInstanceId,
      } as NodeTypes.TakeActionParams,
    });

    return result;
  };

  public updateState = async (
    appInstanceId: string,
    newState: any,
  ): Promise<NodeTypes.UpdateStateResult> => {
    const result = await this.connection.send({
      id: Date.now(),
      method: NodeTypes.RpcMethodName.UPDATE_STATE,
      parameters: {
        appInstanceId,
        newState,
      } as NodeTypes.UpdateStateParams,
    });
    return result;
  };

  public proposeInstallVirtualApp = async (
    params: NodeTypes.ProposeInstallVirtualParams, //TODO THIS HAS TO CHANGE
  ): Promise<NodeTypes.ProposeInstallVirtualResult> => {
    const result = await this.connection.send({
      id: Date.now(),
      method: NodeTypes.RpcMethodName.PROPOSE_INSTALL_VIRTUAL,
      parameters: params,
    });
    return result;
  };

  public proposeInstallApp = async (
    params: NodeTypes.ProposeInstallParams, //TODO THIS HAS TO CHANGE
  ): Promise<NodeTypes.ProposeInstallResult> => {
    const result = await this.connection.send({
      id: Date.now(),
      method: NodeTypes.RpcMethodName.PROPOSE_INSTALL,
      parameters: params,
    });
    return result;
  };

  public installVirtualApp = async (
    appInstanceId: string,
  ): Promise<NodeTypes.InstallVirtualResult> => {
    const result = await this.connection.send({
      id: Date.now(),
      method: NodeTypes.RpcMethodName.INSTALL_VIRTUAL,
      parameters: {
        appInstanceId,
        intermediaries: [this.nodePublicIdentifier], //TODO How do we find this?
      } as NodeTypes.InstallVirtualParams,
    });
    return result;
  };

  public installApp = async (appInstanceId: string): Promise<NodeTypes.InstallResult> => {
    const result = await this.connection.send({
      id: Date.now(),
      method: NodeTypes.RpcMethodName.INSTALL,
      parameters: {
        appInstanceId,
      } as NodeTypes.InstallParams,
    });
    return result;
  };

  public uninstallApp = async (appInstanceId: string): Promise<NodeTypes.UninstallResult> => {
    const result = await this.connection.send({
      id: Date.now(),
      method: NodeTypes.RpcMethodName.UNINSTALL,
      parameters: {
        appInstanceId,
      },
    });
    return result;
  };

  public uninstallVirtualApp = async (
    appInstanceId: string,
  ): Promise<NodeTypes.UninstallVirtualResult> => {
    const result = await this.connection.send({
      id: Date.now(),
      method: NodeTypes.RpcMethodName.UNINSTALL_VIRTUAL,
      parameters: {
        appInstanceId,
        intermediaryIdentifier: this.nodePublicIdentifier, //TODO
      } as NodeTypes.UninstallVirtualParams,
    });
    return result;
  };

  public rejectInstallApp = async (appInstanceId: string): Promise<NodeTypes.UninstallResult> => {
    const result = await this.connection.send({
      id: Date.now(),
      method: NodeTypes.RpcMethodName.REJECT_INSTALL,
      parameters: {
        appInstanceId,
      } as NodeTypes.RejectInstallParams,
    });

    return result;
  };

  public rejectInstallVirtualApp = async (
    appInstanceId: string,
  ): Promise<NodeTypes.UninstallVirtualResult> => {
    const result = await this.connection.send({
      id: Date.now(),
      method: NodeTypes.RpcMethodName.REJECT_INSTALL,
      parameters: {
        appInstanceId,
      } as NodeTypes.RejectInstallParams,
    });

    return result;
  };

  public withdraw = async (
    assetId: string,
    amount: BigNumber,
    recipient: string,
  ): Promise<NodeTypes.WithdrawResult> => {
    const result = await this.connection.send({
      id: Date.now(),
      method: NodeTypes.RpcMethodName.WITHDRAW,
      parameters: {
        amount,
        multisigAddress: this.multisigAddress,
        recipient,
        tokenAddress: assetId,
      },
    });

    return result;
  };

}

export default WalletConnectChannelProvider
