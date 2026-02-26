const memoryStore: Record<string, any> = {};

export abstract class MemoryStore {
  static get<T = unknown>(key: string) {
    return memoryStore[key] as T | undefined;
  }

  static set(key: string, value: unknown) {
    memoryStore[key] = value;
  }

  static delete(key: string) {
    delete memoryStore[key];
  }
}
