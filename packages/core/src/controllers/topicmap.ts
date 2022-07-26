import { ISubscriberTopicMap } from "@walletconnect/types";

export class SubscriberTopicMap implements ISubscriberTopicMap {
  public map = new Map<string, string[]>();

  get topics(): string[] {
    return Array.from(this.map.keys());
  }

  public set: ISubscriberTopicMap["set"] = (topic, id) => {
    const ids = this.get(topic);
    if (this.exists(topic, id)) return;
    this.map.set(topic, [...ids, id]);
  };

  public get: ISubscriberTopicMap["get"] = (topic) => {
    const ids = this.map.get(topic);
    return ids || [];
  };

  public exists: ISubscriberTopicMap["exists"] = (topic, id) => {
    const ids = this.get(topic);
    return ids.includes(id);
  };

  public delete: ISubscriberTopicMap["delete"] = (topic, id) => {
    if (typeof id === "undefined") {
      this.map.delete(topic);
      return;
    }
    if (!this.map.has(topic)) return;
    const ids = this.get(topic);
    if (!this.exists(topic, id)) return;
    const remaining = ids.filter((x) => x !== id);
    if (!remaining.length) {
      this.map.delete(topic);
      return;
    }
    this.map.set(topic, remaining);
  };

  public clear: ISubscriberTopicMap["clear"] = () => {
    this.map.clear();
  };
}
