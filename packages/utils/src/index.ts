// Optimized exports - only export what's actually used by core/sign-client/pos-client
// This prevents loading thousands of lines of unused utility code

// CAIP utilities
export { parseChainId } from "./caip.js";

// CACAO utilities (authentication/signatures)
export {
  formatMessage,
  getDidAddress,
  getMethodsFromRecap,
  getChainsFromRecap,
  getNamespacedDidChainId,
  createEncodedRecap,
  mergeEncodedRecaps,
  getRecapFromResources,
  validateSignedCacao,
} from "./cacao.js";

// Crypto utilities
export {
  hashMessage,
  TYPE_1,
  TYPE_2,
  BASE64,
  BASE64URL,
  BASE16,
  BASE10,
  UTF8,
  generateRandomBytes32,
  generateKeyPair,
  deriveSymKey,
  hashKey,
  validateEncoding,
  isTypeTwoEnvelope,
  encodeTypeTwoEnvelope,
  isTypeOneEnvelope,
  encrypt,
  validateDecoding,
  decodeTypeTwoEnvelope,
  decrypt,
  deserialize,
  decodeTypeByte,
  verifyP256Jwt,
} from "./crypto.js";

// Crypto types
export type { P256KeyDataType } from "./crypto.js";

// Errors
export { getInternalError, getSdkError } from "./errors.js";

// Miscellaneous utilities
export {
  calcExpiry,
  createDelayedPromise,
  engineEvent,
  parseExpirerTarget,
  getDeepLink,
  handleDeeplinkRedirect,
  getSearchParamFromURL,
  isReactNative,
  isTestRun,
  LimitedSet,
  getAppId,
  isAndroid,
  isIos,
  isNode,
  uuidv4,
  formatUA,
  getAppMetadata,
  mapToObj,
  objToMap,
  formatIdTarget,
  formatTopicTarget,
  isBrowser,
  formatRelayRpcUrl,
  createExpiringPromise,
  sleep,
  isExpired,
  populateAppMetadata,
} from "./misc.js";

// Namespace utilities
export {
  getNamespacesChains,
  getNamespacesMethods,
  getNamespacesEvents,
  buildNamespacesFromAuth,
  mergeRequiredAndOptionalNamespaces,
} from "./namespaces.js";

// Network utilities
export { isOnline, subscribeToNetworkChange, isAppVisible } from "./network.js";

// Memory store
export { MemoryStore } from "./memoryStore.js";

// Relay utilities
export { getRelayProtocolApi, getRelayProtocolName } from "./relay.js";

// URI utilities
export { formatUri, parseUri, getLinkModeURL } from "./uri.js";

// Validators
export {
  isConformingNamespaces,
  isSessionCompatible,
  isValidController,
  isValidErrorReason,
  isValidEvent,
  isValidId,
  isValidNamespaces,
  isValidNamespacesChainId,
  isValidNamespacesEvent,
  isValidNamespacesRequest,
  isValidObject,
  isValidParams,
  isValidRelay,
  isValidRelays,
  isValidRequest,
  isValidRequestExpiry,
  isValidRequiredNamespaces,
  isValidResponse,
  isValidString,
  isValidUrl,
  isProposalStruct,
  isSessionStruct,
  isValidArray,
  isUndefined,
  isValidChainId,
} from "./validators.js";

// Signature utilities (blockchain-specific)
export {
  extractSolanaTransactionId,
  getSuiDigest,
  getNearTransactionIdFromSignedTransaction,
  getAlgorandTransactionId,
  getSignDirectHash,
  getWalletSendCallsHashes,
} from "./signatures.js";

// Polkadot utilities
export { buildSignedExtrinsicHash } from "./polkadot.js";

// Logger
export { createLogger } from "./logger.js";
