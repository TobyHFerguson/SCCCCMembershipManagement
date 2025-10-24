/**
 * Represents a voting token data object.
 */
interface VotingTokenData {
    Email: string;
    Token: string;
    Timestamp: Date;
    Used: boolean;
}

/**
 * Auth service for voting token management.
 */
declare namespace VotingService {
    namespace Auth {
        /**
         * Generates a unique token for the given email and spreadsheetId, stores it, and returns the token data.
         * @param email The email address to associate with the token.
         * @param spreadsheetId The spreadsheet ID for context.
         * @returns Token data object.
         */
        function generateAndStoreToken(email: string, spreadsheetId: string): VotingTokenData;

        /**
         * Creates a key for storing tokens in ScriptProperties.
         * @param spreadsheetId The spreadsheet ID.
         * @returns The key string.
         */
        function createKey_(spreadsheetId: string): string;

        /**
         * Retrieves and consumes (marks as used) the token data for the given token string.
         * If the token is found and not already used, it is marked as used and returned.
         * If not found or already used, returns undefined.
         * @param token The token string.
         * @param spreadsheetId The spreadsheet ID.
         * @returns Token data object if found and marked as used, otherwise undefined.
         */
        function consumeToken(token: string, spreadsheetId: string): VotingTokenData | undefined;

        /**
         * Deletes all tokens for the given spreadsheet ID.
         * @param spreadsheetId The spreadsheet ID.
         */
        function deleteAllTokens(spreadsheetId: string): void;

        /**
         * Retrieves all tokens for the given spreadsheet ID.
         * @param spreadsheetId The spreadsheet ID.
         * @returns {VotingTokenData[]} Array of all token data objects.
         */
        function getAllTokens(spreadsheetId: string): VotingTokenData[];
    }
}
