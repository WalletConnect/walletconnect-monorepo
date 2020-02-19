import { isWalletConnectSession } from "@walletconnect/utils";
import { IWalletConnectSession } from "@walletconnect/types";

class SessionStorage {
  public storageId = "walletconnect";
  public storage: Storage | null = null;
  constructor() {
    if (typeof window !== "undefined" && typeof window.localStorage !== "undefined") {
      this.storage = window.localStorage;
    }
  }

  public getSession(): IWalletConnectSession | null {
    let session = null;
    let local = null;
    if (this.storage) {
      local = this.storage.getItem(this.storageId);
    }
    if (local && typeof local === "string") {
      try {
        const json = JSON.parse(local);
        if (isWalletConnectSession(json)) {
          session = json;
        }
      } catch (error) {
        return null;
      }
    }
    return session;
  }

  public setSession(session: IWalletConnectSession): IWalletConnectSession {
    const local: string = JSON.stringify(session);
    if (this.storage) {
      this.storage.setItem(this.storageId, local);
    }
    return session;
  }

  public removeSession(): void {
    if (this.storage) {
      this.storage.removeItem(this.storageId);
    }
  }
}

export default SessionStorage;
