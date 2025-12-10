// @ts-check
/// <reference path="../../types/global.d.ts" />

/**
 * EmailChangeService.Api - GAS layer for email change API
 * 
 * This module provides the API endpoints for the EmailChangeService SPA.
 * It handles GAS API calls and orchestrates the Manager business logic.
 * 
 * Architecture follows GAS Layer Separation pattern:
 * - Api: GAS layer (orchestration, GAS API calls)
 * - Manager: Pure logic (testable)
 * 
 * @namespace EmailChangeService.Api
 */

// Namespace declaration pattern (works in both GAS and Jest)
// @ts-ignore
if (typeof EmailChangeService === 'undefined') EmailChangeService = {};

EmailChangeService.Api = EmailChangeService.Api || {};

/**
 * Get initial data for rendering EmailChangeService
 * Called by getServiceContent() for SPA initial page load
 * 
 * CRITICAL: No Date objects in return value - google.script.run cannot serialize them
 * 
 * @param {string} email - Authenticated user email
 * @returns {{serviceName: string, currentEmail: string, error?: string}} Service data
 */
EmailChangeService.Api.getData = function(email) {
  console.log('EmailChangeService.Api.getData(', email, ')');
  
  try {
    return {
      serviceName: 'Email Change',
      currentEmail: email
    };
  } catch (error) {
    console.error('EmailChangeService.Api.getData error:', error);
    return {
      serviceName: 'Email Change',
      error: `Failed to load email change service: ${error.message}`,
      currentEmail: email
    };
  }
};

/**
 * Script properties key prefix for verification data
 */
const VERIFICATION_KEY_PREFIX = 'verification_';

/**
 * Sheet references for email change updates
 */
const EMAIL_CHANGE_SHEET_REFS = ['ActiveMembers', 'ExpirySchedule'];

/**
 * Initialize API handlers for EmailChangeService
 * This should be called once during application startup
 */
EmailChangeService.initApi = function() {
  // Register sendVerificationCode handler
  Common.Api.Client.registerHandler(
    'emailChange.sendVerificationCode',
    EmailChangeService.Api.handleSendVerificationCode,
    {
      requiresAuth: true,
      description: 'Send verification code for email change'
    }
  );

  // Register verifyAndChangeEmail handler (combined verify + change)
  Common.Api.Client.registerHandler(
    'emailChange.verifyAndChangeEmail',
    EmailChangeService.Api.handleVerifyAndChangeEmail,
    {
      requiresAuth: true,
      description: 'Verify code and execute email change in one step'
    }
  );

  // Register verifyAndGetGroups handler
  Common.Api.Client.registerHandler(
    'emailChange.verifyAndGetGroups',
    EmailChangeService.Api.handleVerifyAndGetGroups,
    {
      requiresAuth: true,
      description: 'Verify code and get list of groups to update'
    }
  );

  // Register changeEmail handler
  Common.Api.Client.registerHandler(
    'emailChange.changeEmail',
    EmailChangeService.Api.handleChangeEmail,
    {
      requiresAuth: true,
      description: 'Execute email change in all groups and spreadsheets'
    }
  );
};

/**
 * EmailChangeService.Api handlers - Add to existing Api object
 */

/**
 * Handle sendVerificationCode API request
 * Generates and sends a verification code to the new email
 * 
 * @param {Object} params - Request parameters
 * @param {string} params._authenticatedEmail - Authenticated user's email (original email)
 * @param {string} params.newEmail - The new email address to verify
 * @returns {Common.Api.ApiResponse}
 */
