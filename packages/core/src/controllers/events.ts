import { generateChildLogger, Logger } from "@walletconnect/logger";
import { ICore, IEventClient, EventClientTypes } from "@walletconnect/types";

export class EventClient extends IEventClient {
  public context = "EventsClient";
  private events: EventClientTypes.Event[] = [];

  constructor(public core: ICore, public logger: Logger) {
    super(core, logger);
    this.logger = generateChildLogger(logger, this.context);
  }

  public createEvent: IEventClient["createEvent"] = async (params) => {
    const {
      event = "ERROR",
      type,
      properties: { topic, trace },
    } = params;
    const eventId = this.uuidv4();
    const bundleId = this.core.context;
    const timestamp = Date.now();
    const props = {
      event,
      type,
      properties: {
        topic,
        trace,
      },
    };
    this.events.push({ eventId, bundleId, timestamp, props });
    return { eventId, bundleId, timestamp, props };
  };

  private uuidv4() {
    if (crypto?.randomUUID) {
      return crypto.randomUUID();
    }

    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/gu, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === "x" ? r : (r & 0x3) | 0x8;

      return v.toString(16);
    });
  }
}
