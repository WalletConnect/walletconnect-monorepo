import { expect, describe, it, vi, afterEach } from "vitest";
import Core, {
  EVENTS_CLIENT_API_URL,
  EVENTS_STORAGE_CLEANUP_INTERVAL,
  EVENT_CLIENT_CONTEXT,
  EVENT_CLIENT_PAIRING_ERRORS,
  RELAYER_SDK_VERSION,
} from "../src";
import { TEST_CORE_OPTIONS } from "./shared";
import { toMiliseconds } from "@walletconnect/time";

describe("Events Client", () => {
  it("Init events client", async () => {
    const core = new Core(TEST_CORE_OPTIONS);
    await core.start();
    expect(core.eventClient).toBeDefined();
    expect(core.eventClient.context).toBe(EVENT_CLIENT_CONTEXT);
    expect(core.eventClient.core).toBe(core);
    // @ts-expect-error - accessing private properties for testing
    expect(core.eventClient.events.size).toBe(0);
  });
  it("should create event", async () => {
    const core = new Core(TEST_CORE_OPTIONS);
    await core.start();
    const type = EVENT_CLIENT_PAIRING_ERRORS.active_pairing_already_exists;
    const topic = "test topic";
    const trace = ["test trace", "test trace 2"];
    const eventType = "ERROR";
    const event = core.eventClient.createEvent({
      event: eventType,
      type,
      properties: {
        topic,
        trace,
      },
    });
    expect(event).toBeDefined();
    expect(event.props.event).toBe(eventType);
    expect(event.props.type).toBe(type);
    expect(event.props.properties.topic).toBe(topic);
    expect(event.props.properties.trace).toBe(trace);
    // @ts-expect-error - accessing private properties for testing
    expect(core.eventClient.events.size).toBe(1);
  });

  it("should create multiple events", async () => {
    const core = new Core(TEST_CORE_OPTIONS);
    await core.start();
    const type = EVENT_CLIENT_PAIRING_ERRORS.active_pairing_already_exists;
    const eventsToCreate = 10;
    for (let i = 0; i < eventsToCreate; i++) {
      const topic = "test topic";
      const trace = ["test trace", "test trace 2"];
      const eventType = "ERROR";
      const event = core.eventClient.createEvent({
        event: eventType,
        type,
        properties: {
          topic,
          trace,
        },
      });
      expect(event).toBeDefined();
      expect(event.props.event).toBe(eventType);
      expect(event.props.type).toBe(type);
      expect(event.props.properties.topic).toBe(topic);
      expect(event.props.properties.trace).toBe(trace);
    }
    // @ts-expect-error - accessing private properties for testing
    expect(core.eventClient.events.size).toBe(eventsToCreate);
  });
  it("should create & delete event", async () => {
    const core = new Core(TEST_CORE_OPTIONS);
    await core.start();
    const type = EVENT_CLIENT_PAIRING_ERRORS.active_pairing_already_exists;
    const topic = "test topic";
    const trace = ["test trace", "test trace 2"];
    const eventType = "ERROR";
    const event = core.eventClient.createEvent({
      event: eventType,
      type,
      properties: {
        topic,
        trace,
      },
    });
    expect(event).toBeDefined();
    expect(event.props.event).toBe(eventType);
    expect(event.props.type).toBe(type);
    expect(event.props.properties.topic).toBe(topic);
    expect(event.props.properties.trace).toBe(trace);
    // @ts-expect-error - accessing private properties for testing
    expect(core.eventClient.events.size).toBe(1);

    core.eventClient.deleteEvent({ eventId: event.eventId });

    // @ts-expect-error - accessing private properties for testing
    expect(core.eventClient.events.size).toBe(0);
  });
  it("should add trace", async () => {
    const core = new Core(TEST_CORE_OPTIONS);
    await core.start();
    const type = EVENT_CLIENT_PAIRING_ERRORS.active_pairing_already_exists;
    const topic = "test topic";
    const trace = ["test trace", "test trace 2"];
    const eventType = "ERROR";
    const event = core.eventClient.createEvent({
      event: eventType,
      type,
      properties: {
        topic,
        trace,
      },
    });
    expect(event).toBeDefined();
    expect(event.props.event).toBe(eventType);
    expect(event.props.type).toBe(type);
    expect(event.props.properties.topic).toBe(topic);
    expect(event.props.properties.trace).toBe(trace);
    expect(event.addTrace).to.exist;
    expect(event.setError).to.exist;

    const additionalTrace = ["test trace 3", "test trace 4"];
    const additionlTraceLenght = additionalTrace.length;
    const defaultTraceLength = trace.length;
    event.addTrace(additionalTrace[0]);
    event.addTrace(additionalTrace[1]);
    expect(event.props.properties.trace.length).toEqual(defaultTraceLength + additionlTraceLenght);
    expect(event.props.properties.trace).toContain(additionalTrace[0]);
    expect(event.props.properties.trace).toContain(additionalTrace[1]);
  });
  it("should set error type", async () => {
    const core = new Core(TEST_CORE_OPTIONS);
    await core.start();
    const topic = "test topic";
    const trace = ["test trace", "test trace 2"];
    const eventType = "ERROR";
    const event = core.eventClient.createEvent({
      event: eventType,
      properties: {
        topic,
        trace,
      },
    });
    expect(event).toBeDefined();
    expect(event.props.event).toBe(eventType);
    expect(event.props.type).toBe("");
    expect(event.props.properties.topic).toBe(topic);
    expect(event.props.properties.trace).toBe(trace);
    expect(event.addTrace).to.exist;
    expect(event.setError).to.exist;

    event.setError(EVENT_CLIENT_PAIRING_ERRORS.active_pairing_already_exists);

    expect(event.props.type).toBe(EVENT_CLIENT_PAIRING_ERRORS.active_pairing_already_exists);
  });
  it("should clean up old events", async () => {
    const core = new Core(TEST_CORE_OPTIONS);
    await core.start();
    const type = EVENT_CLIENT_PAIRING_ERRORS.active_pairing_already_exists;
    const topic = "test topic";
    const trace = ["test trace", "test trace 2"];
    const eventType = "ERROR";
    const event = core.eventClient.createEvent({
      event: eventType,
      type,
      properties: {
        topic,
        trace,
      },
    });

    event.timestamp = Date.now() - toMiliseconds(EVENTS_STORAGE_CLEANUP_INTERVAL);
    // @ts-expect-error - accessing private properties
    expect(core.eventClient.events.size).toBe(1);
    await new Promise((resolve) => setTimeout(resolve, 5000));
    // @ts-expect-error - accessing private properties
    expect(core.eventClient.events.size).toBe(0);
  });
  it("should not store events when telemetry is disabled", async () => {
    const core = new Core({ ...TEST_CORE_OPTIONS, telemetryEnabled: false });
    await core.start();
    const type = EVENT_CLIENT_PAIRING_ERRORS.active_pairing_already_exists;
    const topic = "test topic";
    const trace = ["test trace", "test trace 2"];
    const eventType = "ERROR";
    core.eventClient.createEvent({
      event: eventType,
      type,
      properties: {
        topic,
        trace,
      },
    });
    // @ts-expect-error - accessing private properties
    expect(core.eventClient.events.size).toBe(0);
  });

  it("should not send automatic init event", async () => {
    process.env.IS_VITEST = false as any;
    const core = new Core({ ...TEST_CORE_OPTIONS, telemetryEnabled: false });
    let initCalled = false;
    // @ts-expect-error - accessing private properties
    core.eventClient.sendEvent = async (payload: any) => {
      initCalled = true;
      expect(payload).toBeDefined();
      expect(payload.length).to.eql(1);
      expect(payload[0].props.event).to.eql("INIT");
      expect(payload[0].props.properties.client_id).to.eql(await core.crypto.getClientId());
    };
    await core.start();
    await new Promise((resolve) => setTimeout(resolve, 500));
    expect(initCalled).to.eql(false);
    process.env.IS_VITEST = true as any;
  });

  it("should send init event", async () => {
    process.env.IS_VITEST = false as any;
    const core = new Core({ ...TEST_CORE_OPTIONS, telemetryEnabled: false });
    let initCalled = false;
    // @ts-expect-error - accessing private properties
    core.eventClient.sendEvent = async (payload: any) => {
      initCalled = true;
      expect(payload).toBeDefined();
      expect(payload.length).to.eql(1);
      expect(payload[0].props.event).to.eql("INIT");
      expect(payload[0].props.properties.client_id).to.eql(await core.crypto.getClientId());
    };
    await core.start();
    await new Promise((resolve) => setTimeout(resolve, 500));

    expect(initCalled).to.eql(false);
    await core.eventClient.init();
    expect(initCalled).to.eql(true);
    if (!initCalled) {
      throw new Error("init not called");
    }
    process.env.IS_VITEST = true as any;
  });

  describe("funnel events", () => {
    const properties = { connectionOrigin: "wallet", walletId: "wallet-guide-id" } as const;

    // lets events through `isTestRun()` and captures every Pulse request
    async function startCore(telemetryEnabled = true) {
      const core = new Core({ ...TEST_CORE_OPTIONS, telemetryEnabled });
      await core.start();
      const requests: { url: URL; body: any }[] = [];
      vi.stubEnv("IS_VITEST", "false");
      vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
        requests.push({ url: new URL(String(input)), body: JSON.parse(String(init?.body)) });
        return new Response(null, { status: 202 });
      });
      return { core, requests };
    }

    afterEach(() => {
      vi.unstubAllEnvs();
      vi.unstubAllGlobals();
    });

    it("sends a funnel event in its own request with the caller's sdk type", async () => {
      const { core, requests } = await startCore();
      await core.eventClient.sendFunnelEvent({
        sdkType: "universal-provider",
        event: "CONNECT_SUCCESS",
        properties,
      });
      expect(requests).toHaveLength(1);
      const [{ url, body }] = requests;
      expect(`${url.origin}${url.pathname}`).toBe(EVENTS_CLIENT_API_URL);
      expect(url.searchParams.get("projectId")).toBe(String(core.projectId));
      expect(url.searchParams.get("st")).toBe("universal-provider");
      expect(url.searchParams.get("sv")).toBe(`js-${RELAYER_SDK_VERSION}`);
      expect(body).toHaveLength(1);
      expect(body[0]).toMatchObject({ eventId: expect.any(String), timestamp: expect.any(Number) });
      expect(body[0].props).toEqual({
        event: "CONNECT_SUCCESS",
        properties: {
          ...properties,
          projectId: core.projectId,
          clientId: await core.crypto.getClientId(),
        },
      });
    });

    it("keeps core's own events on events_sdk", async () => {
      const { core, requests } = await startCore();
      await core.eventClient.init();
      expect(requests).toHaveLength(1);
      expect(requests[0].url.searchParams.get("st")).toBe("events_sdk");
    });

    it("sends nothing when telemetry is disabled", async () => {
      const { core, requests } = await startCore(false);
      await core.eventClient.sendFunnelEvent({
        sdkType: "universal-provider",
        event: "CONNECT_SUCCESS",
        properties,
      });
      expect(requests).toHaveLength(0);
    });

    it("never throws when the request fails", async () => {
      const { core } = await startCore();
      vi.stubGlobal("fetch", () => Promise.reject(new Error("offline")));
      await expect(
        core.eventClient.sendFunnelEvent({
          sdkType: "universal-provider",
          event: "SIGN_SUCCESS",
          properties: { ...properties, chainId: "eip155:1", method: "personal_sign" },
        }),
      ).resolves.toBeUndefined();
    });
  });
});
