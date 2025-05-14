const EMAIL_SUBJECT = 'SCCCC Directory Access Link';
const EMAIL_BODY = 'Click the following link to access the SCCCC Directory (this link can only be used once):\n\n';

Common.Auth.Utils = {

    sendMagicLink: function (email, service) {
        email = email.toLowerCase().trim(); // Normalize the email address
        const validEmails = Common.Data.Access.getEmailAddresses();
        if (validEmails.includes(email)) {
            const token = Common.Auth.TokenManager.generateToken();
            Common.Auth.TokenStorage.storeToken(email, token);
            const accessLink = ScriptApp.getService().getUrl() + '?token=' + token + '&service=' + service;
            this._sendEmail(email, accessLink);
            return { success: true };
        } else {
            console.log('email: ' + email +' isnt valid - no token being generated nor sent')
            return { success: false };
        }
    },

    
    _sendEmail: function (email, accessLink) {
        const message = {
            to: email,
            subject: EMAIL_SUBJECT,
            body: EMAIL_BODY + accessLink
        }
        MailApp.sendEmail(message);
        console.log('Email sent:', message);
    }
}
