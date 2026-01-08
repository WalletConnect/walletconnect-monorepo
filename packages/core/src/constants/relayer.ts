export const RELAYER_DEFAULT_PROTOCOL = "irn";

export const RELAYER_DEFAULT_LOGGER = "error";

export const RELAYER_DEFAULT_RELAY_URL = "wss://relay.walletconnect.org";

export const RELAYER_CONTEXT = "relayer";

export const RELAYER_EVENTS = {
  message: "relayer_message",
  message_ack: "relayer_message_ack",
  connect: "relayer_connect",
  disconnect: "relayer_disconnect",
  error: "relayer_error",
  connection_stalled: "relayer_connection_stalled",
  transport_closed: "relayer_transport_closed",
  publish: "relayer_publish",
};

export const RELAYER_SUBSCRIBER_SUFFIX = "_subscription";

export const RELAYER_PROVIDER_EVENTS = {
  payload: "payload",
  connect: "connect",
  disconnect: "disconnect",
  error: "error",
};

export const RELAYER_RECONNECT_TIMEOUT = 0.1;

export const RELAYER_STORAGE_OPTIONS = {
  database: ":memory:",
};

// Updated automatically via `new-version` npm script.

export const RELAYER_SDK_VERSION = "2.23.1";

// delay to wait before closing the transport connection after init if not active
export const RELAYER_TRANSPORT_CUTOFF = 10_000;

export const TRANSPORT_TYPES = {
  link_mode: "link_mode",
  relay: "relay",
} as const;

export const MESSAGE_DIRECTION = {
  inbound: "inbound",
  outbound: "outbound",
} as const;
