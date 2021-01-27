import "mocha";
import Timestamp from "@pedrouid/timestamp";
import { SessionTypes } from "@walletconnect/types";
import {
  isJsonRpcError,
  isJsonRpcRequest,
  isJsonRpcResult,
  JsonRpcResponse,
  RequestArguments,
} from "@json-rpc-tools/utils";

import { CLIENT_EVENTS } from "../../src";

import { expect } from "./chai";
import { InitializedSetup, InitializedClients } from "./types";

export async function testJsonRpcRequest(
  setup: InitializedSetup,
  clients: InitializedClients,
  topic: string,
  request: RequestArguments,
  response: JsonRpcResponse,
  chainId: string = setup.a.permissions.blockchain.chains[0],
): Promise<any> {
  // cache received result
  let id: any;
  let result: any;
  // timestamps & elapsed time
  const time = new Timestamp();

  // request & respond a JSON-RPC request
  await Promise.all([
    new Promise<void>(async (resolve, reject) => {
      clients.b.on(
        CLIENT_EVENTS.session.payload,
        async (payloadEvent: SessionTypes.PayloadEvent) => {
          if (
            isJsonRpcRequest(payloadEvent.payload) &&
            payloadEvent.topic === topic &&
            payloadEvent.chainId === chainId
          ) {
            clients.b.logger.warn(`TEST >> JSON-RPC Request Received`);
            id = payloadEvent.payload.id;
            await clients.b.respond({
              topic,
              response: { ...response, id },
            });
            clients.b.logger.warn(`TEST >> JSON-RPC Response Sent`);
            resolve();
          }
        },
      );
    }),
    new Promise<void>(async (resolve, reject) => {
      clients.a.logger.warn(`TEST >> JSON-RPC Request Sent`);
      time.start("request");
      if (isJsonRpcError(response)) {
        const promise = clients.a.request({ topic, chainId, request });
        await expect(promise).to.eventually.be.rejectedWith(response.error.message);
        resolve();
        return;
      }
      result = await clients.a.request({ topic, chainId, request });
      time.stop("request");
      clients.a.logger.warn(`TEST >> JSON-RPC Response Received`);
      resolve();
    }),
  ]);

  // log elapsed times
  clients.b.logger.warn(`TEST >> Request Elapsed Time: ${time.elapsed("request")}ms`);

  // evaluate history
  expect(clients.a.session.history.size).to.eql(1);
  expect(clients.a.session.history.keys.length).to.eql(1);
  expect(clients.a.session.history.values.length).to.eql(1);

  const recordA = await clients.a.session.history.get(topic, id);
  expect(recordA.topic).to.eql(topic);
  expect(recordA.request.method).to.eql(request.method);
  expect(recordA.request.params).to.eql(request.params || null);
  expect(recordA.chainId).to.eql(chainId);
  expect((recordA.response as any).result).to.eql((response as any).result);
  expect((recordA.response as any).error).to.eql((response as any).error);

  expect(clients.b.session.history.size).to.eql(1);
  expect(clients.b.session.history.keys.length).to.eql(1);
  expect(clients.b.session.history.values.length).to.eql(1);

  const recordB = await clients.b.session.history.get(topic, id);
  expect(recordB.topic).to.eql(topic);
  expect(recordB.request.method).to.eql(request.method);
  expect(recordB.request.params).to.eql(request.params || null);
  expect(recordB.chainId).to.eql(chainId);
  expect((recordB.response as any).result).to.eql((response as any).result);
  expect((recordB.response as any).error).to.eql((response as any).error);

  // evaluate result
  if (typeof result !== "undefined" && isJsonRpcResult(response)) {
    expect(result).to.eql(response.result);
  }

  return result;
}
