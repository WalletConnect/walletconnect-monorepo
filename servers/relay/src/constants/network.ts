export const NETWORK_POLLING_INTERVAL = 500;

export const NETWORK_RECONNECT_INTERVAL = 2000;

export const NETWORK_DEFAULT_PAGE_SIZE = 500; // The smaller the page the more libp2p connections get made.

export const NETWORK_STORE_CALL_REPEATS = 3;

export const NETWORK_PUBSUB_TOPIC = "/waku/2/walletconnect/proto";

export const NETWORK_CONTEXT = "network";

export const NETWORK_EVENTS = {
  message: "network_message",
};
