import axios from "axios";
import { Logger } from "pino";
import { formatLoggerContext } from "@walletconnect/utils";

import { RedisStore } from "./redis";
import { Notification } from "./types";

export class NotificationServer {
  public context = "notification";

  constructor(public logger: Logger, public store: RedisStore) {
    this.logger = logger.child({ context: formatLoggerContext(logger, this.context) });
    this.store = store;
  }

  public async push(topic: string) {
    const notifications = await this.store.getNotification(topic);

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
}
