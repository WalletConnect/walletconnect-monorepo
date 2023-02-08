import { INetworkMonitor } from "./network";

export interface ITransportLib {
  open: () => void;
  close: () => void;
  send: (message: string, topic?: string, silent?: boolean) => void;
  subscribe: (topic: string) => void;
  on: (event: string, callback: (payload: any) => void) => void;
}

export interface ITransportEvent {
  event: string;
  callback: (payload: any) => void;
}

export interface ISocketMessage {
  topic: string;
  type: string;
  payload: string;
  silent: boolean;
}

export interface ISocketTransportOptions {
  protocol: string;
  version: number;
  url: string;
  netMonitor?: INetworkMonitor;
  subscriptions?: string[];
}
