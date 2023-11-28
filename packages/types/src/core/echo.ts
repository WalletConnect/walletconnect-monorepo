import { Logger } from "@walletconnect/logger";

export abstract class IEcho {
  public abstract readonly context: string;
  constructor(public projectId: string, public logger: Logger) {}

  public abstract registerDeviceToken(params: {
    clientId: string;
    token: string;
    notificationType: "fcm" | "apns" | "apns-sandbox" | "noop";
    enableAlwaysDecrypted?: boolean;
  }): Promise<void>;
}
