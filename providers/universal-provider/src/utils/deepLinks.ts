import { SignClient } from "@walletconnect/sign-client";
import { SignClientTypes } from "@walletconnect/types";
import { RequestParams } from "../types";

export const handleDeepLinks = (client: InstanceType<typeof SignClient>, params: RequestParams) => {
  const handleSessionRequestSent = (
    payload: SignClientTypes.EventArguments["session_request_sent"],
  ) => {
    // only handle the request if it matches the request and topic
    if (payload.request !== params.request || payload.topic !== params.topic) return;
    client.events.removeListener("session_request_sent", handleSessionRequestSent);
    deeplinkRedirect();
  };
  client.on("session_request_sent", handleSessionRequestSent);
};

export function deeplinkRedirect() {
  if (typeof window !== "undefined") {
    try {
      const item = window.localStorage.getItem("WALLETCONNECT_DEEPLINK_CHOICE");
      if (item) {
        const json = JSON.parse(item);
        window.open(json.href, "_self", "noreferrer noopener");
      }
    } catch (err) {
      // Silent error, just log in console
      // eslint-disable-next-line no-console
      console.error(err);
    }
  }
}
