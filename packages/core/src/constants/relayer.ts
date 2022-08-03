import { ONE_SECOND } from "@walletconnect/time";

export const RELAYER_DEFAULT_PROTOCOL = "irn";

export const RELAYER_DEFAULT_LOGGER = "error";

export const RELAYER_DEFAULT_RELAY_URL = "wss://relay.walletconnect.com";

export const RELAYER_CONTEXT = "relayer";

export const RELAYER_EVENTS = {
  message: "relayer_message",
  connect: "relayer_connect",
  disconnect: "relayer_disconnect",
  error: "relayer_error",
};

export const RELAYER_SUBSCRIBER_SUFFIX = "_subscription";

export const RELAYER_PROVIDER_EVENTS = {
  payload: "payload",
  connect: "connect",
  disconnect: "disconnect",
  error: "error",
};

export const RELAYER_RECONNECT_TIMEOUT = ONE_SECOND;

export const RELAYER_STORAGE_OPTIONS = {
  database: ":memory:",
};

// FIXME: Always manually change this after each release (hardcoded from package.json)
// ... this will be temporarily hardcoded until we refactor our build chain!
export const RELAYER_SDK_VERSION = "2.0.0-rc.1";
