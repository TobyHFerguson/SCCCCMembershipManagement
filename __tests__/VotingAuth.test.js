const { Auth } = require("../src/services/VotingService/Auth");

describe('VotingService.Auth', () => {
    describe('generateAndStoreToken', () => {
        beforeEach(() => {
            PropertiesService.getScriptProperties().deleteAllProperties();
        });
        it('generates and stores a token', () => {
            const email = 'test@example.com';
            const spreadsheetId = 'spreadsheetId';
            const tokenData = Auth.generateAndStoreToken(email, spreadsheetId);
            expect(tokenData).toHaveProperty('Token');
            expect(tokenData).toHaveProperty('Email', email);
            expect(tokenData).toHaveProperty('Timestamp');
            expect(tokenData).toHaveProperty('Used', false);
        });
    });
    describe('consumeToken', () => {
        beforeEach(() => {
            PropertiesService.getScriptProperties().deleteAllProperties();
        });
        it('consumes a token', () => {
            const email = 'test@example.com';
            const spreadsheetId = 'spreadsheetId';
            const tokenData = Auth.generateAndStoreToken(email, spreadsheetId);
            let consumedToken = Auth.consumeToken(tokenData.Token, spreadsheetId);
            expect(consumedToken).toEqual(JSON.parse(JSON.stringify(tokenData))); // Deep equality check
            consumedToken = Auth.consumeToken(tokenData.Token, spreadsheetId);
            expect(consumedToken.Used).toBe(true);
        });
    });
    describe('deleteAllTokens', () => {
        beforeEach(() => {
            PropertiesService.getScriptProperties().deleteAllProperties();
        });
        it('deletes all tokens for a spreadsheetId', () => {
            const email = 'test@example.com';
            const spreadsheetId = 'spreadsheetId';
            const tokenData = Auth.generateAndStoreToken(email, spreadsheetId);
            Auth.deleteAllTokens(spreadsheetId);
            const consumeTokenCall = () => {
                Auth.consumeToken(tokenData.Token, spreadsheetId);
            };
            // Expect that the function call will throw an error
            expect(consumeTokenCall).toThrow();
        });
    });
});