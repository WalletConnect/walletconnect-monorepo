import axios from "axios";
import { Logger } from "pino";
import { formatLoggerContext } from "./utils";

import { RedisService } from "./redis";
import { Notification } from "./types";

export class NotificationService {
  public context = "notification";

  constructor(public logger: Logger, public redis: RedisService) {
    this.logger = logger.child({ context: formatLoggerContext(logger, this.context) });
    this.redis = redis;
    this.initialize();
  }

  public async push(topic: string) {
    const notifications = await this.redis.getNotification(topic);

    if (notifications && notifications.length) {
      notifications.forEach((notification: Notification) => {
        axios.post(notification.webhook, { topic });
        this.logger.info({
          type: "push",
          webhook: notification.webhook,
          topic,
        });
      });
    }
  }

  // ---------- Private ----------------------------------------------- //

  private initialize(): void {
    this.logger.trace(`Initialized`);
  }
}
