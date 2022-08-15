export function shim() {
  if (typeof TextEncoder === "undefined" || typeof TextDecoder === "undefined") {
    require("fast-text-encoding");
  }
}
