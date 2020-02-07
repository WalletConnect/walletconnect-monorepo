/// <reference types="node" />
import EventEmitter from 'events';
interface IXHRPost {
    method: string;
    headers: {
        [key: string]: string;
    };
    body: any;
}
declare class HTTPConnection extends EventEmitter {
    closed: boolean;
    connected: boolean;
    subscriptions: boolean;
    status: string;
    url: string;
    pollId: string;
    post: IXHRPost;
    subscriptionTimeout: any;
    constructor(url: string);
    create(): void;
    init(): void;
    pollSubscriptions(): void;
    close(): void;
    filterStatus(res: any): any;
    error(payload: any, message: string, code?: number): void;
    send(payload: any, internal?: any): void;
}
export default HTTPConnection;
//# sourceMappingURL=http.d.ts.map