export const EVENT_CLIENT_CONTEXT = "event-client";

export const EVENT_CLIENT_PAIRING_TRACES = {
  pairing_started: "pairing_started",
  pairing_uri_validation_success: "pairing_uri_validation_success",
  pairing_uri_not_expired: "pairing_uri_not_expired",
  store_new_pairing: "store_new_pairing",
  subscribing_pairing_topic: "subscribing_pairing_topic",
  subscribe_pairing_topic_success: "subscribe_pairing_topic_success",
  existing_pairing: "existing_pairing",
  pairing_not_expired: "pairing_not_expired",
  emit_inactive_pairing: "emit_inactive_pairing",
  emit_session_proposal: "emit_session_proposal",
  subscribing_to_pairing_topic: "subscribing_to_pairing_topic",
};

export const EVENT_CLIENT_PAIRING_ERRORS = {
  no_wss_connection: "no_wss_connection",
  no_internet_connection: "no_internet_connection",
  malformed_pairing_uri: "malformed_pairing_uri",
  active_pairing_already_exists: "active_pairing_already_exists",
  subscribe_pairing_topic_failure: "subscribe_pairing_topic_failure",
  pairing_expired: "pairing_expired",
  proposal_expired: "proposal_expired",
  proposal_listener_not_found: "proposal_listener_not_found",
};

export const EVENT_CLIENT_SESSION_TRACES = {
  session_approve_started: "session_approve_started",
  proposal_not_expired: "proposal_not_expired",
  session_namespaces_validation_success: "session_namespaces_validation_success",
  create_session_topic: "create_session_topic",
  subscribing_session_topic: "subscribing_session_topic",
  subscribe_session_topic_success: "subscribe_session_topic_success",
  publishing_session_approve: "publishing_session_approve",
  session_approve_publish_success: "session_approve_publish_success",
  store_session: "store_session",
  publishing_session_settle: "publishing_session_settle",
  session_settle_publish_success: "session_settle_publish_success",
  session_request_response_started: "session_request_response_started",
  session_request_response_validation_success: "session_request_response_validation_success",
  session_request_response_publish_started: "session_request_response_publish_started",
};

export const EVENT_CLIENT_SESSION_ERRORS = {
  no_internet_connection: "no_internet_connection",
  no_wss_connection: "no_wss_connection",
  proposal_expired: "proposal_expired",
  subscribe_session_topic_failure: "subscribe_session_topic_failure",
  session_approve_publish_failure: "session_approve_publish_failure",
  session_settle_publish_failure: "session_settle_publish_failure",
  session_approve_namespace_validation_failure: "session_approve_namespace_validation_failure",
  proposal_not_found: "proposal_not_found",
  session_request_response_validation_failure: "session_request_response_validation_failure",
  session_request_response_publish_failure: "session_request_response_publish_failure",
};

export const EVENT_CLIENT_AUTHENTICATE_TRACES = {
  authenticated_session_approve_started: "authenticated_session_approve_started",
  authenticated_session_not_expired: "authenticated_session_not_expired",
  chains_caip2_compliant: "chains_caip2_compliant",
  chains_evm_compliant: "chains_evm_compliant",
  create_authenticated_session_topic: "create_authenticated_session_topic",
  cacaos_verified: "cacaos_verified",
  store_authenticated_session: "store_authenticated_session",
  subscribing_authenticated_session_topic: "subscribing_authenticated_session_topic",
  subscribe_authenticated_session_topic_success: "subscribe_authenticated_session_topic_success",
  publishing_authenticated_session_approve: "publishing_authenticated_session_approve",
  authenticated_session_approve_publish_success: "authenticated_session_approve_publish_success",
};

export const EVENT_CLIENT_AUTHENTICATE_ERRORS = {
  no_internet_connection: "no_internet_connection",
  no_wss_connection: "no_wss_connection",
  missing_session_authenticate_request: "missing_session_authenticate_request",
  session_authenticate_request_expired: "session_authenticate_request_expired",
  chains_caip2_compliant_failure: "chains_caip2_compliant_failure",
  chains_evm_compliant_failure: "chains_evm_compliant_failure",
  invalid_cacao: "invalid_cacao",
  subscribe_authenticated_session_topic_failure: "subscribe_authenticated_session_topic_failure",
  authenticated_session_approve_publish_failure: "authenticated_session_approve_publish_failure",
  authenticated_session_pending_request_not_found:
    "authenticated_session_pending_request_not_found",
};

export const EVENTS_STORAGE_VERSION = 0.1;

export const EVENTS_STORAGE_CONTEXT = "event-client";

export const EVENTS_STORAGE_CLEANUP_INTERVAL = 86400;

export const EVENTS_CLIENT_API_URL = "https://pulse.walletconnect.org/batch";
