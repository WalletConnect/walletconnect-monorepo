import axios from "axios";
import { getSdkError } from "@walletconnect/utils";
import {
  initTwoClients,
  testConnectMethod,
  deleteClients,
  TEST_EMIT_PARAMS,
  TEST_RELAY_URL,
  TEST_WEBHOOK_ENDPOINT,
  throttle,
} from "../shared";
import { describe, it, expect, afterEach, beforeEach } from "vitest";

describe("Push", () => {
  let clients;
  let sessionA;
  beforeEach(async () => {
    clients = await initTwoClients();
    sessionA = (await testConnectMethod(clients)).sessionA;
  });
  it("receives a prompt webhook", async () => {
    // Register Webhook for topic
    await axios.post(
      `${TEST_RELAY_URL.replace("ws", "http")}/subscribe`,
      { webhook: TEST_WEBHOOK_ENDPOINT, topic: sessionA.topic },
      {
        headers: { "content-type": "application/json" },
      },
    );

    // Send a message which triggers the webhook to be invoked
    const eventPayload: any = {
      topic: sessionA.topic,
      ...TEST_EMIT_PARAMS,
    };
    await clients.A.emit(eventPayload);

    // Relay processes webhooks in background
    // Extend some time to relay to process it
    await throttle(500);

    // Validate webhook was called
    const res = await axios.get(`${TEST_WEBHOOK_ENDPOINT}/${sessionA.topic}`);
    expect(res.status).to.eql(200);
  });
  afterEach(async () => {
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
