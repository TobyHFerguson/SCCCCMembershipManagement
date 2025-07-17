Common.Auth.Utils = {

    sendMagicLink: function (email, service) {
        email = email.toLowerCase().trim(); // Normalize the email address
        const validEmails = Common.Data.Access.getEmailAddresses();
        if (validEmails.includes(email)) {
            const token = Common.Auth.TokenManager.generateToken();
            Common.Auth.TokenStorage.storeToken(email, token);
            const accessLink = ScriptApp.getService().getUrl() + '?token=' + token + '&service=' + service;
            this._sendEmail(email, accessLink, service);
        } else {
            console.log('email: ' + email +' isnt valid - no token being generated nor sent')
        }
        // Whatever happens we act as if all is good!
        return { success: true };
    },

    
    _sendEmail: function (email, accessLink, service) {
        const serviceName = WebServices[service].name || ''
        const message = {
            to: email,
            subject: `SCCCC ${serviceName} Magic Link`,
            body: `Click the following magic link to access the SCCCC ${serviceName} (this link can only be used once):\n\n` + accessLink
        }
        MailApp.sendEmail(message);
        console.log('Email sent:', message);
    }
}
