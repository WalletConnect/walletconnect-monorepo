/* eslint-disable no-console */
import { getSdkError } from "@walletconnect/utils";
import { expect, describe, it } from "vitest";
import { deleteClients, initTwoPairedClients } from "../../shared";

describe("Sign Client Integration", () => {
  it("should connect, ping, restart transport, ping & disconnect", async () => {
    const { clients, sessionA } = await initTwoPairedClients({}, {}, { logger: "error" });
    console.log("Step 1: Connect done ✅");
    await Promise.all([
      new Promise<void>((resolve) => {
        clients.B.once("session_ping", (event) => {
          expect(sessionA.topic).to.eql(event.topic);
          resolve();
        });
      }),
      new Promise<void>((resolve) => {
        clients.A.once("session_ping", (event) => {
          expect(sessionA.topic).to.eql(event.topic);
          resolve();
        });
      }),
      clients.A.ping({ topic: sessionA.topic }),
      clients.B.ping({ topic: sessionA.topic }),
    ]);
    console.log("Step 2: Ping done ✅");
    await clients.A.core.relayer.restartTransport();
    await clients.B.core.relayer.restartTransport();
    console.log("Step 3: Restart transport done ✅");
    await Promise.all([
      new Promise<void>((resolve) => {
        clients.B.once("session_ping", (event) => {
          expect(sessionA.topic).to.eql(event.topic);
          resolve();
        });
      }),
      new Promise<void>((resolve) => {
        clients.A.once("session_ping", (event) => {
          expect(sessionA.topic).to.eql(event.topic);
          resolve();
        });
      }),
      clients.A.ping({ topic: sessionA.topic }),
      clients.B.ping({ topic: sessionA.topic }),
    ]);
    console.log("Step 4: Ping done ✅");
    await Promise.all([
      new Promise<void>((resolve) => {
        clients.B.once("session_delete", (event) => {
          expect(sessionA.topic).to.eql(event.topic);
          resolve();
        });
      }),
      clients.A.disconnect({
        topic: sessionA.topic,
        reason: getSdkError("USER_DISCONNECTED"),
      }),
    ]);
    console.log("Step 5: Disconnect done ✅");
    await deleteClients(clients);
    console.log("Step 6: Delete clients done ✅");
  });
});
