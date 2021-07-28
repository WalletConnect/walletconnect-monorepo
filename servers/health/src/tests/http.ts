import axios from "axios";
import https from "https";
import { isLocalhostUrl } from "@walletconnect/jsonrpc-utils";
import { getHttpUrl } from "../utils";

export async function isServerAvailable(url: string): Promise<boolean> {
  let isAlive = false;
  try {
    const httpUrl = getHttpUrl(url);
    const res = await axios.get(`${httpUrl}/health`, {
      httpsAgent: new https.Agent({ rejectUnauthorized: isLocalhostUrl(httpUrl) }),
    });
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
    const res = await axios.get(`${httpUrl}/mode`, {
      httpsAgent: new https.Agent({ rejectUnauthorized: isLocalhostUrl(httpUrl) }),
    });
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
