import { ISocketMessage } from '@walletconnect/types';
interface ISocketTransportOptions {
    bridge: string;
    clientId: string;
}
declare class SocketTransport {
    private _initiating;
    private _bridge;
    private _clientId;
    private _socket;
    private _queue;
    private _events;
    constructor(opts: ISocketTransportOptions);
    set readyState(value: number);
    get readyState(): number;
    set connecting(value: boolean);
    get connecting(): boolean;
    set connected(value: boolean);
    get connected(): boolean;
    set closing(value: boolean);
    get closing(): boolean;
    set closed(value: boolean);
    get closed(): boolean;
    open(): void;
    send(socketMessage: ISocketMessage): void;
    close(): void;
    on(event: string, callback: (payload: any) => void): void;
    private _socketOpen;
    private _socketClose;
    private _socketSend;
    private _socketReceive;
    private _setToQueue;
    private _pushQueue;
    private _trigger;
}
export default SocketTransport;
//# sourceMappingURL=socket.d.ts.map