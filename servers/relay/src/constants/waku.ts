export const WAKU_POLLING_INTERVAL = 1000;

export const WAKU_DEFAULT_PAGE_SIZE = 500; // The smaller the page the more libp2p connections get made.

export const WAKU_PUBSUB_TOPIC = "6d9b0b4b9994e8a6afbd3dc3ed983cd51c755afb27cd1dc7825ef59c134a39f7";

export const WAKU_CONTEXT = "waku";

export const WAKU_JSONRPC = {
  get: {
    relay: {
      messages: "get_waku_v2_relay_v1_messages",
    },
    filter: {
      messages: "get_waku_v2_filter_v1_messages",
    },
    store: {
      messages: "get_waku_v2_store_v1_messages",
    },
    admin: {
      peers: "get_waku_v2_admin_v1_peers",
    },
    debug: {
      info: "get_waku_v2_debug_v1_info",
    },
  },
  post: {
    relay: {
      message: "post_waku_v2_relay_v1_message",
      subscriptions: "post_waku_v2_relay_v1_subscriptions",
    },
    filter: {
      subscription: "post_waku_v2_filter_v1_subscription",
    },
  },
  delete: {
    relay: {
      subscription: "delete_waku_v2_relay_v1_subscription",
    },
    filter: {
      subscription: "delete_waku_v2_filter_v1_subscription",
    },
  },
};
