/// <reference types="node" />
import EventEmitter from 'events';
import { IChannelProvider, IRpcConnection, ChannelProviderConfig, StorePair, ChannelProviderRpcMethod } from './types';
declare class ChannelProvider extends EventEmitter implements IChannelProvider {
    connected: boolean;
    connection: IRpcConnection;
    _config: ChannelProviderConfig | undefined;
    _multisigAddress: string | undefined;
    _signerAddress: string | undefined;
    constructor(connection: IRpcConnection);
    enable(): Promise<ChannelProviderConfig>;
    send: (method: string, params?: any) => Promise<any>;
    close(): Promise<void>;
    get isSigner(): boolean;
    get config(): ChannelProviderConfig | undefined;
    get multisigAddress(): string | undefined;
    set multisigAddress(multisigAddress: string | undefined);
    get signerAddress(): string | undefined;
    set signerAddress(signerAddress: string | undefined);
    on: (event: "CREATE_CHANNEL_EVENT" | "DEPOSIT_CONFIRMED_EVENT" | "DEPOSIT_FAILED_EVENT" | "DEPOSIT_STARTED_EVENT" | "INSTALL_EVENT" | "INSTALL_VIRTUAL_EVENT" | "REJECT_INSTALL_EVENT" | "UNINSTALL_EVENT" | "UNINSTALL_VIRTUAL_EVENT" | "UPDATE_STATE_EVENT" | "WITHDRAWAL_CONFIRMED_EVENT" | "WITHDRAWAL_FAILED_EVENT" | "WITHDRAWAL_STARTED_EVENT" | "PROPOSE_INSTALL_EVENT" | "PROTOCOL_MESSAGE_EVENT" | "chan_create" | "chan_deposit" | "chan_deployStateDepositHolder" | "chan_getChannelAddresses" | "chan_getAppInstance" | "chan_getAppInstances" | "chan_getStateDepositHolderAddress" | "chan_getFreeBalanceState" | "chan_getTokenIndexedFreeBalanceStates" | "chan_getProposedAppInstances" | "chan_getState" | "chan_getStateChannel" | "chan_install" | "chan_requestDepositRights" | "chan_installVirtual" | "chan_proposeInstall" | "chan_rejectInstall" | "chan_updateState" | "chan_takeAction" | "chan_uninstall" | "chan_uninstallVirtual" | "chan_rescindDepositRights" | "chan_withdraw" | "chan_withdrawCommitment", listener: (...args: any[]) => void) => any;
    once: (event: "CREATE_CHANNEL_EVENT" | "DEPOSIT_CONFIRMED_EVENT" | "DEPOSIT_FAILED_EVENT" | "DEPOSIT_STARTED_EVENT" | "INSTALL_EVENT" | "INSTALL_VIRTUAL_EVENT" | "REJECT_INSTALL_EVENT" | "UNINSTALL_EVENT" | "UNINSTALL_VIRTUAL_EVENT" | "UPDATE_STATE_EVENT" | "WITHDRAWAL_CONFIRMED_EVENT" | "WITHDRAWAL_FAILED_EVENT" | "WITHDRAWAL_STARTED_EVENT" | "PROPOSE_INSTALL_EVENT" | "PROTOCOL_MESSAGE_EVENT" | "chan_create" | "chan_deposit" | "chan_deployStateDepositHolder" | "chan_getChannelAddresses" | "chan_getAppInstance" | "chan_getAppInstances" | "chan_getStateDepositHolderAddress" | "chan_getFreeBalanceState" | "chan_getTokenIndexedFreeBalanceStates" | "chan_getProposedAppInstances" | "chan_getState" | "chan_getStateChannel" | "chan_install" | "chan_requestDepositRights" | "chan_installVirtual" | "chan_proposeInstall" | "chan_rejectInstall" | "chan_updateState" | "chan_takeAction" | "chan_uninstall" | "chan_uninstallVirtual" | "chan_rescindDepositRights" | "chan_withdraw" | "chan_withdrawCommitment", listener: (...args: any[]) => void) => any;
    signMessage: (message: string) => Promise<string>;
    get: (path: string) => Promise<any>;
    set: (pairs: StorePair[], allowDelete?: Boolean | undefined) => Promise<void>;
    restoreState: (path: string) => Promise<void>;
    _send(method: ChannelProviderRpcMethod | string, params?: any): Promise<any>;
}
export default ChannelProvider;
//# sourceMappingURL=provider.d.ts.map