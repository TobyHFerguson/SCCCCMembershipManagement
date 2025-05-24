GroupManagementService.WebApp = {
    doGet: function (e, userEmail) {
        const token = Common.Auth.TokenManager.generateToken();
        const cache = CacheService.getScriptCache();
        const tokenKey = `user_token_${token}`;
        const expirationInSeconds = 900; // Example: 5 minutes

        // Store the mapping between the token and the user identifier in the cache
        cache.put(tokenKey, userEmail, expirationInSeconds);





        const template = HtmlService.createTemplateFromFile('services/GroupManagementService/GroupManagementService.html');
        template.userGroupSubscription = GroupManagementService.getUserGroupSubscription(userEmail);
        template.deliveryMap = GroupSubscription.deliveryOptions; // Pass the map to the HTML for dropdown creation
        template.userToken = token;
        return template.evaluate();
    },
    updateUserSubscriptions: function (updatedSubscriptions, userToken) {
        const cache = CacheService.getScriptCache();
        const tokenKey = `user_token_${userToken}`;
        const userEmail = cache.get(tokenKey);

        if (!userEmail) {
            Logger.warning(`Invalid or expired token: ${userToken}`);
            return JSON.stringify({ success: false, message: "Invalid session. Please refresh the page." });
        }

        const response = GroupManagementService.updateUserSubscriptions(updatedSubscriptions, userEmail);
        return response;
    }
}