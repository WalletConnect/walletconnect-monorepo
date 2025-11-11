import { POSClient as Client } from "./client.js";
import { IPOSClient, type POSClientTypes } from "./types/client.js";

export const POSClient = Client;
export type { IPOSClient, POSClientTypes };

export default Client;
