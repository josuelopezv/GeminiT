// Mock @google/generative-ai module
jest.mock('@google/generative-ai', () => {
    return {
        GoogleGenerativeAI: jest.fn().mockImplementation(() => ({
            getGenerativeModel: jest.fn().mockReturnValue({
                startChat: jest.fn().mockReturnValue({
                    sendMessage: jest.fn()
                })
            })
        }))
    };
});

// Mock electron-store
jest.mock('electron-store', () => {
    return jest.fn().mockImplementation(() => ({
        get: jest.fn(),
        set: jest.fn(),
        clear: jest.fn(),
        store: {},
        path: 'test-store-path'
    }));
});

// Mock console methods for cleaner test output
global.console = {
    ...console,
    // Uncomment these to disable specific console methods during tests
    // log: jest.fn(),
    // info: jest.fn(),
    // warn: jest.fn(),
    // error: jest.fn(),
};

// Add testing-library jest-dom matchers
import '@testing-library/jest-dom';

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
};

// Mock IntersectionObserver
global.IntersectionObserver = class IntersectionObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
};

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: jest.fn().mockImplementation(query => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: jest.fn(),
        removeListener: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
    })),
});

// Set up fake timers
jest.useFakeTimers();
