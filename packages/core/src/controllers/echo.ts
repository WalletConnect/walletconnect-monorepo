/* eslint-disable no-console */
import { generateChildLogger, Logger } from "@walletconnect/logger";
import { IEcho } from "@walletconnect/types";
import { ECHO_CONTEXT, ECHO_URL } from "../constants";

export class Echo extends IEcho {
  public readonly context = ECHO_CONTEXT;
  constructor(public projectId: string, public logger: Logger) {
    super(projectId, logger);
    this.logger = generateChildLogger(logger, this.context);
    console.log("Echo constructor called", projectId);
  }

  public registerDeviceToken: IEcho["registerDeviceToken"] = async (params) => {
    const { clientId, token, notificationType, enableAlwaysDecrypted = false } = params;

    const echoUrl = `${ECHO_URL}/${this.projectId}/clients`;

    console.log("register called", params, echoUrl);
    const echoResponse = await fetch(echoUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        client_id: clientId,
        type: notificationType,
        token,
        always_raw: enableAlwaysDecrypted,
      }),
    });
    console.log("echo body", {
      client_id: clientId,
      type: notificationType,
      token,
      always_raw: enableAlwaysDecrypted,
    });

    console.log("echoResponse", echoResponse);
  };
}