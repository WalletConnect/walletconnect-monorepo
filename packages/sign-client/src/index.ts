import { SignClient as Client } from "./client.js";
import { Session } from "./controllers/session.js";
export * from "./constants/index.js";
export { SignV3Error } from "./v3/client.js";
export {
  AppSignatureRefusedError,
  APP_SIGNATURE_REFUSALS,
  type AppSignatureRefusal,
} from "./verification.js";
export { SIGN_V3_WASM_SOURCE } from "./v3/wasm/wasm-data.js";

export const SessionStore = Session;
export const SignClient = Client;
export default Client;
