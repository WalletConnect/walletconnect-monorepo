import { JsonRpcRequest } from "rpc-json-utils";

export type JsonRpcMiddleware = (
  request: JsonRpcRequest,
  cb?: any
) => Promise<void>;
