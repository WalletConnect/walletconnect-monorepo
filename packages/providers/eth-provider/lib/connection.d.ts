/// <reference types="node" />
import EventEmitter from 'events';
import WalletConnect from '@walletconnect/browser';
import HTTPConnection from './http';
import { ISessionParams, IWalletConnectConnectionOptions, IRPCMap } from '@walletconnect/types';
declare class WalletConnectConnection extends EventEmitter {
    bridge: string;
    qrcode: boolean;
    infuraId: string;
    rpc: IRPCMap | null;
    wc: WalletConnect | null;
    http: HTTPConnection | null;
    accounts: string[];
    chainId: number;
    networkId: number;
    rpcUrl: string;
    connected: boolean;
    closed: boolean;
    constructor(opts: IWalletConnectConnectionOptions);
    openQRCode(): void;
    create(): void;
    onClose(): void;
    close(): void;
    error(payload: any, message: string, code?: number): void;
    send(payload: any): Promise<void>;
    handleStateMethods(payload: any): Promise<{
        id: any;
        jsonrpc: any;
        result: any;
    }>;
    updateState(sessionParams: ISessionParams): Promise<void>;
    updateRpcUrl(chainId: number, rpcUrl?: string): void;
    updateHttpConnection: () => void;
}
export default WalletConnectConnection;
//# sourceMappingURL=connection.d.ts.map