import axios from "axios";
import { Logger } from "pino";
import { generateChildLogger } from "@pedrouid/pino-utils";

import { RedisService } from "./redis";
import { Notification } from "./types";
import { HttpService } from "./http";

export class NotificationService {
  public context = "notification";

  constructor(public server: HttpService, public logger: Logger, public redis: RedisService) {
    this.server = server;
    this.logger = generateChildLogger(logger, this.context);
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
