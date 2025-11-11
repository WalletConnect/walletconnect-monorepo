import { Core as WalletConnectCore } from "./core.js";

export const Core = WalletConnectCore;
export default WalletConnectCore;

export { Store } from "./controllers/store.js";

export {
  EVENT_CLIENT_AUTHENTICATE_ERRORS,
  EVENT_CLIENT_AUTHENTICATE_TRACES,
  EVENT_CLIENT_PAIRING_ERRORS,
  EVENT_CLIENT_PAIRING_TRACES,
  EVENT_CLIENT_SESSION_ERRORS,
  EVENT_CLIENT_SESSION_TRACES,
} from "./constants/events.js";

export { EXPIRER_EVENTS } from "./constants/expirer.js";
export { PAIRING_EVENTS } from "./constants/pairing.js";

export { RELAYER_DEFAULT_PROTOCOL, RELAYER_EVENTS, TRANSPORT_TYPES } from "./constants/relayer.js";

export { VERIFY_SERVER } from "./constants/verify.js";
export { CORE_STORAGE_PREFIX } from "./constants/core.js";
