// google-apps-script.ts
// A simple in-memory store for properties
const mockProperties = new Map<string, string>();

// Mock the PropertiesService
global.PropertiesService = {
    getScriptProperties: () => ({
        getProperty: (key: string) => mockProperties.get(key) || null,
        setProperty: (key: string, value: string) => {
            mockProperties.set(key, value);
            return null as any;
        },
        deleteAllProperties: () => {
            mockProperties.clear();
            return null as any;
        },
        // You can add more mock methods here if your code uses them
        getProperties: () => Object.fromEntries(mockProperties),
        deleteProperty: (key: string) => {
            mockProperties.delete(key);
            return null as any;
        },
        setProperties: (props: Record<string, string>) => {
            for (const [key, value] of Object.entries(props)) {
                mockProperties.set(key, value);
            }
            return null as any;
        },
    }) as any, // Cast to any to bypass strict type checking
    getUserProperties: () => ({} as any),
    getDocumentProperties: () => ({} as any),
};

// Mock Utilities.getUuid() to return a predictable value for testing
global.Utilities = {
    getUuid: () => 'mocked-uuid-123',
    // Add other utility methods if needed
} as any;

// Mock AppLogger (flat class pattern - replaces Common.Logger)
// Named AppLogger to avoid conflict with GAS built-in Logger
(global as any).AppLogger = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    configure: jest.fn(),
    setLevel: jest.fn(),
    getLogs: jest.fn(() => []),
    clearLogs: jest.fn(),
    setContainerSpreadsheet: jest.fn(),
} as any;

// Mock GAS built-in Logger (different from our AppLogger)
(global as any).Logger = {
    log: jest.fn(),
    clear: jest.fn(),
    getLog: jest.fn(() => ''),
} as any;

// Mock MailApp
(global as any).MailApp = {
    sendEmail: jest.fn(),
    getRemainingDailyQuota: jest.fn(() => 100),
} as any;

// ApiClient and ApiClientManager are declared in global.d.ts
// In GAS runtime, they are loaded from ApiClient.js
// In tests, we need to load the actual implementation
const ApiClientModule = require('../src/common/api/ApiClient');
(global as any).ApiClient = ApiClientModule.ApiClient;
(global as any).ApiClientManager = ApiClientModule.ClientManager;

// Mock Common namespace (backward compatibility for Common.Logger)
(global as any).Common = (global as any).Common || {};
(global as any).Common.Logger = (global as any).AppLogger;
(global as any).Common.Api = (global as any).Common.Api || {};
(global as any).Common.Api.Client = (global as any).ApiClient;
(global as any).Common.Api.ClientManager = (global as any).ApiClientManager;