/**
 * Common.Auth.TokenStorage
 *
 * Utilities for generating, retrieving and modifying one-time tokens persisted via
 * the Common.Data.Storage.SpreadsheetManager "Tokens" fiddler.
 *
 * Side effects:
 * - Reads and writes the "Tokens" fiddler.
 * - Persists changes by calling .setData(...).dumpValues().
 *
 * @namespace Common.Auth.TokenStorage
 */

/**
 * Represents a stored token entry.
 *
 * @typedef {Object} TokenEntry
 * @property {string} Email - The email address associated with the token.
 * @property {string} Token - The one-time token string.
 * @property {Date} Timestamp - When the token was created.
 * @property {boolean} Used - Whether the token has been consumed.
 */

/** @ts-check */
Common.Auth.TokenStorage = {
    /**
     * @function
     * Generate and store a new token for the given email.
     * @param {string} email - The email address to associate with the token.
     * @returns {string} The generated token.
     */
    generateAndStoreToken: function(email){
        const token = Common.Auth.TokenManager.generateToken();
        const newEntry = {
            Email: email,
            Token: token,
            Timestamp: new Date(),
            Used: false
        }
        const tokenFiddler = Common.Data.Storage.SpreadsheetManager.getFiddler('Tokens');
        const tokens = tokenFiddler.getData();
        tokens.push(newEntry)
        tokenFiddler.setData(tokens).dumpValues();
        return token
    },
    /**
     * Retrieve all token entries from the persistent "Tokens" fiddler.
     *
     * @function
     * @name getTokenData
     * @memberof Common.Auth.TokenStorage
     * @returns {TokenEntry[]} Array of TokenEntry objects currently stored.
     */
    getTokenData: function ()  {
        const tokenData = Common.Data.Storage.SpreadsheetManager.getFiddler('Tokens').getData();
        return tokenData;
    },
    /**
     * Consume a token by marking it as used.
     *
     * @param {string} token - The token string to consume.
     * @returns {TokenDataType | undefined} A copy of the token data if found, otherwise undefined.
     * The underlying token entry is marked as used if it was found and not already used.
     */
    consumeToken:function (token) {
        const tokenFiddler = Common.Data.Storage.SpreadsheetManager.getFiddler('Tokens');
        const tokens = tokenFiddler.getData();
        const td = tokens.find((tokenData) => tokenData.Token === token)
        const tokenToBeReturned = td ? { ...td } : undefined; // Return a copy to avoid external mutation
        if (td && !td.Used) {
            td.Used = true;
            tokenFiddler.setData(tokens).dumpValues();
        }
        return tokenToBeReturned
    },
    /**
     * Delete one or more tokens from storage.
     *
     * The implementation:
     * - Loads the token list from the "Tokens" fiddler.
     * - Filters out entries whose Token is included in the provided tokensToDelete array.
     * - Persists the filtered list.
     *
     * @function
     * @name deleteTokens
     * @memberof Common.Auth.TokenStorage
     * @param {string[]} tokensToDelete - Array of token strings to remove from storage.
     * @returns {void}
     */
    deleteTokens: function (tokensToDelete) {
        const tokenFiddler = Common.Data.Storage.SpreadsheetManager.getFiddler('Tokens');
        let tokens = tokenFiddler.getData();
        tokens = tokens.filter((tokenData) => !tokensToDelete.includes(tokenData.Token));
        tokenFiddler.setData(tokens).dumpValues();
    }
}

