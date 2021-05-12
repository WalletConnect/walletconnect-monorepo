import axios from "axios";

export function assertType(obj: any, key: string, type = "string") {
  if (!obj[key] || typeof obj[key] !== type) {
    throw new Error(`Missing or invalid "${key}" param`);
  }
}

export function getHttpUrl(url) {
  return url.replace("wss", "https");
}

export async function isInvalidServer(server) {
  try {
    return (
      (await axios.get(`${getHttpUrl(server)}${server.endsWith("/") ? "" : "/"}health`)).status !==
      204
    );
  } catch (e) {
    throw new Error(`Sever validation error at ${server}`);
  }
}
