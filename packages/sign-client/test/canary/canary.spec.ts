import "mocha";
import { getSdkError } from "@walletconnect/utils";
import {
  expect,
  initTwoClients,
  testConnectMethod,
  deleteClients,
  uploadToCloudWatch,
  TEST_EMIT_PARAMS,
} from "../shared";

const environment = process.env.ENVIRONMENT || "dev";

const log = (log: string) => {
  // eslint-disable-next-line no-console
  console.log(log);
};

describe("Canary", () => {
  describe("HappyPath", () => {
    it("connects", async () => {
      const clients = await initTwoClients();
      log('Clients initialized');
      const { sessionA } = await testConnectMethod(clients);
      log('Clients connected');

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
      log('Clients disconnected');

      deleteClients(clients);
      log('Clients deleted');
    });
  });
  afterEach(function(done) {
    const metric_prefix = `${this.currentTest!.parent!.title}.${this.currentTest!.title}`;
    uploadToCloudWatch(
      environment,
      metric_prefix,
      this.currentTest!.state === "passed",
      this.currentTest!.duration!,
      done,
    );
  });
});
