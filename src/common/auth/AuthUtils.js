/**
 * AuthUtils - Authentication utility functions
 *
 * CRITICAL: This module is in Layer 0 (Foundation).
 * - MUST NOT use AppLogger.* (creates circular dependency)
 * - MUST use Logger.log() (GAS built-in) only for tracing
 *
 * Pattern: IIFE-wrapped class with static methods (per gas-best-practices.md)
 *
 * @deprecated The sendMagicLink function is deprecated and will be removed in a future release.
 *             Use VerificationCode for the new SPA authentication flow.
 *             This module remains for backward compatibility when new auth is disabled.
 *             Call FeatureFlags.enableNewAuth() to switch to the new flow.
 */

/** @ts-check */
/// <reference path="../../types/global.d.ts" />

/**
 * AuthUtils - Static class for authentication utility functions
 * Pattern: IIFE-wrapped class with static methods
 */
var AuthUtils = (function () {
    class AuthUtils {
        /**
         * Send a magic link to the user's email address.
         *
         * @deprecated This method is deprecated. Use VerificationCode.requestCode() instead.
         *             Call FeatureFlags.enableNewAuth() to switch to the new flow.
         * @param {string} email - The user's email address (will be normalized)
         * @param {string} service - The service identifier (e.g., 'GroupManagementService')
         * @returns {{success: boolean}} Always returns success (security: don't reveal if email exists)
         */
        static sendMagicLink(email, service) {
            console.warn(
                '[DEPRECATED] AuthUtils.sendMagicLink is deprecated. ' +
                    'Use VerificationCode.requestCode() instead.'
            );
            email = email.toLowerCase().trim(); // Normalize the email address
            var validEmails = DataAccess.getEmailAddresses();
            if (validEmails.includes(email)) {
                var token = TokenStorage.generateAndStoreToken(email);
                var accessLink = ScriptApp.getService().getUrl() + '?token=' + token + '&service=' + service;
                AuthUtils._sendEmail(email, accessLink, service);
            } else {
                console.log("email: " + email + " isnt valid - no token being generated nor sent");
            }
            // Whatever happens we act as if all is good!
            return { success: true };
        }

        /**
         * Send the magic link email to the user.
         *
         * @deprecated This is an internal method for the deprecated magic link flow.
         * @param {string} email - The recipient's email address
         * @param {string} accessLink - The magic link URL
         * @param {string} service - The service identifier
         * @private
         */
        static _sendEmail(email, accessLink, service) {
            var serviceName = WebServices[service].name || '';
            var message = {
                to: email,
                subject: 'SCCCC ' + serviceName + ' Magic Link',
                body:
                    'Click the following magic link to access the SCCCC ' +
                    serviceName +
                    ' (this link can only be used once):\n\n' +
                    accessLink,
            };
            MailApp.sendEmail(message);
            console.log('Email sent:', message);
        }
    }

    return AuthUtils;
})();

// Backward compatibility - assign to Common.Auth.Utils
if (typeof Common !== 'undefined' && Common.Auth) {
    Common.Auth.Utils = AuthUtils;
}

// Node.js export for testing
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { AuthUtils };
}
