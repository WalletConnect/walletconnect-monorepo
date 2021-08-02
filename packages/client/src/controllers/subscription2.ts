import { ISubscription } from "@walletconnect/types";

export class Subscription extends ISubscription {
  constructor(public topic: string, public id: string) {}

  public unsubscribe();
}
