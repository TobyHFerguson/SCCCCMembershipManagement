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
  }
}