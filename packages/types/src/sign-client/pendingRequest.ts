import { IStore, Verify } from "../core";
import { SignClientTypes } from "./";

export declare namespace PendingRequestTypes {
  export interface Struct {
    topic: string;
    id: number;
    params: SignClientTypes.EventArguments["session_request"]["params"];
    verifyContext: Verify.Context;
  }
}
export type IPendingRequest = IStore<number, PendingRequestTypes.Struct>;
