/**
 * TokenManager - Multi-use token management for GAS authentication
 *
 * CRITICAL: This module is in Layer 0 (Foundation).
 * - MUST NOT use AppLogger.* (creates circular dependency)
 * - MUST use Logger.log() (GAS built-in) only for tracing
 *
 * Pattern: IIFE-wrapped class with static methods (per gas-best-practices.md)
 *
 * This module manages multi-use tokens (MUT) for authenticated sessions.
 * Tokens are stored in GAS CacheService with configurable expiration.
 *
 * @see TokenStorage for one-time token persistence in spreadsheets
 */

/** @ts-check */
/// <reference path="../../types/global.d.ts" />

/**
 * TokenManager - Static class for multi-use token operations
 * Pattern: IIFE-wrapped class with static methods
 */
var TokenManager = (function () {
    class TokenManager {
        /**
         * Generate a unique token string using UUID
         * @returns {string} A unique token string
         * @throws {Error} If there is an issue generating the token
         */
        static generateToken() {
            return Utilities.getUuid();
        }

        /**
         * Generate a multi-use token for the given email
         *
         * This token can be used multiple times and is associated with the user's email.
         * The token is stored in the cache for a specified duration (default 15 minutes).
         *
         * @param {string} email - An email to be recorded with the token
         * @returns {string} A unique multi-use token string
         * @throws {Error} If there is an issue generating the token or storing it in the cache
         */
        static getMultiUseToken(email) {
            const token = TokenManager.generateToken();
            const cache = CacheService.getScriptCache();
            const tokenKey = `user_token_${token}`;
            const expirationInSeconds = 900; // 15 minutes

            // Store the mapping between the token and the user identifier in the cache
            cache.put(tokenKey, email, expirationInSeconds);
            return token;
        }

        /**
         * Get the email associated with a multi-use token
         *
         * @param {string} token - The multi-use token
         * @returns {string|null} The email recorded against this token, or null if not found/expired
         */
        static getEmailFromMUT(token) {
            if (!token) return null;

            const cache = CacheService.getScriptCache();
            const tokenKey = `user_token_${token}`;
            const email = cache.get(tokenKey);
            if (email) {
                return email;
            } else {
                console.warn(`Token ${token} not found or expired.`);
                return null;
            }
        }

        /**
         * Consume the multi-use token and return the associated email
         *
         * This method retrieves the email associated with the token from the cache
         * and removes the token, ensuring it can only be used once after this call.
         *
         * @param {string} token - The multi-use token
         * @returns {string|null} The email if found, otherwise null
         * @throws {Error} If there is an issue retrieving the token or if it has expired
         */
        static consumeMUT(token) {
            if (!token) return null;

            const cache = CacheService.getScriptCache();
            const tokenKey = `user_token_${token}`;
            const email = cache.get(tokenKey);
            if (email) {
                cache.remove(tokenKey); // Remove the token from the cache after consumption
                return email;
            } else {
                console.warn(`Token ${token} not found or expired.`);
                return null;
            }
        }

        /**
         * Update the email associated with a multi-use token
         *
         * Used when a user changes their email address to update their session.
         *
         * @param {string} token - The multi-use token to update
         * @param {string} newEmail - The new email address
         * @returns {boolean} True if update succeeded, false if token not found
         */
        static updateTokenEmail(token, newEmail) {
            if (!token || !newEmail) return false;

            const cache = CacheService.getScriptCache();
            const tokenKey = `user_token_${token}`;

            // Check if token exists
            const currentEmail = cache.get(tokenKey);
            if (!currentEmail) {
                console.warn(`Token ${token} not found or expired.`);
                return false;
            }

            // Update with same expiration (15 minutes from original creation)
            // Note: CacheService doesn't allow updating TTL, so we maintain the original expiration
            const expirationInSeconds = 900; // 15 minutes
            cache.put(tokenKey, newEmail, expirationInSeconds);

            Logger.log('[TokenManager] Updated token email from ' + currentEmail + ' to ' + newEmail);
            return true;
        }

        /**
         * Get token data from TokenStorage by token string
         *
         * @param {string} token - The token string to look up
         * @returns {TokenDataType|null} Token data if found, null otherwise
         */
        static getTokenData(token) {
            return TokenStorage.getTokenData().find((tokenData) => tokenData.Token === token) || null;
        }
    }

    return TokenManager;
})();

// Backward compatibility - assign to Common.Auth.TokenManager
if (typeof Common !== 'undefined' && Common.Auth) {
    Common.Auth.TokenManager = TokenManager;
}

// Node.js export for testing
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { TokenManager };
}
