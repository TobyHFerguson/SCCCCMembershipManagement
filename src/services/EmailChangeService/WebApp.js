EmailChangeService.WebApp = {
    doGet: (e, userEmail) => {
        // We only get here when the previous token (and therefore email) were valid.
       const template = HtmlService.createTemplateFromFile("services/EmailChangeService/EmailChangeForm")
        template.originalEmail = userEmail; // Pass the token to the HTML template
        return template.evaluate();
    },
    doPost: (e, userEmail) => {
        console.log('EmailChangeService.WebApp.doPost(e, userEmail) - e: ', e, ' userEmail: ', userEmail)
        const action = e.parameter.action;
        if (action === "sendVerificationCode") {
            const token = Common.Auth.TokenManager.generateToken();
            Common.Auth.TokenStorage.storeToken(userEmail, token);
            const message = handleSendVerificationCode(e, userEmail)
            const content = {
                    message: message,
                    emailUpdateToken: token,
                }
            console.log('EmailChangeService.WebApp.doPost - sendVerificationCode returning: ', content)
            return createTextResponse(JSON.stringify(content))
        } else if (action === "verifyAndUpdateEmail") {
            return handleVerifyAndUpdateEmail(e);
        } else {
            return createTextResponse("Invalid action.", 400);
        }
    }
}