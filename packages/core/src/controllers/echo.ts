import { generateChildLogger, Logger } from "@walletconnect/logger";
import { IEchoClient } from "@walletconnect/types";
import { ECHO_CONTEXT, ECHO_URL } from "../constants/index.js";

export class EchoClient extends IEchoClient {
  public readonly context = ECHO_CONTEXT;
  constructor(
    public projectId: string,
    public logger: Logger,
  ) {
    super(projectId, logger);
    this.logger = generateChildLogger(logger, this.context);
  }

  public registerDeviceToken: IEchoClient["registerDeviceToken"] = async (params) => {
    const { clientId, token, notificationType, enableEncrypted = false } = params;

    const echoUrl = `${ECHO_URL}/${this.projectId}/clients`;

    await fetch(echoUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        client_id: clientId,
        type: notificationType,
        token,
        always_raw: enableEncrypted,
      }),
    });
  };
}