EmailChangeService.Api.handleSendVerificationCode = function(params) {
  Logger.log('[EmailChangeService.Api] handleSendVerificationCode called with params: ' + JSON.stringify(params));
  
  const originalEmail = params._authenticatedEmail;
  const newEmail = params.newEmail;

  Logger.log('[EmailChangeService.Api] originalEmail: ' + originalEmail + ', newEmail: ' + newEmail);

    // Validate original email is available
    if (!originalEmail) {
      Logger.log('[EmailChangeService.Api] ERROR: No original email provided');
      return Common.Api.ClientManager.errorResponse(
        'User email not available',
        'NO_EMAIL'
      );
    }

    // Validate new email is provided
    if (!newEmail) {
      Logger.log('[EmailChangeService.Api] ERROR: No new email provided');
      return Common.Api.ClientManager.errorResponse(
        'New email address is required',
        'MISSING_NEW_EMAIL'
      );
    }

    // PURE: Validate email change (old vs new)
    Logger.log('[EmailChangeService.Api] Validating email change');
    const validation = EmailChangeService.Manager.validateEmailChange(originalEmail, newEmail);
    if (!validation.valid) {
      Logger.log('[EmailChangeService.Api] Validation failed: ' + validation.error);
      return Common.Api.ClientManager.errorResponse(
        validation.error,
        validation.errorCode
      );
    }

    try {
      // PURE: Generate verification code
      Logger.log('[EmailChangeService.Api] Generating verification code');
      const code = EmailChangeService.Manager.generateVerificationCode();
      Logger.log('[EmailChangeService.Api] Code generated: ' + code);
      
      // PURE: Create verification entry
      const entry = EmailChangeService.Manager.createVerificationEntry(originalEmail, newEmail, code);
      
      // GAS: Store verification data
      Logger.log('[EmailChangeService.Api] Storing verification data');
      EmailChangeService.Api.storeVerificationData(code, entry);

      // PURE: Build email content
      Logger.log('[EmailChangeService.Api] Building email content');
      const emailContent = EmailChangeService.Manager.buildVerificationEmailContent(code);

      // GAS: Send verification email
      const normalizedNewEmail = EmailChangeService.Manager.normalizeEmail(newEmail);
      Logger.log('[EmailChangeService.Api] Sending verification email to: ' + normalizedNewEmail);
      const emailSent = EmailChangeService.Api.sendVerificationEmail(normalizedNewEmail, emailContent);

      if (!emailSent) {
        Logger.log('[EmailChangeService.Api] ERROR: Email send failed');
        // Clean up stored verification data on email failure
        EmailChangeService.Api.deleteVerificationData(code);
        
        // PURE: Format error result
        const errorResult = EmailChangeService.Manager.formatSendCodeResult(false, normalizedNewEmail, 'Failed to send email');
        return Common.Api.ClientManager.errorResponse(
          errorResult.message,
          errorResult.errorCode
        );
      }

      Logger.log('[EmailChangeService.Api] SUCCESS: Verification code sent to: ' + normalizedNewEmail);

      // PURE: Format success result
      const result = EmailChangeService.Manager.formatSendCodeResult(true, normalizedNewEmail);
      return Common.Api.ClientManager.successResponse({
        message: result.message
      });
    } catch (error) {
      Logger.log('[EmailChangeService.Api] handleSendVerificationCode error: ' + error);
      Logger.log('[EmailChangeService.Api] Error stack: ' + error.stack);
      return Common.Api.ClientManager.errorResponse(
        'Failed to send verification code',
        'SEND_CODE_ERROR'
      );
    }
  };

/**
 * Handle verifyAndChangeEmail API request
 * Combined handler that verifies the code and executes the email change in one step
 * This simplifies the client flow for the 3-step UI
 * 
 * @param {Object} params - Request parameters
 * @param {string} params._authenticatedEmail - Authenticated user's email (original email)
 * @param {string} params.newEmail - The new email address
 * @param {string} params.verificationCode - The verification code
 * @param {string} token - The authentication token (passed by ApiClient)
 * @returns {Common.Api.ApiResponse}
 */
