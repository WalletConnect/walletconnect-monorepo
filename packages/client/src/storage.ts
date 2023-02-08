import { IWalletConnectSession } from "@walletconnect/legacy-types";
import {
  isWalletConnectSession,
  getLocal,
  setLocal,
  removeLocal,
} from "@walletconnect/legacy-utils";

class SessionStorage {
  constructor(public storageId: string = "walletconnect") {}

  public getSession(): IWalletConnectSession | null {
    let session: IWalletConnectSession | null = null;
    const json = getLocal(this.storageId);
    if (json && isWalletConnectSession(json)) {
      session = json;
    }
    return session;
  }

  public setSession(session: IWalletConnectSession): IWalletConnectSession {
    setLocal(this.storageId, session);
    return session;
  }

  public removeSession(): void {
    removeLocal(this.storageId);
  }
}

export default SessionStorage;
