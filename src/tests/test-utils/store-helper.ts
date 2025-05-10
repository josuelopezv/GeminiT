// tests/test-utils/store-helper.ts
export interface TestStoreConfig {
  geminiApiKey?: string;
  geminiModelName?: string;
  initialModelInstruction?: string;
}

// Mock Store implementation for unit tests
class MockStore {
  private data: { [key: string]: any } = {};

  constructor() {}

  get(key: string) {
    return this.data[key];
  }

  set(key: string, value: any) {
    this.data[key] = value;
  }

  clear() {
    this.data = {};
  }
}

export function setupTestStore(config: TestStoreConfig = {}) {
  const store = new MockStore();
  store.clear();

  // Set defaults or provided values
  store.set('geminiApiKey', config.geminiApiKey || 'test-api-key');
  store.set('geminiModelName', config.geminiModelName || 'gemini-test-model');
  store.set('initialModelInstruction', config.initialModelInstruction || 'TEST_INSTRUCTION: Default test mode.');

  return store;
}

export function clearTestStore() {
  const store = new MockStore();
  store.clear();
}

export function getTestStore() {
  return new MockStore();
}
