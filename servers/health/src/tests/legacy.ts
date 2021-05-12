import ClientV1 from "clientv1";
import Timestamp from "@pedrouid/timestamp";
import { formatJsonRpcRequest, formatJsonRpcResult } from "@json-rpc-tools/utils";

import { getHttpUrl } from "../utils";
import { connectorParams, metadata, request, result } from "../constants";

export async function testLegacyProvider(url: string) {
  let received: any = undefined;

  const jsonRpcRequest = formatJsonRpcRequest(request.method, request.params);

  const connectorA = new ClientV1({
    bridge: getHttpUrl(url),
    clientMeta: metadata,
  });
  let connectorB: ClientV1 | undefined;

  const time = new Timestamp();
  time.start("total");

  await Promise.all([
    new Promise<void>((resolve, reject) => {
      connectorA.on("connect", error => {
        if (error) {
          reject(error);
        }
        time.stop("session");
        resolve();
      });
    }),
    new Promise<void>((resolve, reject) => {
      connectorA.on("display_uri", (error, payload) => {
        if (error) {
          reject(error);
        }
        const uri = payload.params[0];
        connectorB = new ClientV1({ uri });

        connectorB.on("session_request", error => {
          if (error) {
            reject(error);
          }
          if (typeof connectorB === "undefined") {
            throw new Error("Peer connector is undefined");
          }
          connectorB.approveSession(connectorParams);
          resolve();
        });
      });
    }),
    new Promise<void>(async (resolve, reject) => {
      time.start("session");
      await connectorA.createSession(connectorParams);
      resolve();
    }),
  ]);

  if (typeof connectorB === "undefined") {
    throw new Error("Peer connector is undefined");
  }

  // request & respond a JSON-RPC request
  await Promise.all([
    new Promise<void>(async (resolve, reject) => {
      connectorB?.on(jsonRpcRequest.method, (error, payload) => {
        if (error) {
          throw error;
        }
        if (payload) connectorB?.approveRequest(formatJsonRpcResult(jsonRpcRequest.id, result));
        resolve();
      });
    }),
    new Promise<void>(async (resolve, reject) => {
      time.start("request");
      received = await connectorA.sendCustomRequest(jsonRpcRequest);
      time.stop("request");
      resolve();
    }),
  ]);

  time.stop("total");

  const test = {
    session: time.get("session"),
    request: time.get("request"),
    total: time.get("total"),
  };

  if (!received || received !== result) {
    throw new Error("Incorrect result when checking");
  }

  return { success: true, legacy: true, test };
}
