import axios from "axios";
import {
  deleteClients,
  TEST_EMIT_PARAMS,
  TEST_WEBHOOK_ENDPOINT,
  throttle,
  Clients,
  initTwoPairedClients,
} from "../../shared";
import { describe, it, expect, afterEach, beforeAll } from "vitest";
import { PairingTypes, SessionTypes } from "@walletconnect/types";

describe("Push", () => {
  let clients: Clients;
  let pairingA: PairingTypes.Struct;
  let sessionA: SessionTypes.Struct;

  beforeAll(async () => {
    ({ clients, pairingA, sessionA } = await initTwoPairedClients());
  });

  it("receives a prompt webhook", async () => {
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
    expect(res.data.payload.payload.topic).to.eql(sessionA.topic);
    expect(res.data.payload.payload.flags).to.eql(2);
    expect(res.status).to.eql(200);
  });
  afterEach(async () => {
    await deleteClients(clients);
  });
});
