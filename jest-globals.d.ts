// jest-globals.d.ts

declare namespace NodeJS {
    interface Global {
        PropertiesService: {
            getScriptProperties: () => {
                getProperty(key: string): string | null;
                setProperty(key: string, value: string): void;
                deleteAllProperties(): void;
                // Add any other methods you've mocked
            };
            getUserProperties: () => {
                getProperty(key: string): string | null;
                setProperty(key: string, value: string): void;
                deleteAllProperties(): void;
            };
            getDocumentProperties: () => {
                getProperty(key: string): string | null;
                setProperty(key: string, value: string): void;
                deleteAllProperties(): void;
            };
    };
Utilities: {
    getUuid(): string;
    // Add other mocked methods
};
        // Validated classes that tests assign to global
        ValidatedBootstrap: typeof ValidatedBootstrap;
        ValidatedPublicGroup: typeof ValidatedPublicGroup;
        ValidatedElectionConfig: typeof ValidatedElectionConfig;
        ValidatedTransaction: typeof ValidatedTransaction;
        // MailApp mock for testing
        MailApp: {
            sendEmail: jest.Mock<any, any>;
            getRemainingDailyQuota?: jest.Mock<any, any>;
        };
        // AppLogger for testing (can be either the real class or a mock object)
        AppLogger: {
            error?: jest.Mock<any, any> | ((...args: any[]) => void);
            warn?: jest.Mock<any, any> | ((...args: any[]) => void);
            info?: jest.Mock<any, any> | ((...args: any[]) => void);
            debug?: jest.Mock<any, any> | ((...args: any[]) => void);
        };
  }
}