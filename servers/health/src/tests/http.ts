import axios from "axios";

import { getHttpUrl } from "../utils";

export async function isServerAvailable(url: string): Promise<boolean> {
  let isAlive = false;
  try {
    const httpUrl = getHttpUrl(url);
    const res = await axios.get(`${httpUrl}/health`);
    // eslint-disable-next-line
    console.log("isServerAvailable", "res", res.status);
    if (typeof res !== "undefined" && res.status === 204) {
      isAlive = true;
    }
  } catch (e) {
    // do nothing
  }
  return isAlive;
}

export async function isModeSupported(url: string, mode: string): Promise<boolean> {
  let isSupported = false;
  try {
    const httpUrl = getHttpUrl(url);
    const res = await axios.get(`${httpUrl}/mode`);
    // eslint-disable-next-line
    console.log("isModeSupported", "res", res.data);
    if (typeof res !== "undefined") {
      if (res.data.includes("any")) {
        isSupported = true;
      } else if (res.data.includes("jsonrpc") && mode === "jsonrpc") {
        isSupported = true;
      } else if (res.data.includes("legacy") && mode === "legacy") {
        isSupported = true;
      }
    }
  } catch (e) {
    // do nothing
  }
  return isSupported;
}
