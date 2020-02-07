/// <reference types="node" />
import EventEmitter from 'events';
import { JsonRpc } from '@walletconnect/types';
import WalletConnectConnection from './connection';
interface IPromisesMap {
    [id: number]: {
        resolve: (res: any) => void;
        reject: (err: any) => void;
    };
}
declare class EthereumProvider extends EventEmitter {
    connected: boolean;
    promises: IPromisesMap;
    subscriptions: number[];
    connection: WalletConnectConnection;
    accounts: string[];
    coinbase: string;
    attemptedNetworkSubscription: boolean;
    attemptedChainSubscription: boolean;
    attemptedAccountsSubscription: boolean;
    constructor(connection: WalletConnectConnection);
    onConnectionPayload(payload: JsonRpc): Promise<void>;
    checkConnection(): Promise<void>;
    startNetworkSubscription(): Promise<void>;
    startChainSubscription(): Promise<void>;
    startAccountsSubscription(): Promise<void>;
    enable(): Promise<unknown>;
    _send(method?: string, params?: any[]): Promise<any>;
    send(): Promise<any>;
    _sendBatch(requests: JsonRpc[]): Promise<void[]>;
    sendAsync(payload: JsonRpc, cb: any): any;
    sendAsyncBatch(requests: JsonRpc[], cb: any): Promise<void>;
    subscribe(type: string, method: string, params?: any[]): Promise<any>;
    unsubscribe(type: string, id: number): Promise<any>;
    isConnected(): boolean;
    close(): void;
}
export default EthereumProvider;
//# sourceMappingURL=provider.d.ts.map