EmailChangeService.Api.handleVerifyAndChangeEmail = function(params, token) {
    Logger.log('[EmailChangeService.Api] handleVerifyAndChangeEmail called');
    
    const originalEmail = params._authenticatedEmail;
    const newEmail = params.newEmail;
    const verificationCode = params.verificationCode;

    // Validate inputs
    if (!originalEmail) {
      Logger.log('[EmailChangeService.Api] ERROR: No original email');
      return Common.Api.ClientManager.errorResponse(
        'User email not available',
        'NO_EMAIL'
      );
    }

    if (!newEmail) {
      Logger.log('[EmailChangeService.Api] ERROR: No new email');
      return Common.Api.ClientManager.errorResponse(
        'New email address is required',
        'MISSING_NEW_EMAIL'
      );
    }

    if (!verificationCode) {
      Logger.log('[EmailChangeService.Api] ERROR: No verification code');
      return Common.Api.ClientManager.errorResponse(
        'Verification code is required',
        'MISSING_CODE'
      );
    }

    try {
      // GAS: Get stored verification data
      Logger.log('[EmailChangeService.Api] Retrieving verification data for code');
      const storedData = EmailChangeService.Api.getVerificationData(verificationCode);

      // PURE: Verify code
      Logger.log('[EmailChangeService.Api] Verifying code');
      const verifyResult = EmailChangeService.Manager.verifyCode(
        verificationCode,
        originalEmail,
        newEmail,
        storedData
      );

      if (!verifyResult.valid) {
        Logger.log('[EmailChangeService.Api] Verification failed: ' + verifyResult.error);
        return Common.Api.ClientManager.errorResponse(
          verifyResult.error,
          verifyResult.errorCode
        );
      }

      Logger.log('[EmailChangeService.Api] Code verified, proceeding with email change');

      // GAS: Invalidate the verification code (single-use)
      EmailChangeService.Api.deleteVerificationData(verificationCode);

      const results = [];
      const normalizedOld = EmailChangeService.Manager.normalizeEmail(originalEmail);
      const normalizedNew = EmailChangeService.Manager.normalizeEmail(newEmail);

      // GAS: Get user's group memberships
      Logger.log('[EmailChangeService.Api] Getting groups for user');
      const groups = GroupSubscription.listGroupsFor(normalizedOld);
      Logger.log('[EmailChangeService.Api] Found ' + groups.length + ' groups');

      // GAS: Update email in each group with automatic retry
      if (Array.isArray(groups) && groups.length > 0) {
        const MAX_RETRIES = 3;
        
        for (const group of groups) {
          const groupEmail = group.email;
          let success = false;
          let lastError = null;

          // Retry loop using pure function for logic
          for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
            try {
              Logger.log('[EmailChangeService.Api] Updating group: ' + groupEmail + ' (attempt ' + attempt + '/' + MAX_RETRIES + ')');
              
              // GAS: Change member's email in group
              GroupSubscription.changeMembersEmail(groupEmail, normalizedOld, normalizedNew);
              success = true;
              Logger.log('[EmailChangeService.Api] Successfully updated group: ' + groupEmail);
              break; // Success - exit retry loop
            } catch (e) {
              lastError = e;
              Logger.log('[EmailChangeService.Api] Error updating group ' + groupEmail + ' (attempt ' + attempt + '): ' + e);
              
              // PURE: Get retry decision
              const retryAction = EmailChangeService.Manager.getRetryAction({
                attempt: attempt,
                maxRetries: MAX_RETRIES,
                error: e
              });
              
              if (retryAction.action === 'retry') {
                // GAS: Sleep with backoff
                const backoffMs = retryAction.backoffMs;
                Logger.log('[EmailChangeService.Api] Retrying in ' + backoffMs + 'ms...');
                Utilities.sleep(backoffMs);
              } else if (retryAction.action === 'fail') {
                // All retries exhausted
                Logger.log('[EmailChangeService.Api] All retries exhausted for group ' + groupEmail);
                break;
              }
            }
          }

          // PURE: Create result entry
          const errorMessage = success ? null : (lastError ? lastError.message || 'Unknown error' : 'Unknown error');
          const result = EmailChangeService.Manager.createGroupUpdateResult(group, success, errorMessage);
          results.push(result);
        }
      }

      // GAS: Update email in spreadsheets
      Logger.log('[EmailChangeService.Api] Updating spreadsheets');
      EmailChangeService.Api.changeEmailInSpreadsheets(normalizedOld, normalizedNew);

      // GAS: Log the change
      Logger.log('[EmailChangeService.Api] Logging email change');
      EmailChangeService.Api.logEmailChange(normalizedOld, normalizedNew);

      // GAS: Update the session token with new email
      if (token) {
        const tokenUpdated = Common.Auth.TokenManager.updateTokenEmail(token, normalizedNew);
        if (!tokenUpdated) {
          Logger.log('[EmailChangeService.Api] Warning: Could not update token email');
        }
      }

      // PURE: Aggregate results
      const aggregated = EmailChangeService.Manager.aggregateGroupResults(results);
      const message = EmailChangeService.Manager.formatEmailChangeMessage(
        aggregated.overallSuccess,
        normalizedOld,
        normalizedNew,
        aggregated.successCount,
        aggregated.failedCount
      );

      Logger.log('[EmailChangeService.Api] Email change complete: ' + aggregated.successCount + ' successes, ' + aggregated.failedCount + ' failures');

      return Common.Api.ClientManager.successResponse({
        success: aggregated.overallSuccess,
        message: message,
        oldEmail: normalizedOld,
        newEmail: normalizedNew,
        groupResults: results,
        successCount: aggregated.successCount,
        failedCount: aggregated.failedCount
      });
    } catch (error) {
      Logger.log('[EmailChangeService.Api] handleVerifyAndChangeEmail error: ' + error);
      Logger.log('[EmailChangeService.Api] Error stack: ' + error.stack);
      return Common.Api.ClientManager.errorResponse(
        'Failed to verify and change email: ' + error.message,
        'VERIFY_CHANGE_ERROR'
      );
    }
};

