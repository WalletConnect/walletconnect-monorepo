import { SignClient as Client } from "./client.js";

export { SIGN_V3_DEFAULT_RELAY, SignV3Error, type SignClientV3Options } from "./client.js";
export { SIGN_V3_WASM_SOURCE } from "./wasm/wasm-data.js";

export const SignClient = Client;
export default Client;
