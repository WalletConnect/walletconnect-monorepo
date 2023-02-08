export type NetworkEvent = "online" | "offline";

export interface INetworkMonitor {
  on: (event: NetworkEvent, callback: () => void) => void;
}

export interface INetworkEventEmitter {
  event: NetworkEvent;
  callback: () => void;
}
