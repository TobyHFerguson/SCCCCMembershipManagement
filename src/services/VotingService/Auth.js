// @ts-ignore
if (typeof require !== 'undefined') {
    VotingService = {
        //@ts-ignore
        Auth: {}
    };
}

VotingService.Auth = {
    /**
     * Generates a unique token for the given email and spreadsheetId, stores it in ScriptProperties,
     * and returns the token data.
     * @param {string} email 
     * @param {string} spreadsheetId 
     * @returns {Object} tokenData with Email, Token, Timestamp, and Used fields.
     */
    generateAndStoreToken: function (email, spreadsheetId) {
        const token = Utilities.getUuid();
        const key = VotingService.Auth.createKey_(spreadsheetId);
        const tokenData = {
            Email: email,
            Token: token,
            Timestamp: new Date(),
            Used: false
        }
        const tokenString = PropertiesService.getScriptProperties().getProperty(key);
        const tokens = tokenString ? JSON.parse(tokenString) : [];
        tokens.push(tokenData);
        PropertiesService.getScriptProperties().setProperty(key, JSON.stringify(tokens));
        return tokenData
    },
    createKey_: function (spreadsheetId) {
        return 'VOTING_TOKEN_' + spreadsheetId;
    },
    /**
     * Retrieves and consumes (marks as used) the token data for the given token string.
     * If the token is found and not already used, it is marked as used and returned.
     * If not found or already used, returns undefined.
     * @param {string} token 
     * @param {string} spreadsheetId
     * @returns {Object | undefined} tokenData if found and marked as used, otherwise undefined.
     */
    consumeToken: function (token, spreadsheetId) {
        const key = VotingService.Auth.createKey_(spreadsheetId);
        const tokenString = PropertiesService.getScriptProperties().getProperty(key);
        if (!tokenString) {
            throw new Error('No tokens found for spreadsheetId: ' + spreadsheetId);
        }
        const tokens = JSON.parse(tokenString);
        const tokenData = tokens.find(t => t.Token === token);
        const tokenToBeReturned = tokenData ? { ...tokenData } : undefined; // Return a copy to avoid external mutation
        if (tokenData && !tokenData.Used) {
            tokenData.Used = true;
            // console.log('Token consumed:', tokenData, 'for key:', key, ' tokens before update:', tokens);
            PropertiesService.getScriptProperties().setProperty(key, JSON.stringify(tokens));
        }
        return tokenToBeReturned;
    },
    deleteAllTokens: function (spreadsheetId) {
        const key = VotingService.Auth.createKey_(spreadsheetId);
        PropertiesService.getScriptProperties().deleteProperty(key);
    },
    /**
    * Retrieves all tokens for the given spreadsheet ID.
     * @param {string} spreadsheetId The spreadsheet ID.
     * @returns {VotingTokenData[]} Array of all token data objects.
     */
    getAllTokens: function (spreadsheetId) {
        const key = VotingService.Auth.createKey_(spreadsheetId);
        const tokenString = PropertiesService.getScriptProperties().getProperty(key);
        return tokenString ? JSON.parse(tokenString) : [];
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { Auth: VotingService.Auth };
}