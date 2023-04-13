import { SignClient } from "@walletconnect/sign-client";
import { IKeyValueStorage } from "@walletconnect/keyvaluestorage";
import { SignClientTypes } from "@walletconnect/types";
import { RequestParams } from "../types";
import { ENV_MAP, getEnvironment } from "@walletconnect/utils";

export const handleDeepLinks = (client: InstanceType<typeof SignClient>, params: RequestParams) => {
  const handleSessionRequestSent = (
    payload: SignClientTypes.EventArguments["session_request_sent"],
  ) => {
    // only handle the request if it matches the request and topic
    if (payload.request !== params.request || payload.topic !== params.topic) return;
    client.events.removeListener("session_request_sent", handleSessionRequestSent);
    deeplinkRedirect(params, client.core.storage);
  };
  client.on("session_request_sent", handleSessionRequestSent);
};

export async function deeplinkRedirect(request: RequestParams, store: IKeyValueStorage) {
  try {
    const item = await store.getItem("WALLETCONNECT_DEEPLINK_CHOICE");
    if (!item) return;
    const json = JSON.parse(item);
    const deeplink = json?.href;
    if (typeof deeplink !== "string") return;

    if (deeplink.endsWith("/")) deeplink.slice(0, -1);

    const link = `${deeplink}/wc?requestId=${request.id}&sessionTopic=${request.topic}`;

    const env = getEnvironment();

    if (env === ENV_MAP.browser) {
      window.open(link, "_blank", "noreferrer noopener");
    } else if (env === ENV_MAP.reactNative) {
      const linking = require("react-native").Linking; //.then((m) => m.Linking.openURL(link));
      await linking.openURL(link);
    }
  } catch (err) {
    // Silent error, just log in console
    // eslint-disable-next-line no-console
    console.error(err);
  }
}
