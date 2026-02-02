/**
 * TokenStorage - One-time token storage via SheetAccess
 *
 * CRITICAL: This module is in Layer 0 (Foundation).
 * - MUST NOT use AppLogger.* (creates circular dependency)
 * - MUST use Logger.log() (GAS built-in) only for tracing
 *
 * Pattern: IIFE-wrapped class with static methods (per gas-best-practices.md)
 *
 * This module handles persistent token storage in Google Sheets via the
 * SheetAccess abstraction layer.
 *
 * Side effects:
 * - Reads and writes the "Tokens" sheet
 * - Persists changes automatically via SheetAccess.setData()
 *
 * @see TokenManager for multi-use token caching in CacheService
 */

/** @ts-check */
/// <reference path="../../types/global.d.ts" />

/**
 * Represents a stored token entry
 * @typedef {Object} TokenEntry
 * @property {string} Email - The email address associated with the token
 * @property {string} Token - The one-time token string
 * @property {Date} Timestamp - When the token was created
 * @property {boolean} Used - Whether the token has been consumed
 */

/**
 * TokenStorage - Static class for one-time token persistence
 * Pattern: IIFE-wrapped class with static methods
 */
var TokenStorage = (function () {
    class TokenStorage {
        /**
         * Generate and store a new token for the given email
         *
         * @param {string} email - The email address to associate with the token
         * @returns {string} The generated token
         */
        static generateAndStoreToken(email) {
            const token = TokenManager.generateToken();
            const newEntry = {
                Email: email,
                Token: token,
                Timestamp: new Date(),
                Used: false,
            };
            const tokens = SheetAccess.getData('Tokens');
            tokens.push(newEntry);
            SheetAccess.setData('Tokens', tokens);
            return token;
        }

        /**
         * Retrieve all token entries from the persistent "Tokens" sheet
         *
         * @returns {TokenEntry[]} Array of TokenEntry objects currently stored
         */
        static getTokenData() {
            const tokenData = SheetAccess.getData('Tokens');
            return tokenData;
        }

        /**
         * Consume a token by marking it as used
         *
         * @param {string} token - The token string to consume
         * @returns {TokenDataType|undefined} A copy of the token data if found, otherwise undefined
         * The underlying token entry is marked as used if it was found and not already used.
         */
        static consumeToken(token) {
            const tokens = SheetAccess.getData('Tokens');
            const td = tokens.find((tokenData) => tokenData.Token === token);
            const tokenToBeReturned = td ? { ...td } : undefined; // Return a copy to avoid external mutation
            if (td && !td.Used) {
                td.Used = true;
                SheetAccess.setData('Tokens', tokens);
            }
            return tokenToBeReturned;
        }

        /**
         * Delete one or more tokens from storage
         *
         * Loads the token list from the "Tokens" sheet,
         * filters out entries whose Token is included in the provided array,
         * and persists the filtered list.
         *
         * @param {string[]} tokensToDelete - Array of token strings to remove from storage
         * @returns {void}
         */
        static deleteTokens(tokensToDelete) {
            let tokens = SheetAccess.getData('Tokens');
            tokens = tokens.filter((tokenData) => !tokensToDelete.includes(tokenData.Token));
            SheetAccess.setData('Tokens', tokens);
        }
    }

    return TokenStorage;
})();
// Node.js export for testing
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { TokenStorage };
}
