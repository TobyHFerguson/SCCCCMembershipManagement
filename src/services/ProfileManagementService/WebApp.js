ProfileManagementService.WebApp = {
    doGet: (e, userEmail) => {
        // We only get here when the previous token (and therefore email) were valid.
        const template = HtmlService.createTemplateFromFile("services/ProfileManagementService/ProfileManagementForm")
        const profile = Common.Data.Access.getMember(userEmail);
        if (!profile) {
            throw new Error(`Profile not found for email: ${userEmail}`);
        }
        const rawCssString = HtmlService.createHtmlOutputFromFile('services/ProfileManagementService/Stylesheet').getContent();
        console.log('rawCssString', rawCssString);
        // Pass the raw CSS string to the main HTML template
        template.myInlineCss = rawCssString;
        template.profile = profile; // Pass the profile to the HTML template
        template.token = Common.Auth.TokenManager.getMultiUseToken(userEmail);
        const output = template.evaluate();
        console.log('output', output.getContent());
        return output.setTitle("SCCCC Profile Management Service");
    }
}