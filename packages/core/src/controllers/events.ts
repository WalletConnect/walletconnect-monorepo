import { generateChildLogger, Logger } from "@walletconnect/logger";
import { ICore, IEventClient, EventClientTypes } from "@walletconnect/types";
import { uuidv4 } from "@walletconnect/utils";
import {
  CORE_STORAGE_PREFIX,
  EVENTS_CLIENT_API_URL,
  EVENTS_STORAGE_CLEANUP_INTERVAL,
  EVENTS_STORAGE_CONTEXT,
  EVENTS_STORAGE_VERSION,
  RELAYER_SDK_VERSION,
} from "../constants";
import { HEARTBEAT_EVENTS } from "@walletconnect/heartbeat";
import { fromMiliseconds } from "@walletconnect/time";

export class EventClient extends IEventClient {
  public readonly context = EVENTS_STORAGE_CONTEXT;
  private readonly storagePrefix = CORE_STORAGE_PREFIX;
  private readonly storageVersion = EVENTS_STORAGE_VERSION;

  private events = new Map<string, EventClientTypes.Event>();
  private toPersist = false;
  constructor(public core: ICore, public logger: Logger, telemetryEnabled = true) {
    super(core, logger, telemetryEnabled);
    this.logger = generateChildLogger(logger, this.context);
    if (telemetryEnabled) {
      this.restore().then(async () => {
        await this.submit();
        this.setEventListeners();
      });
    } else {
      // overwrite any persisted events with an empty array
      this.persist();
    }
  }

  get storageKey() {
    return (
      this.storagePrefix + this.storageVersion + this.core.customStoragePrefix + "//" + this.context
    );
  }

  public createEvent: IEventClient["createEvent"] = (params) => {
    const {
      event = "ERROR",
      type = "",
      properties: { topic, trace },
    } = params;
    const eventId = uuidv4();
    const bundleId = this.core.projectId || "";
    const timestamp = Date.now();
    const props = {
      event,
      type,
      properties: {
        topic,
        trace,
      },
    };
    const eventObj = {
      eventId,
      bundleId,
      timestamp,
      props,
      ...this.setMethods(eventId),
    };

    if (this.telemetryEnabled) {
      this.events.set(eventId, eventObj);
      this.toPersist = true;
    }

    return eventObj;
  };

  public getEvent: IEventClient["getEvent"] = (params) => {
    const { eventId, topic } = params;
    if (eventId) {
      return this.events.get(eventId);
    }
    const event = Array.from(this.events.values()).find(
      (event) => event.props.properties.topic === topic,
    );

    if (!event) return;

    return {
      ...event,
      ...this.setMethods(event.eventId),
    };
  };

  public deleteEvent: IEventClient["deleteEvent"] = (params) => {
    const { eventId } = params;
    this.events.delete(eventId);
    this.toPersist = true;
  };

  private setEventListeners = () => {
    this.core.heartbeat.on(HEARTBEAT_EVENTS.pulse, async () => {
      if (this.toPersist) await this.persist();
      // cleanup events older than EVENTS_STORAGE_CLEANUP_INTERVAL
      this.events.forEach((event) => {
        if (
          fromMiliseconds(Date.now()) - fromMiliseconds(event.timestamp) >
          EVENTS_STORAGE_CLEANUP_INTERVAL
        ) {
          this.events.delete(event.eventId);
          this.toPersist = true;
        }
      });
    });
  };

  private setMethods = (eventId: string) => {
    return {
      addTrace: (trace: string) => this.addTrace(eventId, trace),
      setError: (errorType: string) => this.setError(eventId, errorType),
    };
  };

  private addTrace = async (eventId: string, trace: string) => {
    const event = this.events.get(eventId);
    if (!event) return;
    return await new Promise<void>((resolve) => {
      event.props.properties.trace.push(trace);
      this.events.set(eventId, event);
      this.toPersist = true;
      resolve();
    });
  };

  private setError = async (eventId: string, errorType: string) => {
    const event = this.events.get(eventId);
    if (!event) return;
    return await new Promise<void>((resolve) => {
      event.props.type = errorType;
      event.timestamp = Date.now();
      this.events.set(eventId, event);
      this.toPersist = true;
      resolve();
    });
  };

  private persist = async () => {
    await this.core.storage.setItem(this.storageKey, Array.from(this.events.values()));
    this.toPersist = false;
  };

  private restore = async () => {
    try {
      const events =
        (await this.core.storage.getItem<EventClientTypes.Event[]>(this.storageKey)) || [];
      if (!events.length) return;
      events.forEach((event) => {
        this.events.set(event.eventId, {
          ...event,
          ...this.setMethods(event.eventId),
        });
      });
    } catch (error) {
      this.logger.warn(error);
    }
  };

  private submit = async () => {
    if (!this.telemetryEnabled) return;

    if (this.events.size === 0) return;

    const eventsToSend = [];
    // exclude events without type as they can be considered `in progress`
    for (const [_, event] of this.events) {
      if (event.props.type) {
        eventsToSend.push(event);
      }
    }

    if (eventsToSend.length === 0) return;

    try {
      const response = await fetch(EVENTS_CLIENT_API_URL, {
        method: "POST",
        body: JSON.stringify(eventsToSend),
        headers: {
          "x-project-id": `${this.core.projectId}`,
          "x-sdk-type": "events_sdk",
          "x-sdk-version": `js-${RELAYER_SDK_VERSION}`,
        },
      });
      if (response.ok) {
        for (const event of eventsToSend) {
          this.events.delete(event.eventId);
          this.toPersist = true;
        }
      }
    } catch (error) {
      this.logger.warn(error);
    }
  };
}
