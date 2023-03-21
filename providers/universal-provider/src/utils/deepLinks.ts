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
    deeplinkRedirect(params);
  };
  client.on("session_request_sent", handleSessionRequestSent);
};

export function deeplinkRedirect(request: RequestParams) {
  if (typeof window !== "undefined") {
    try {
      const item = window.localStorage.getItem("WALLETCONNECT_DEEPLINK_CHOICE");
      if (item) {
        const json = JSON.parse(item);
        const deeplink = json?.href;
        if (typeof deeplink === "string") {
          if (deeplink.endsWith("/")) deeplink.slice(0, -1);
          const link = `${deeplink}/wc?requestId=${request.id}&sessionTopic=${request.topic}`;
          window.open(link, "_self", "noreferrer noopener");
        }
      }
    } catch (err) {
      // Silent error, just log in console
      // eslint-disable-next-line no-console
      console.error(err);
    }
  }
}
