import Connector from '@walletconnect/core';
import { IWalletConnectOptions, INativeWalletOptions } from '@walletconnect/types';
declare class RNWalletConnect extends Connector {
    constructor(opts: IWalletConnectOptions, walletOptions: INativeWalletOptions);
    private registerPushServer;
    private postClientDetails;
}
export default RNWalletConnect;
//# sourceMappingURL=index.d.ts.map