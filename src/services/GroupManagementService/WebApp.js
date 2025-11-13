// Guarded initializer so this file can be safely loaded in any order
if (typeof GroupManagementService === 'undefined') {
    // @ts-ignore - create namespace in GAS
    var GroupManagementService = {};
}
GroupManagementService.WebApp = GroupManagementService.WebApp || {};

const GROUP_MANAGEMENT_HTML = "services/GroupManagementService/GroupManagementService.html";
GroupManagementService.WebApp = {
  
    doGet: function (e, userEmail, template) {
        template.contentFileName = GROUP_MANAGEMENT_HTML;
        template.userGroupSubscription = GroupManagementService.getUserGroupSubscription(userEmail);
        template.deliveryMap = GroupSubscription.deliveryOptions; // Pass the map to the HTML for dropdown creation
        template.userToken = Common.Auth.TokenManager.getMultiUseToken(userEmail);;
        return template.evaluate().setTitle("SCCCC Group Management");
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