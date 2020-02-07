/// <reference types="node" />
import WalletConnect from '@walletconnect/browser';
import { IWalletConnectConnectionOptions } from '@walletconnect/types';
import EventEmitter from 'events';
import { IRpcConnection } from './types';
declare class WalletConnectConnection extends EventEmitter implements IRpcConnection {
    bridge: string;
    qrcode: boolean;
    wc: WalletConnect | null;
    connected: boolean;
    closed: boolean;
    constructor(opts?: IWalletConnectConnectionOptions);
    openQRCode(): void;
    create(): void;
    onClose(): void;
    open(): Promise<void>;
    close(): Promise<void>;
    error(payload: any, message: string, code?: number): void;
    send(payload: any): Promise<any>;
}
export default WalletConnectConnection;
//# sourceMappingURL=connection.d.ts.map