/**
 * Handle verifyAndGetGroups API request
 * Verifies the code and returns list of groups the user is a member of
 * 
 * @param {Object} params - Request parameters
 * @param {string} params._authenticatedEmail - Authenticated user's email (original email)
 * @param {string} params.newEmail - The new email address
 * @param {string} params.verificationCode - The verification code
 * @returns {Common.Api.ApiResponse}
 */
EmailChangeService.Api.handleVerifyAndGetGroups = function(params) {
    const originalEmail = params._authenticatedEmail;
    const newEmail = params.newEmail;
    const verificationCode = params.verificationCode;

    // Validate inputs
    if (!originalEmail) {
      return Common.Api.ClientManager.errorResponse(
        'User email not available',
        'NO_EMAIL'
      );
    }

    if (!newEmail) {
      return Common.Api.ClientManager.errorResponse(
        'New email address is required',
        'MISSING_NEW_EMAIL'
      );
    }

    if (!verificationCode) {
      return Common.Api.ClientManager.errorResponse(
        'Verification code is required',
        'MISSING_CODE'
      );
    }

    try {
      // GAS: Get stored verification data
      const storedData = EmailChangeService.Api.getVerificationData(verificationCode);

      // PURE: Verify code
      const verifyResult = EmailChangeService.Manager.verifyCode(
        verificationCode,
        originalEmail,
        newEmail,
        storedData
      );

      if (!verifyResult.valid) {
        return Common.Api.ClientManager.errorResponse(
          verifyResult.error,
          verifyResult.errorCode
        );
      }

      // GAS: Get user's group memberships
      const groups = GroupSubscription.listGroupsFor(
        EmailChangeService.Manager.normalizeEmail(originalEmail)
      );

      // PURE: Transform to membership info format
      const groupData = EmailChangeService.Manager.transformGroupsToMembershipInfo(
        groups,
        originalEmail,
        newEmail
      );

      // GAS: Invalidate the verification code (single-use)
      EmailChangeService.Api.deleteVerificationData(verificationCode);

      Logger.log('[EmailChangeService.Api] Verification successful for: ' + originalEmail + ', found ' + groupData.length + ' groups');

      return Common.Api.ClientManager.successResponse({
        groups: groupData,
        count: groupData.length
      });
    } catch (error) {
      Logger.log('[EmailChangeService.Api] handleVerifyAndGetGroups error: ' + error);
      return Common.Api.ClientManager.errorResponse(
        'Failed to verify and get groups',
        'VERIFY_ERROR'
      );
    }
};

/**
 * Handle changeEmail API request
 * Executes the email change in all groups and spreadsheets
 * 
 * @param {Object} params - Request parameters
 * @param {string} params._authenticatedEmail - Authenticated user's email (original email)
 * @param {string} params.newEmail - The new email address
 * @param {Array} params.groups - Array of group membership info
 * @returns {Common.Api.ApiResponse}
 */
EmailChangeService.Api.handleChangeEmail = function(params) {
    const originalEmail = params._authenticatedEmail;
    const newEmail = params.newEmail;
    const groups = params.groups;

    // Validate inputs
    if (!originalEmail) {
      return Common.Api.ClientManager.errorResponse(
        'User email not available',
        'NO_EMAIL'
      );
    }

    if (!newEmail) {
      return Common.Api.ClientManager.errorResponse(
        'New email address is required',
        'MISSING_NEW_EMAIL'
      );
    }

    // PURE: Validate email change again for safety
    const validation = EmailChangeService.Manager.validateEmailChange(originalEmail, newEmail);
    if (!validation.valid) {
      return Common.Api.ClientManager.errorResponse(
        validation.error,
        validation.errorCode
      );
    }

    try {
      const results = [];
      const normalizedOld = EmailChangeService.Manager.normalizeEmail(originalEmail);
      const normalizedNew = EmailChangeService.Manager.normalizeEmail(newEmail);

      // GAS: Update email in each group
      if (Array.isArray(groups) && groups.length > 0) {
        for (const group of groups) {
          const groupEmail = group.groupEmail;
          let success = false;
          let error = null;

          try {
            // GAS: Change member's email in group
            GroupSubscription.changeMembersEmail(groupEmail, normalizedOld, normalizedNew);
            success = true;
          } catch (e) {
            error = e.message || 'Unknown error';
            Logger.log('[EmailChangeService.Api] Error updating group ' + groupEmail + ': ' + e);
          }

          // PURE: Update result
          const updatedResult = EmailChangeService.Manager.updateMembershipResult(group, success, error);
          results.push(updatedResult);
        }
      }

      // GAS: Update email in spreadsheets
      EmailChangeService.Api.changeEmailInSpreadsheets(normalizedOld, normalizedNew);

      // GAS: Log the change
      EmailChangeService.Api.logEmailChange(normalizedOld, normalizedNew);

      // PURE: Aggregate results
      const aggregated = EmailChangeService.Manager.aggregateResults(results);

      Logger.log('[EmailChangeService.Api] Email changed from ' + normalizedOld + ' to ' + normalizedNew + 
        ': ' + aggregated.successCount + ' successes, ' + aggregated.failedCount + ' failures');

      return Common.Api.ClientManager.successResponse({
        success: aggregated.success,
        message: aggregated.message,
        results: aggregated.results,
        successCount: aggregated.successCount,
        failedCount: aggregated.failedCount
      });
    } catch (error) {
      Logger.log('[EmailChangeService.Api] handleChangeEmail error: ' + error);
      return Common.Api.ClientManager.errorResponse(
        'Failed to change email',
        'CHANGE_EMAIL_ERROR'
      );
    }
  },

  // ==================== GAS Helper Functions ====================

