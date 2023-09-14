import { IStore, Verify } from "../core";
import { JsonRpcTypes } from "./jsonrpc";

export declare namespace PendingRequestTypes {
  export interface Struct {
    topic: string;
    id: number;
    params: JsonRpcTypes.RequestParams["wc_sessionRequest"];
    verifyContext: Verify.Context;
  }
}
export type IPendingRequest = IStore<number, PendingRequestTypes.Struct>;
