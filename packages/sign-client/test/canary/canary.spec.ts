import { getSdkError } from "@walletconnect/utils";
import {
  initTwoClients,
  testConnectMethod,
  deleteClients,
  uploadToCloudWatch,
  TEST_EMIT_PARAMS,
} from "../shared";
import { TEST_RELAY_URL } from "./../shared/values";
import { describe, it, expect, afterEach } from "vitest";

const environment = process.env.ENVIRONMENT || "dev";

const log = (log: string) => {
  // eslint-disable-next-line no-console
  console.log(log);
};

describe("Canary", () => {
  describe("HappyPath", () => {
    it("connects", async () => {
      const clients = await initTwoClients();
      log("Clients initialized");
      const { sessionA } = await testConnectMethod(clients);
      log("Clients connected");

      await Promise.all([
        new Promise<void>((resolve, reject) => {
          const eventPayload: any = {
            topic: sessionA.topic,
            ...TEST_EMIT_PARAMS,
          };

          try {
            console.log('try to disconnect session B');
            clients.B.on("session_delete", (event: any) => {
              expect(eventPayload.topic).to.eql(event.topic);
              console.log('session B deleted');
              resolve();
            });
          } catch (e) {
            reject();
          }
        }),
        new Promise<void>((resolve) => {
          console.log('try to disconnect client A');
          clients.A.disconnect({
            topic: sessionA.topic,
            reason: getSdkError("USER_DISCONNECTED"),
          });
          console.log('client A disconnected');
          resolve();
        }),
      ]);
      log("Clients disconnected");

      console.log('deleting clients');
      deleteClients(clients);
      log("Clients deleted");
    }, 60000);
  });
  afterEach(async (done) => {
    if (environment === 'dev') return;
    const { suite, name, result } = done.meta;
    const metric_prefix = `${suite.name}.${name}`;
    const nowTimestamp = Date.now();
    await uploadToCloudWatch(
      environment,
      TEST_RELAY_URL,
      metric_prefix,
      result?.state === "pass",
      nowTimestamp - (result?.startTime || nowTimestamp),
    );
  });
});
