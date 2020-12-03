export interface Timestamp {
  started: number;
  elapsed?: number;
}

export class Time {
  public timestamps = new Map<string, Timestamp>();

  public start(label: string) {
    if (this.timestamps.has(label)) {
      throw new Error(`Timestamp already started for label: ${label}`);
    }
    this.timestamps.set(label, { started: Date.now() });
  }

  public stop(label: string) {
    const timestamp = this.get(label);
    if (typeof timestamp.elapsed !== "undefined") {
      throw new Error(`Timestamp already stopped for label: ${label}`);
    }
    const elapsed = Date.now() - timestamp.started;
    this.timestamps.set(label, { started: timestamp.started, elapsed });
  }

  public get(label: string): Timestamp {
    const timestamp = this.timestamps.get(label);
    if (typeof timestamp === "undefined") {
      throw new Error(`No timestamp found for label: ${label}`);
    }
    return timestamp;
  }

  public elapsed(label: string): number {
    const timestamp = this.get(label);
    const elapsed = timestamp.elapsed || Date.now() - timestamp.started;
    return elapsed;
  }
}
