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