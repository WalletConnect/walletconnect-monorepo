
import { SessionTypes } from "./session";

export declare namespace EngineTypes {
  interface UriParameters {
    version: number;
    topic: string;
    symetricKey: string;
    relayProtocol: string;
    relayData?: string;
  }
}

export interface IEngine {
  createSession(params: SessionTypes.CreateSessionParams): Promise<void>;
  pair(pairingUri: string): Promise<void>;
  approve(): Promise<void>;
  reject(): Promise<void>;
  updateAccounts(): Promise<void>;
  updateMethods(): Promise<void>;
  updateEvents(): Promise<void>;
  updateExpiry(): Promise<void>;
  request(): Promise<void>;
  respond(): Promise<void>;
  ping(): Promise<void>;
  notify(): Promise<void>;
  disconnect(): Promise<void>;
}
