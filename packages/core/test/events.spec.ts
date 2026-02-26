import { expect, describe, it } from "vitest";
import Core, {
  EVENTS_STORAGE_CLEANUP_INTERVAL,
  EVENT_CLIENT_CONTEXT,
  EVENT_CLIENT_PAIRING_ERRORS,
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
});
