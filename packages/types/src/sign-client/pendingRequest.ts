import { IStore, Verify } from "../core/index.js";
import { SignClientTypes } from "./client.js";

export declare namespace PendingRequestTypes {
  export interface Struct {
    topic: string;
    id: number;
    params: SignClientTypes.EventArguments["session_request"]["params"];
    verification: Verify.AppVerification;
  }
}
export type IPendingRequest = IStore<number, PendingRequestTypes.Struct>;
