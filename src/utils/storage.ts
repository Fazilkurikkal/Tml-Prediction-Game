class SafeStorage {
  private memoryStore: Record<string, string> = {};
  private isAvailable: boolean = false;

  constructor() {
    try {
      if (typeof window !== 'undefined' && 'localStorage' in window) {
        const testKey = '__storage_test__';
        window.localStorage.setItem(testKey, testKey);
        window.localStorage.removeItem(testKey);
        this.isAvailable = true;
      }
    } catch (e) {
      this.isAvailable = false;
    }
  }

  getItem(key: string): string | null {
    if (this.isAvailable) {
      try {
        return window.localStorage.getItem(key);
      } catch (e) {
        // fallback
      }
    }
    return this.memoryStore[key] !== undefined ? this.memoryStore[key] : null;
  }

  setItem(key: string, value: string): void {
    if (this.isAvailable) {
      try {
        window.localStorage.setItem(key, value);
        return;
      } catch (e) {
        // fallback
      }
    }
    this.memoryStore[key] = value;
  }

  removeItem(key: string): void {
    if (this.isAvailable) {
      try {
        window.localStorage.removeItem(key);
        return;
      } catch (e) {
        // fallback
      }
    }
    delete this.memoryStore[key];
  }

  clear(): void {
    if (this.isAvailable) {
      try {
        window.localStorage.clear();
        return;
      } catch (e) {
        // fallback
      }
    }
    this.memoryStore = {};
  }
}

export const safeStorage = new SafeStorage();
