ProfileManagementService.WebApp = {
    doGet: (e, userEmail, template) => {
        // We only get here when the previous token (and therefore email) were valid.
        template.contentFileName = "services/ProfileManagementService/ProfileManagementForm"
        const profile = Common.Data.Access.getMember(userEmail);
        if (!profile) {
            throw new Error(`Profile not found for email: ${userEmail}`);
        }
        template.profile = profile; // Pass the profile to the HTML template
        template.token = Common.Auth.TokenManager.getMultiUseToken(userEmail);
        const output = template.evaluate();
        return output.setTitle("SCCCC Profile Management Service");
    }
}