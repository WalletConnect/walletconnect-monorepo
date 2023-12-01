import { Logger } from "@walletconnect/logger";

export declare namespace EchoTypes {
  type RegisterDeviceTokenParams = {
    clientId: string;
    token: string;
    notificationType: "fcm" | "apns" | "apns-sandbox" | "noop";
    enableEncrypted?: boolean;
  };
}
export abstract class IEcho {
  public abstract readonly context: string;
  constructor(public projectId: string, public logger: Logger) {}

  public abstract registerDeviceToken(params: EchoTypes.RegisterDeviceTokenParams): Promise<void>;
}
