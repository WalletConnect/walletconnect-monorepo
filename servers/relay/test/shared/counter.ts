export class Counter {
  private count = 0;
  constructor(public label = "") {}
  get value() {
    return this.count;
  }
  public tick() {
    this.count += 1;
  }
}
