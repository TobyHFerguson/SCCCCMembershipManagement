const GROUP_MANAGEMENT_HTML = "services/GroupManagementService/GroupManagementService.html";
GroupManagementService.WebApp = {
    
    doGet: function (e, userEmail, template) {
        template.contentFileName = GROUP_MANAGEMENT_HTML;
        template.userGroupSubscription = GroupManagementService.getUserGroupSubscription(userEmail);
        template.deliveryMap = GroupSubscription.deliveryOptions; // Pass the map to the HTML for dropdown creation
        template.userToken = TokenManager.getMultiUseToken(userEmail);;
        return template.evaluate().setTitle("SCCCC Group Management");
    },
    updateUserSubscriptions: function (updatedSubscriptions, userToken) {
        const userEmail = TokenManager.getEmailFromMUT(userToken);
        if (!userEmail) {
            console.warn(`Invalid or expired token: ${userToken}`);
            return JSON.stringify({ success: false, message: "Invalid session. Please refresh the page." });
        }
        const response = GroupManagementService.updateUserSubscriptions(updatedSubscriptions, userEmail);
        return response;
    }
}