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

    // ==================== VotingTokenData type contract tests ====================

    describe('VotingTokenData type contract', () => {
        beforeEach(() => {
            PropertiesService.getScriptProperties().deleteAllProperties();
        });

        test('generateAndStoreToken returns object matching VotingTokenData interface', () => {
            const result = Auth.generateAndStoreToken('test@example.com', 'sheet1');

            // Verify all VotingTokenData properties exist with correct types
            expect(typeof result.Email).toBe('string');
            expect(typeof result.Token).toBe('string');
            expect(result.Timestamp).toBeInstanceOf(Date);
            expect(typeof result.Used).toBe('boolean');

            // Verify no extra/missing properties (exactly 4 keys)
            expect(Object.keys(result).sort()).toEqual(['Email', 'Timestamp', 'Token', 'Used']);
        });

        test('consumeToken returns VotingTokenData when token found', () => {
            const generated = Auth.generateAndStoreToken('test@example.com', 'sheet1');
            const consumed = Auth.consumeToken(generated.Token, 'sheet1');

            // Verify all VotingTokenData properties exist with correct types
            expect(typeof consumed.Email).toBe('string');
            expect(typeof consumed.Token).toBe('string');
            // Timestamp is serialized through JSON, so it comes back as string
            expect(consumed.Timestamp).toBeDefined();
            expect(typeof consumed.Used).toBe('boolean');
        });

        test('consumeToken returns undefined when token not found', () => {
            Auth.generateAndStoreToken('test@example.com', 'sheet1');
            const consumed = Auth.consumeToken('nonexistent-token', 'sheet1');
            expect(consumed).toBeUndefined();
        });

        test('getAllTokens returns array of VotingTokenData objects', () => {
            Auth.generateAndStoreToken('a@example.com', 'sheet1');
            Auth.generateAndStoreToken('b@example.com', 'sheet1');
            const tokens = Auth.getAllTokens('sheet1');

            expect(Array.isArray(tokens)).toBe(true);
            expect(tokens).toHaveLength(2);
            tokens.forEach(token => {
                expect(typeof token.Email).toBe('string');
                expect(typeof token.Token).toBe('string');
                expect(token.Timestamp).toBeDefined();
                expect(typeof token.Used).toBe('boolean');
            });
        });
    });
});