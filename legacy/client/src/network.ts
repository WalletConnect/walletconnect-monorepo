import { NetworkEvent, INetworkEventEmitter, INetworkMonitor } from "@walletconnect/legacy-types";

// -- NetworkMonitor --------------------------------------------------------- //

class NetworkMonitor implements INetworkMonitor {
  private _eventEmitters: INetworkEventEmitter[];

  constructor() {
    this._eventEmitters = [];

    if (typeof window !== "undefined" && typeof (window as any).addEventListener !== "undefined") {
      window.addEventListener("online", () => this.trigger("online"));
      window.addEventListener("offline", () => this.trigger("offline"));
    }
  }

  public on(event: NetworkEvent, callback: () => void): void {
    this._eventEmitters.push({
      event,
      callback,
    });
  }

  public trigger(event: NetworkEvent): void {
    let eventEmitters: INetworkEventEmitter[] = [];

    if (event) {
      eventEmitters = this._eventEmitters.filter(
        (eventEmitter: INetworkEventEmitter) => eventEmitter.event === event,
      );
    }

    eventEmitters.forEach((eventEmitter: INetworkEventEmitter) => {
      eventEmitter.callback();
    });
  }
}

export default NetworkMonitor;
