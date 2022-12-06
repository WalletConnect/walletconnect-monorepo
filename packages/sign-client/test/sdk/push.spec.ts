import axios from "axios";
import { getSdkError } from "@walletconnect/utils";
import {
  initTwoClients,
  testConnectMethod,
  deleteClients,
  TEST_EMIT_PARAMS,
  TEST_WEBHOOK_ENDPOINT,
  throttle,
} from "../shared";
import { TEST_RELAY_URL } from "./../shared/values";
import { describe, it, expect, afterEach, beforeEach } from "vitest";

describe("Push", () => {
  let clients;
  let sessionA;
  beforeEach(async () => {
    clients = await initTwoClients();
    console.log(
      `Clients initialized (relay '${TEST_RELAY_URL}'), client ids: A:'${await clients.A.core.crypto.getClientId()}';B:'${await clients.B.core.crypto.getClientId()}'`,
    );
    sessionA = (await testConnectMethod(clients)).sessionA;
  });
  it.skip("receives a prompt webhook", async () => {
    await throttle(200); // Allow to propagate routing table
    console.log(
      "emitting",
      await clients.A.core.crypto.getClientId(),
      await clients.B.core.crypto.getClientId(),
    );
    // Send a message which triggers the webhook to be invoked
    const eventPayload: any = {
      topic: sessionA.topic,
      ...TEST_EMIT_PARAMS,
    };
    await clients.A.emit(eventPayload);

    // Relay processes webhooks in background
    // Extend some time to relay to process it
    await throttle(1000);

    const url = `${TEST_WEBHOOK_ENDPOINT}/${await clients.B.core.crypto.getClientId()}`.replace(
      "did:key:",
      "",
    );

    // Validate webhook was called
    const res = await axios.get(url);
    expect(res.status).to.eql(200);
  });
  afterEach(async () => {
    if (!sessionA) {
      console.log("No session to disconnect");
      return;
    }

    // disconnect clients
    await Promise.all([
      new Promise<void>((resolve, reject) => {
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
      new Promise<void>((resolve) => {
        clients.A.disconnect({
          topic: sessionA.topic,
          reason: getSdkError("USER_DISCONNECTED"),
        });
        resolve();
      }),
    ]);

    deleteClients(clients);
  });
});
