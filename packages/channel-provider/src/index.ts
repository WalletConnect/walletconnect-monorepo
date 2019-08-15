import EthereumProvider from './provider'
import WalletConnectConnection from './connection'
import { IWalletConnectConnectionOptions } from '@walletconnect/types'
import { Address, AppInstanceInfo, Node as NodeTypes } from "@counterfactual/types";

class WalletConnectChannelProvider extends EthereumProvider {
  constructor (opts: IWalletConnectConnectionOptions) {
    const connection = new WalletConnectConnection(opts)
    super(connection)
  }

  public deposit = async (
    amount: BigNumber, //TODO import
    assetId: string  = AddressZero,
    notifyCounterparty: boolean = false,
  ): Promise<NodeTypes.DepositResult> => {
    const depositResponse = await this.connection.send({
      id: Date.now(),
      methodName: NodeTypes.RpcMethodName.DEPOSIT,
      parameters: {
        amount,
        multisigAddress: this.opts.multisigAddress,  //TODO where do we get multisigAddress?
        notifyCounterparty,
        tokenAddress: assetId,
      } as NodeTypes.DepositParams,
    })
    return depositResponse.result.result as NodeTypes.DepositResult; //TODO Do we need to return entire response from upstream?
  };

  public getAppInstances = async (): Promise<AppInstanceInfo[]> => {
    const appInstanceResponse = await this.connection.send({
      id: Date.now(),
      methodName: NodeTypes.RpcMethodName.GET_APP_INSTANCES,
      parameters: {} as NodeTypes.GetAppInstancesParams,
    });

    return appInstanceResponse.result.result.appInstances as AppInstanceInfo[]; //TODO where does this type exist?
  };

  public getFreeBalance = async (
    assetId: string = AddressZero,
  ): Promise<NodeTypes.GetFreeBalanceStateResult> => {
    const freeBalance = await this.connection.send({
      id: Date.now(),
      methodName: NodeTypes.RpcMethodName.GET_FREE_BALANCE_STATE,
      parameters: {
        multisigAddress: this.multisigAddress, //TODO where does this come from?
        tokenAddress: assetId,
      },
    });
    return freeBalance.result.result as NodeTypes.GetFreeBalanceStateResult;
  }

  public getProposedAppInstances = async (): Promise<
    NodeTypes.GetProposedAppInstancesResult | undefined
  > => {
    const proposedRes = await this.connection.send({
      id: Date.now(),
      methodName: NodeTypes.RpcMethodName.GET_PROPOSED_APP_INSTANCES,
      parameters: {} as NodeTypes.GetProposedAppInstancesParams,
    });
    return proposedRes.result.result as NodeTypes.GetProposedAppInstancesResult;
  };

  public getProposedAppInstance = async (
    appInstanceId: string,
  ): Promise<NodeTypes.GetProposedAppInstanceResult | undefined> => {
    const proposedRes = await this.connection.send({
      id: Date.now(),
      methodName: NodeTypes.RpcMethodName.GET_PROPOSED_APP_INSTANCES,
      parameters: {
        appInstanceId,
      } as NodeTypes.GetProposedAppInstancesParams,
    });
    return proposedRes.result.result as NodeTypes.GetProposedAppInstanceResult;
  };

  public getAppInstanceDetails = async (
    appInstanceId: string,
  ): Promise<NodeTypes.GetAppInstanceDetailsResult | undefined> => {
    const appInstanceResponse = await this.connection.send({
      id: Date.now(),
      methodName: NodeTypes.RpcMethodName.GET_APP_INSTANCE_DETAILS,
      parameters: {
        appInstanceId,
      } as NodeTypes.GetAppInstanceDetailsParams,
    });

    return appInstanceResponse.result.result as NodeTypes.GetAppInstanceDetailsResult;
  };

  public getAppState = async (
    appInstanceId: string,
  ): Promise<NodeTypes.GetStateResult | undefined> => {
    const stateResponse = await this.connection.send({
      id: Date.now(),
      methodName: NodeTypes.RpcMethodName.GET_STATE,
      parameters: {
        appInstanceId,
      } as NodeTypes.GetStateParams,
    });

    return stateResponse.result.result as NodeTypes.GetStateResult;
  };

  public takeAction = async (
    appInstanceId: string,
    action: AppActionBigNumber,
  ): Promise<NodeTypes.TakeActionResult> => {
    const actionResponse = await this.connection.send({
      id: Date.now(),
      methodName: NodeTypes.RpcMethodName.TAKE_ACTION,
      parameters: {
        action,
        appInstanceId,
      } as NodeTypes.TakeActionParams,
    });

    return actionResponse.result.result as NodeTypes.TakeActionResult;
  };

