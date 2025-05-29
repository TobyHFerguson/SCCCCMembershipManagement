GroupManagementService.WebApp = {
    doGet: function (e, userEmail) {
        const token = Common.Auth.TokenManager.getMultiUseToken(userEmail);
        const template = HtmlService.createTemplateFromFile('services/GroupManagementService/GroupManagementService.html');
        template.userGroupSubscription = GroupManagementService.getUserGroupSubscription(userEmail);
        template.deliveryMap = GroupSubscription.deliveryOptions; // Pass the map to the HTML for dropdown creation
        template.userToken = token;
        return template.evaluate();
    },
    updateUserSubscriptions: function (updatedSubscriptions, userToken) {
        const userEmail = Common.Auth.TokenManager.getEmailFromMUT(userToken);
        if (!userEmail) {
            console.warning(`Invalid or expired token: ${userToken}`);
            return JSON.stringify({ success: false, message: "Invalid session. Please refresh the page." });
        }
        const response = GroupManagementService.updateUserSubscriptions(updatedSubscriptions, userEmail);
        return response;
    }
}