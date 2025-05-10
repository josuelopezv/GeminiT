// tests/test-utils/store-helper.ts
import Store from 'electron-store';

export interface TestStoreConfig {
  geminiApiKey?: string;
  geminiModelName?: string;
  initialModelInstruction?: string;
}

// Create a mock Store implementation for testing
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

// Use the real Store in E2E tests, mock in unit tests
const StoreImpl = process.env.E2E_TEST ? Store : MockStore;

export function setupTestStore(config: TestStoreConfig = {}) {
  const store = new StoreImpl();
  store.clear();

  // Set defaults or provided values
  store.set('geminiApiKey', config.geminiApiKey || 'test-api-key');
  store.set('geminiModelName', config.geminiModelName || 'gemini-test-model');
  store.set('initialModelInstruction', config.initialModelInstruction || 'TEST_INSTRUCTION: Default test mode.');

  return store;
}

export function clearTestStore() {
  const store = new StoreImpl();
  store.clear();
}

export function getTestStore() {
  return new StoreImpl();
}
