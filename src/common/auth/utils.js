/**
 * Common.Auth.Utils - Authentication utility functions
 * 
 * @deprecated The sendMagicLink function is deprecated and will be removed in a future release.
 *             Use Common.Auth.VerificationCode for the new SPA authentication flow.
 *             This module remains for backward compatibility when new auth is disabled.
 *             Call FeatureFlags.enableNewAuth() to switch to the new flow.
 */
Common.Auth.Utils = {

    /**
     * Send a magic link to the user's email address.
     * 
     * @deprecated This method is deprecated. Use Common.Auth.VerificationCode.requestCode() instead.
     *             Call FeatureFlags.enableNewAuth() to switch to the new flow.
     * @param {string} email - The user's email address (will be normalized)
     * @param {string} service - The service identifier (e.g., 'GroupManagementService')
     * @returns {{success: boolean}} Always returns success (security: don't reveal if email exists)
     */
    sendMagicLink: function (email, service) {
        console.warn('[DEPRECATED] Common.Auth.Utils.sendMagicLink is deprecated. ' +
            'Use Common.Auth.VerificationCode.requestCode() instead.');
        email = email.toLowerCase().trim(); // Normalize the email address
        const validEmails = Common.Data.Access.getEmailAddresses();
        if (validEmails.includes(email)) {
            const token = Common.Auth.TokenStorage.generateAndStoreToken(email);
            const accessLink = ScriptApp.getService().getUrl() + '?token=' + token + '&service=' + service;
            this._sendEmail(email, accessLink, service);
        } else {
            console.log('email: ' + email +' isnt valid - no token being generated nor sent')
        }
        // Whatever happens we act as if all is good!
        return { success: true };
    },

    /**
     * Send the magic link email to the user.
     * 
     * @deprecated This is an internal method for the deprecated magic link flow.
     * @param {string} email - The recipient's email address
     * @param {string} accessLink - The magic link URL
     * @param {string} service - The service identifier
     * @private
     */
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
