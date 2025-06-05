Common.Auth.TokenManager = {
    generateToken: () => {
        return Utilities.getUuid(); // Generate a unique UUID
    },
    getMultiUseToken: (email) => {
        const token = Common.Auth.TokenManager.generateToken();
        const cache = CacheService.getScriptCache();
        const tokenKey = `user_token_${token}`;
        const expirationInSeconds = 900; // Example: 5 minutes

        // Store the mapping between the token and the user identifier in the cache
        cache.put(tokenKey, email, expirationInSeconds);
        return token;
    },
    getEmailFromMUT: (token) => {
        const cache = CacheService.getScriptCache();
        const tokenKey = `user_token_${token}`;
        const email = cache.get(tokenKey);
        if (email) {
            return email;
        } else {
            console.warning(`Token ${token} not found or expired.`);
            return null;
        }
    }, 
    getTokenData:(token) => {
        Common.Auth.TokenStorage.getTokenData().find((tokenData) => tokenData[0] === token) || null;
    }
}