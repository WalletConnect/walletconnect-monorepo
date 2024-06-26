import { Logger } from "@walletconnect/logger";

export declare namespace EchoClientTypes {
  type RegisterDeviceTokenParams = {
    clientId: string;
    token: string;
    notificationType: "fcm" | "apns" | "apns-sandbox" | "noop";
    enableEncrypted?: boolean;
  };
}
export abstract class IEchoClient {
  public abstract readonly context: string;
  constructor(public projectId: string, public logger: Logger) {}

  public abstract registerDeviceToken(
    params: EchoClientTypes.RegisterDeviceTokenParams,
  ): Promise<void>;
}
