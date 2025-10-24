/**
 * Represents a token entry stored in the Tokens sheet.
 */
declare interface TokenDataType {
    Email: string;
    Token: string;
    Timestamp: Date;
    Used: boolean;
}

/**
 * TokenStorage service for managing tokens.
 */
declare namespace Common {
    namespace Auth {
        namespace TokenStorage {
            /**
             * Stores a token for the given email.
             * @param {string} email - The email address.
             */
            function generateAndStoreToken(email: string): string;

            /**
             * Retrieves all token data.
             * @returns {TokenDataType[]} Array of token entries.
             */
            function getTokenData(): TokenDataType[];

            /**
             * Marks a token as used.
             * @param {string} token - The token to mark as used.
             * @return {string | null} The email associated with the token if found and marked as used, otherwise null.
             */
            function consumeToken(token: string): string | null;

            /**
             * Deletes tokens from storage.
             * @param {string[]} tokensToDelete - Array of tokens to delete.
             */
            function deleteTokens(tokensToDelete: string[]): void;
        }
        namespace TokenManager {
            /**
             * Generates a new unique token.
             * @returns {string} The generated token.
             */
            function generateToken(): string;
            /**
             * 
             * @param email - The email address to get a token for.
             * @returns A multi-use token associated with the email.
             */
            function getMultiUseToken(email: string): string;
            
        }
    }
}
