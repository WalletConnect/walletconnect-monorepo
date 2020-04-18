import { IWalletConnectSession } from "@walletconnect/types";
import { isWalletConnectSession, getLocal, setLocal, removeLocal } from "@walletconnect/utils";

class SessionStorage {
  public storageId = "walletconnect";

  public getSession(): IWalletConnectSession | null {
    let session = null;
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
