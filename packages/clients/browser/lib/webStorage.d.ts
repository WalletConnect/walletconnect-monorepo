import { IWalletConnectSession } from '@walletconnect/types';
declare function getSession(): IWalletConnectSession | null;
declare function setSession(session: IWalletConnectSession): IWalletConnectSession;
declare function removeSession(): void;
declare const _default: {
    getSession: typeof getSession;
    setSession: typeof setSession;
    removeSession: typeof removeSession;
};
export default _default;
//# sourceMappingURL=webStorage.d.ts.map