export class Counter {
  private count = 0;
  constructor(public label = "") {}
  get value() {
    return this.count;
  }
  public add() {
    this.count += 1;
  }
}
