import { IWalletConnectSession } from "./protocol";

export interface ISessionStorage {
  getSession: () => IWalletConnectSession | null;
  setSession: (session: IWalletConnectSession) => IWalletConnectSession;
  removeSession: () => void;
}