  public updateState = async (
    appInstanceId: string,
    newState: any,
  ): Promise<NodeTypes.UpdateStateResult> => {
    const updateResponse = await this.connection.send({
      id: Date.now(),
      methodName: NodeTypes.RpcMethodName.UPDATE_STATE,
      parameters: {
        appInstanceId,
        newState,
      } as NodeTypes.UpdateStateParams,
    });
    return updateResponse.result.result as NodeTypes.UpdateStateResult;
  };

  public proposeInstallVirtualApp = async (
    params: NodeTypes.ProposeInstallVirtualParams, //TODO THIS HAS TO CHANGE
  ): Promise<NodeTypes.ProposeInstallVirtualResult> => {
    const actionRes = await this.connection.send({
      id: Date.now(),
      methodName: NodeTypes.RpcMethodName.PROPOSE_INSTALL_VIRTUAL,
      parameters: params,
    });

    return actionRes.result.result as NodeTypes.ProposeInstallVirtualResult;
  };

  public proposeInstallApp = async (
    params: NodeTypes.ProposeInstallParams, //TODO THIS HAS TO CHANGE
  ): Promise<NodeTypes.ProposeInstallResult> => {
    const actionRes = await this.connection.send({
      id: Date.now(),
      methodName: NodeTypes.RpcMethodName.PROPOSE_INSTALL,
      parameters: params,
    });

    return actionRes.result.result as NodeTypes.ProposeInstallResult;
  };

  public installVirtualApp = async (
    appInstanceId: string,
  ): Promise<NodeTypes.InstallVirtualResult> => {
    const installVirtualResponse = await this.connection.send({
      id: Date.now(),
      methodName: NodeTypes.RpcMethodName.INSTALL_VIRTUAL,
      parameters: {
        appInstanceId,
        intermediaries: [this.nodePublicIdentifier], //TODO How do we find this?
      } as NodeTypes.InstallVirtualParams,
    });

    return installVirtualResponse.result.result;
  };

  public installApp = async (appInstanceId: string): Promise<NodeTypes.InstallResult> => {
    const installResponse = await this.connection.send({
      id: Date.now(),
      methodName: NodeTypes.RpcMethodName.INSTALL,
      parameters: {
        appInstanceId,
      } as NodeTypes.InstallParams,
    });

    return installResponse.result.result;
  };

  public uninstallApp = async (appInstanceId: string): Promise<NodeTypes.UninstallResult> => {
    const uninstallResponse = await this.connection.send({
      id: Date.now(),
      methodName: NodeTypes.RpcMethodName.UNINSTALL,
      parameters: {
        appInstanceId,
      },
    });

    return uninstallResponse.result.result as NodeTypes.UninstallResult;
  };

  public uninstallVirtualApp = async (
    appInstanceId: string,
  ): Promise<NodeTypes.UninstallVirtualResult> => {
    const uninstallVirtualResponse = await this.connection.send({
      id: Date.now(),
      methodName: NodeTypes.RpcMethodName.UNINSTALL_VIRTUAL,
      parameters: {
        appInstanceId,
        intermediaryIdentifier: this.nodePublicIdentifier, //TODO
      } as NodeTypes.UninstallVirtualParams,
    });

    return uninstallVirtualResponse.result.result as NodeTypes.UninstallVirtualResult;
  };

  public rejectInstallApp = async (appInstanceId: string): Promise<NodeTypes.UninstallResult> => {
    const rejectResponse = await this.connection.send({
      id: Date.now(),
      methodName: NodeTypes.RpcMethodName.REJECT_INSTALL,
      parameters: {
        appInstanceId,
      } as NodeTypes.RejectInstallParams,
    });

    return rejectResponse.result.result as NodeTypes.RejectInstallResult;
  };

  public rejectInstallVirtualApp = async (
    appInstanceId: string,
  ): Promise<NodeTypes.UninstallVirtualResult> => {
    const rejectResponse = await this.connection.send({
      id: Date.now(),
      methodName: NodeTypes.RpcMethodName.REJECT_INSTALL,
      parameters: {
        appInstanceId,
      } as NodeTypes.RejectInstallParams,
    });

    return rejectResponse.result.result as NodeTypes.RejectInstallResult;
  };

  public withdraw = async (
    assetId: string,
    amount: BigNumber,
    recipient: string,
  ): Promise<NodeTypes.WithdrawResult> => {
    const withdrawalResponse = await this.connection.send({
      id: Date.now(),
      methodName: NodeTypes.RpcMethodName.WITHDRAW,
      parameters: {
        amount,
        multisigAddress: this.multisigAddress,
        recipient,
        tokenAddress: assetId,
      },
    });

    return withdrawalResponse.result.result;
  };

}

export default WalletConnectChannelProvider
