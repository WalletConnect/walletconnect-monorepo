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

export const RELAYER_SDK_VERSION = "2.26.0";

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

export const RELAYER_HTTP_ROUTES = {
  events: "/v3/events",
  sessionProposals: "/sessionProposals",
  sessionApprovals: "/sessionApprovals",
  messages: "/topics/{topic}/messages",
};

export const RELAYER_HTTP_EVENT_MESSAGE = "message_v2.received";

export const RELAYER_HTTP_FIRST_LINE_TIMEOUT = 10_000;

export const RELAYER_HTTP_STALE_TIMEOUT = 6_000;

export const RELAYER_HTTP_REQUEST_TIMEOUT = 30_000;

export const RELAYER_HTTP_MAX_CONCURRENT_SENDS = 4;

export const RELAYER_HTTP_NOT_MEMBER_ERROR = "not_member";

export const RELAYER_HTTP_NOT_MEMBER_RETRIES = 5;

// relay errors that end a publish for good
export const RELAYER_FINAL_ERRORS = [
  "blocked",
  // Verify v4: the relay refused the message's App Signature, or its lack of one. Sending the same
  // message again gets the same answer.
  "app_signature_required",
  "invalid_app_signature",
];
