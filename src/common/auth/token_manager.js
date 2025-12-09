Common.Auth.TokenManager = {
    /**
     * 
     * @returns {string} A unique token string.
     * 
     * @description Generates a unique token using UUID.
     * This token can be used for multi-use authentication purposes.
     * It is designed to be secure and unique for each user interaction.
     * The generated token can be stored and later retrieved for validation.
     * 
     * @throws {Error} If there is an issue generating the token.
     */
    generateToken: () => {
        return Utilities.getUuid(); // Generate a unique UUID
    },
    /**
     * 
     * @param {string} email an email to be recorded with the token.
     * @returns {string} A unique multi-use token string.
     * 
     * @description Generates a multi-use token for the given email.
     * This token can be used multiple times and is associated with the user's email.
     * The token is stored in the cache for a specified duration to allow multiple uses.
     * It is designed to be secure and unique for each user interaction.
     * 
     * @throws {Error} If there is an issue generating the token or storing it in the cache.
     */
    getMultiUseToken: (email) => {
        const token = Common.Auth.TokenManager.generateToken();
        const cache = CacheService.getScriptCache();
        const tokenKey = `user_token_${token}`;
        const expirationInSeconds = 900; // Example: 5 minutes

        // Store the mapping between the token and the user identifier in the cache
        cache.put(tokenKey, email, expirationInSeconds);
        return token;
    },
    /**
     * 
     * @param {string} token the multi-use token
     * @returns {string} the email recorded against this token
     */
    getEmailFromMUT: (token) => {
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
    },
    /**
     * 
     * @param {string} token the multi-use token
     * @returns {string} if an email was recorded against this token, it will return the email, otherwise null.
     * 
     * @description Consumes the multi-use token and returns the associated email.
     * This method retrieves the email associated with the token from the cache and removes the token.
     * It is designed to ensure that the token can only be used once, preventing reuse.
     * 
     * @throws {Error} If there is an issue retrieving the token or if it has expired.
     */
    consumeMUT: (token) => {
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
    },
    /**
     * Update the email associated with a multi-use token
     * Used when a user changes their email address to update their session
     * 
     * @param {string} token - The multi-use token to update
     * @param {string} newEmail - The new email address
     * @returns {boolean} True if update succeeded, false if token not found
     */
    updateTokenEmail: (token, newEmail) => {
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
    },
    // Additional utility to get token data 
    getTokenData:(token) => {
        return Common.Auth.TokenStorage.getTokenData().find((tokenData) => tokenData.Token === token) || null;
    }
}