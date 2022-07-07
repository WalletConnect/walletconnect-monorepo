import { getSdkError } from "@walletconnect/utils";
import "mocha";
import SignClient from "../src";
import {
  expect,
  initTwoClients,
  testConnectMethod,
  TEST_SIGN_CLIENT_OPTIONS,
  deleteClients,
  Clients,
  TEST_EMIT_PARAMS,
} from "./shared";

describe("Sign Client Concurrency", () => {
  it("should successfully handle concurrent clients", async () => {
    const connections = process.env.CONNECTIONS || 300;
    const relayUrl = process.env.RELAY_URL || TEST_SIGN_CLIENT_OPTIONS.relayUrl;
    const pairings: any[] = [];

    // init clients and pair
    while (pairings.length < connections) {
      console.log(pairings.length);

      const clients: Clients = await initTwoClients({ relayUrl });

      expect(clients.A instanceof SignClient).to.eql(true);
      expect(clients.B instanceof SignClient).to.eql(true);

      const { sessionA } = await testConnectMethod(clients);
      pairings.push({ clients, sessionA });

      await new Promise<void>(resolve =>
        setTimeout(() => {
          resolve();
        }, 50),
      );
    }

    // test communication between clients
    for (const data of pairings) {
      const { clients, sessionA } = data;

      const eventPayload: any = {
        topic: sessionA.topic,
        ...TEST_EMIT_PARAMS,
      };

      await new Promise<void>(async (resolve, reject) => {
        try {
          clients.B.on("session_event", (event: any) => {
            expect(TEST_EMIT_PARAMS).to.eql(event.params);
            expect(eventPayload.topic).to.eql(event.topic);
            resolve();
          });

          clients.A.emit(eventPayload);
        } catch (e) {
          reject(e);
        }
      });
    }

    // test session disconnect
    for (const data of pairings) {
      const { clients, sessionA } = data;

      await Promise.all([
        new Promise<void>(async (resolve, reject) => {
          const eventPayload: any = {
            topic: sessionA.topic,
            ...TEST_EMIT_PARAMS,
          };

          try {
            clients.B.on("session_delete", (event: any) => {
              expect(eventPayload.topic).to.eql(event.topic);
              resolve();
            });
          } catch (e) {
            reject();
          }
        }),
        new Promise<void>(resolve => {
          clients.A.disconnect({
            topic: sessionA.topic,
            reason: getSdkError("USER_DISCONNECTED"),
          });
          resolve();
        }),
      ]);
    }

    for (const data of pairings) {
      deleteClients(data.clients);
    }
  });
});