/**
 * Store verification data in Script Properties
 * @param {string} code - The verification code (used as key suffix)
 * @param {Object} data - The verification data to store
 */
EmailChangeService.Api.storeVerificationData = function(code, data) {
    const key = VERIFICATION_KEY_PREFIX + code;
    const value = JSON.stringify(data);
    PropertiesService.getScriptProperties().setProperty(key, value);
};

/**
 * Retrieve verification data from Script Properties
 * @param {string} code - The verification code (used as key suffix)
 * @returns {Object|null} The verification data or null if not found/expired
 */
EmailChangeService.Api.getVerificationData = function(code) {
    const key = VERIFICATION_KEY_PREFIX + code;
    const storedData = PropertiesService.getScriptProperties().getProperty(key);
    
    if (!storedData) {
      return null;
    }

    try {
      const data = JSON.parse(storedData);
      // Check expiry
      if (data.expiry < Date.now()) {
        // Clean up expired data
        EmailChangeService.Api.deleteVerificationData(code);
        return null;
      }
      return data;
    } catch (e) {
      Logger.log('[EmailChangeService.Api] Error parsing verification data: ' + e);
      return null;
    }
};

/**
 * Delete verification data from Script Properties
 * @param {string} code - The verification code
 */
EmailChangeService.Api.deleteVerificationData = function(code) {
    const key = VERIFICATION_KEY_PREFIX + code;
    PropertiesService.getScriptProperties().deleteProperty(key);
};

/**
 * Send verification email
 * @param {string} email - The email address to send to
 * @param {{subject: string, body: string}} content - Email content
 * @returns {boolean} True if email was sent successfully
 */
EmailChangeService.Api.sendVerificationEmail = function(email, content) {
    try {
      MailApp.sendEmail({
        to: email,
        subject: content.subject,
        body: content.body
      });
      return true;
    } catch (error) {
      Logger.log('[EmailChangeService.Api] Error sending verification email: ' + error);
      return false;
    }
};

/**
 * Change email in spreadsheets
 * @param {string} oldEmail - The original email (normalized)
 * @param {string} newEmail - The new email (normalized)
 */
EmailChangeService.Api.changeEmailInSpreadsheets = function(oldEmail, newEmail) {
    for (const ref of EMAIL_CHANGE_SHEET_REFS) {
      try {
        const fiddler = Common.Data.Storage.SpreadsheetManager.getFiddler(ref);
        fiddler.mapRows(/** @param {any} row */ (row) => {
          if (row.Email && row.Email.toLowerCase() === oldEmail) {
            row.Email = newEmail;
          }
          return row;
        });
        fiddler.dumpValues();
      } catch (error) {
        Logger.log('[EmailChangeService.Api] Error updating ' + ref + ': ' + error);
      }
    }
};

/**
 * Log email change to EmailChange sheet
 * @param {string} oldEmail - The original email (normalized)
 * @param {string} newEmail - The new email (normalized)
 */
EmailChangeService.Api.logEmailChange = function(oldEmail, newEmail) {
  try {
    // PURE: Create log entry
    const entry = EmailChangeService.Manager.createChangeLogEntry(oldEmail, newEmail);
    
    // GAS: Append to log sheet
    const fiddler = Common.Data.Storage.SpreadsheetManager.getFiddler('EmailChange');
    const data = fiddler.getData();
    data.push(entry);
    fiddler.setData(data).dumpValues();
  } catch (error) {
    Logger.log('[EmailChangeService.Api] Error logging email change: ' + error);
  }
};

// Node.js export for testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    Api: EmailChangeService.Api,
    initApi: EmailChangeService.initApi,
    VERIFICATION_KEY_PREFIX,
    EMAIL_CHANGE_SHEET_REFS
  };
}
