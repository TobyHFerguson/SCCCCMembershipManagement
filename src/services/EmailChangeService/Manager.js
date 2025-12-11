// @ts-check
/// <reference path="../../types/global.d.ts" />

/**
 * EmailChangeService.Manager - Pure business logic for email change operations
 * 
 * This module contains all business logic for managing email address changes.
 * It is fully testable with Jest as it has no GAS dependencies.
 * 
 * Architecture follows GAS Layer Separation pattern:
 * - Manager: Pure logic (testable)
 * - GAS layer (WebApp.js, Api.js): Orchestration and GAS API calls
 * 
 * @namespace EmailChangeService.Manager
 */

// Namespace declaration pattern (works in both GAS and Jest)
if (typeof EmailChangeService === 'undefined') EmailChangeService = {};

/**
 * @typedef {Object} ValidationResult
 * @property {boolean} valid - Whether validation passed
 * @property {string} [error] - Error message if validation failed
 * @property {string} [errorCode] - Machine-readable error code
 */

/**
 * @typedef {Object} GroupMembershipInfo
 * @property {string} groupEmail - The group email address
 * @property {string} oldEmail - The original email address
 * @property {string} newEmail - The new email address
 * @property {string} status - Status of the update ('Pending', 'Success', 'Failed')
 * @property {string} [error] - Error message if status is 'Failed'
 */

/**
 * @typedef {Object} VerificationData
 * @property {string} newEmail - The new email address to verify
 * @property {string} code - The verification code
 * @property {number} expiry - Expiry timestamp in milliseconds
 * @property {string} type - Type of verification ('emailUpdate')
 * @property {string} oldEmail - The original email address
 */

/**
 * @typedef {Object} EmailUpdateResult
 * @property {boolean} success - Whether all updates succeeded
 * @property {string} message - Result message
 * @property {GroupMembershipInfo[]} [results] - Individual group update results
 * @property {number} [successCount] - Number of successful updates
 * @property {number} [failedCount] - Number of failed updates
 */

/**
 * Verification code configuration
 */
EmailChangeService.VERIFICATION_CONFIG = {
  CODE_LENGTH: 6,
  EXPIRY_MINUTES: 15
};

/**
 * Email validation regex pattern
 */
EmailChangeService.EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * EmailChangeService.Manager - Pure logic class for email change operations
 * All business logic is here and is fully testable with Jest.
 * 
 * @class
 */
EmailChangeService.Manager = class {
  /**
   * Get verification configuration
   * @returns {{CODE_LENGTH: number, EXPIRY_MINUTES: number}}
   */
  static getVerificationConfig() {
    return { ...EmailChangeService.VERIFICATION_CONFIG };
  }

  /**
   * Validate an email format
   * @param {string} email - The email to validate
   * @returns {ValidationResult}
   */
  static validateEmail(email) {
    if (!email || typeof email !== 'string') {
      return { valid: false, error: 'Email must be a non-empty string', errorCode: 'INVALID_EMAIL' };
    }
    const trimmed = email.trim();
    if (trimmed.length === 0) {
      return { valid: false, error: 'Email cannot be empty', errorCode: 'EMPTY_EMAIL' };
    }
    if (!EmailChangeService.EMAIL_REGEX.test(trimmed)) {
      return { valid: false, error: 'Invalid email format', errorCode: 'INVALID_EMAIL_FORMAT' };
    }
    return { valid: true };
  }

  /**
   * Validate that old and new emails are different
   * @param {string} oldEmail - The original email
   * @param {string} newEmail - The new email
   * @returns {ValidationResult}
   */
  static validateEmailChange(oldEmail, newEmail) {
    // First validate both emails individually
    const oldValidation = this.validateEmail(oldEmail);
    if (!oldValidation.valid) {
      return { 
        valid: false, 
        error: 'Original email: ' + oldValidation.error, 
        errorCode: 'INVALID_OLD_EMAIL' 
      };
    }

    const newValidation = this.validateEmail(newEmail);
    if (!newValidation.valid) {
      return { 
        valid: false, 
        error: 'New email: ' + newValidation.error, 
        errorCode: 'INVALID_NEW_EMAIL' 
      };
    }

    // Check they are different
    const normalizedOld = this.normalizeEmail(oldEmail);
    const normalizedNew = this.normalizeEmail(newEmail);

    if (normalizedOld === normalizedNew) {
      return { 
        valid: false, 
        error: 'New email must be different from current email', 
        errorCode: 'EMAILS_SAME' 
      };
    }

    return { valid: true };
  }

  /**
   * Validate a verification code format
   * @param {string} code - The code to validate
   * @returns {ValidationResult}
   */
  static validateVerificationCode(code) {
    if (!code || typeof code !== 'string') {
      return { valid: false, error: 'Verification code must be provided', errorCode: 'MISSING_CODE' };
    }
    const trimmed = code.trim();
    if (trimmed.length !== EmailChangeService.VERIFICATION_CONFIG.CODE_LENGTH) {
      return {
        valid: false,
        error: `Verification code must be ${EmailChangeService.VERIFICATION_CONFIG.CODE_LENGTH} digits`,
        errorCode: 'INVALID_CODE_LENGTH' 
      };
    }
    if (!/^\d+$/.test(trimmed)) {
      return { 
        valid: false, 
        error: 'Verification code must contain only digits', 
        errorCode: 'INVALID_CODE_FORMAT' 
      };
    }
    return { valid: true };
  }

  /**
   * Generate a random verification code
   * @param {function(): number} [randomFn] - Random number generator (defaults to Math.random)
   * @returns {string} A 6-digit verification code
   */
  static generateVerificationCode(randomFn = Math.random) {
    let code = '';
    for (let i = 0; i < EmailChangeService.VERIFICATION_CONFIG.CODE_LENGTH; i++) {
      code += Math.floor(randomFn() * 10).toString();
    }
    return code;
  }

  /**
   * Create a verification data entry for storage
   * @param {string} oldEmail - The original email address
   * @param {string} newEmail - The new email address
   * @param {string} code - The verification code
   * @param {Date} [now] - Current time (for testing)
   * @returns {VerificationData}
   */
  static createVerificationEntry(oldEmail, newEmail, code, now = new Date()) {
    const expiryMs = now.getTime() + (EmailChangeService.VERIFICATION_CONFIG.EXPIRY_MINUTES * 60 * 1000);
    return {
      newEmail: this.normalizeEmail(newEmail),
      code: code,
      expiry: expiryMs,
      type: 'emailUpdate',
      oldEmail: this.normalizeEmail(oldEmail)
    };
  }

  /**
   * Verify a verification code against stored data
   * @param {string} inputCode - The user-provided code
   * @param {string} oldEmail - The original email
   * @param {string} newEmail - The new email
   * @param {VerificationData|null} storedData - The stored verification data
   * @param {Date} [now] - Current time (for testing)
   * @returns {ValidationResult}
   */
  static verifyCode(inputCode, oldEmail, newEmail, storedData, now = new Date()) {
    // Validate input code format
    const codeValidation = this.validateVerificationCode(inputCode);
    if (!codeValidation.valid) {
      return codeValidation;
    }

    // Check stored data exists
    if (!storedData) {
      return { 
        valid: false, 
        error: 'Invalid or expired verification code', 
        errorCode: 'CODE_NOT_FOUND' 
      };
    }

    // Check type
    if (storedData.type !== 'emailUpdate') {
      return { 
        valid: false, 
        error: 'Invalid verification code type', 
        errorCode: 'INVALID_CODE_TYPE' 
      };
    }

    // Check emails match
    const normalizedOld = this.normalizeEmail(oldEmail);
    const normalizedNew = this.normalizeEmail(newEmail);

    if (storedData.oldEmail !== normalizedOld) {
      return { 
        valid: false, 
        error: 'Original email does not match', 
        errorCode: 'EMAIL_MISMATCH_OLD' 
      };
    }

    if (storedData.newEmail !== normalizedNew) {
      return { 
        valid: false, 
        error: 'New email does not match', 
        errorCode: 'EMAIL_MISMATCH_NEW' 
      };
    }

    // Check expiry
    if (storedData.expiry < now.getTime()) {
      return { 
        valid: false, 
        error: 'Verification code has expired', 
        errorCode: 'CODE_EXPIRED' 
      };
    }

    // Check code matches
    if (storedData.code !== inputCode.trim()) {
      return { 
        valid: false, 
        error: 'Invalid verification code', 
        errorCode: 'CODE_INVALID' 
      };
    }

    return { valid: true };
  }

  /**
   * Transform raw group data to GroupMembershipInfo format
   * @param {Array<{email: string}>} groups - Array of groups with email property
   * @param {string} oldEmail - The original email
   * @param {string} newEmail - The new email
   * @returns {GroupMembershipInfo[]} Transformed group membership data
   */
  static transformGroupsToMembershipInfo(groups, oldEmail, newEmail) {
    if (!Array.isArray(groups)) {
      return [];
    }
    return groups.map(group => ({
      groupEmail: group.email || '',
      oldEmail: this.normalizeEmail(oldEmail),
      newEmail: this.normalizeEmail(newEmail),
      status: 'Pending'
    }));
  }

  /**
   * Update a single group membership result
   * @param {GroupMembershipInfo} membership - The membership to update
   * @param {boolean} success - Whether the update succeeded
   * @param {string} [error] - Error message if failed
   * @returns {GroupMembershipInfo} Updated membership info
   */
  static updateMembershipResult(membership, success, error) {
    return {
      ...membership,
      status: success ? 'Success' : 'Failed',
      error: success ? undefined : error
    };
  }

  /**
   * Aggregate group update results
   * @param {GroupMembershipInfo[]} results - Array of results
   * @returns {EmailUpdateResult}
   */
  static aggregateResults(results) {
    if (!Array.isArray(results) || results.length === 0) {
      return {
        success: true,
        message: 'No groups to update',
        results: [],
        successCount: 0,
        failedCount: 0
      };
    }

    const successCount = results.filter(r => r.status === 'Success').length;
    const failedCount = results.filter(r => r.status === 'Failed').length;
    const pendingCount = results.filter(r => r.status === 'Pending').length;

    if (pendingCount > 0) {
      return {
        success: false,
        message: 'Some updates are still pending',
        results,
        successCount,
        failedCount
      };
    }

    if (failedCount === 0) {
      return {
        success: true,
        message: `Email changed successfully in ${successCount} group(s)`,
        results,
        successCount,
        failedCount
      };
    }

    if (successCount === 0) {
      return {
        success: false,
        message: `Failed to change email in all ${failedCount} group(s)`,
        results,
        successCount,
        failedCount
      };
    }

    return {
      success: false,
      message: `Changed email in ${successCount} group(s), failed in ${failedCount} group(s)`,
      results,
      successCount,
      failedCount
    };
  }

  /**
   * Create member update object for spreadsheet update
   * @param {Object} originalMember - The original member record
   * @param {string} newEmail - The new email address
   * @returns {Object} Updated member record
   */
  static createUpdatedMemberRecord(originalMember, newEmail) {
    if (!originalMember) {
      return null;
    }
    return {
      ...originalMember,
      Email: this.normalizeEmail(newEmail)
    };
  }

  /**
   * Create email change log entry
   * @param {string} oldEmail - The original email
   * @param {string} newEmail - The new email
   * @param {Date} [date] - The date of change (defaults to now)
   * @returns {{date: Date, from: string, to: string}}
   */
  static createChangeLogEntry(oldEmail, newEmail, date = new Date()) {
    return {
      date: date,
      from: this.normalizeEmail(oldEmail),
      to: this.normalizeEmail(newEmail)
    };
  }

  /**
   * Normalize email address
   * @param {string} email - Email to normalize
   * @returns {string} Normalized email (lowercase, trimmed)
   */
  static normalizeEmail(email) {
    if (!email || typeof email !== 'string') {
      return '';
    }
    return email.trim().toLowerCase();
  }

  /**
   * Build verification email content
   * Matches the format of the initial authentication verification email
   * @param {string} code - The verification code
   * @returns {{subject: string, body: string}}
   */
  static buildVerificationEmailContent(code) {
    // Send the code as contiguous digits (no hyphen)
    const formattedCode = code;
    const expiryMinutes = EmailChangeService.VERIFICATION_CONFIG.EXPIRY_MINUTES;
    
    const subject = 'SCCCC Email Change - Verification Code';
    const body = `Your verification code for SCCCC Email Change is:\n\n` +
                 `    ${formattedCode}\n\n` +
                 `Copy/Paste this code into the verification form.\n\n` +
                 `This code will expire in ${expiryMinutes} minutes.\n\n` +
                 `If you did not request this code, please ignore this email.\n\n` +
                 `- SCCCC Membership System`;

    return { subject, body };
  }

  /**
   * Format the send verification code result
   * @param {boolean} success - Whether sending succeeded
   * @param {string} email - The email the code was sent to
   * @param {string} [error] - Error message if failed
   * @returns {{success: boolean, message: string, error?: string, errorCode?: string}}
   */
  static formatSendCodeResult(success, email, error) {
    if (success) {
      return {
        success: true,
        message: `Verification code sent to ${email}. Retrieve that code and enter it here`
      };
    }
    return {
      success: false,
      message: 'Failed to send verification code',
      error: error || 'Unknown error',
      errorCode: 'EMAIL_SEND_FAILED'
    };
  }

  /**
   * Calculate backoff delay for retry attempts
   * @param {number} attempt - The attempt number (1-indexed)
   * @param {number} initialBackoffMs - Initial backoff in milliseconds (default 1000)
   * @returns {number} Backoff delay in milliseconds
   */
  static calculateBackoff(attempt, initialBackoffMs = 1000) {
    if (attempt < 1) return 0;
    return initialBackoffMs * Math.pow(2, attempt - 1);
  }

  /**
   * Process a single group update with retry logic
   * This is a pure function that returns the next action to take
   * 
   * @param {Object} params - Parameters
   * @param {number} params.attempt - Current attempt number (1-indexed)
   * @param {number} params.maxRetries - Maximum number of retry attempts
   * @param {Error} [params.error] - Error from previous attempt (if any)
   * @returns {{action: 'retry'|'fail'|'initial', backoffMs?: number, errorMessage?: string}}
   */
  static getRetryAction(params) {
    const { attempt, maxRetries, error } = params;
    
    if (!error) {
      // No error - this is the initial attempt or a success
      return { action: 'initial' };
    }
    
    if (attempt >= maxRetries) {
      // All retries exhausted
      return {
        action: 'fail',
        errorMessage: `Failed after ${maxRetries} attempts: ${error.message || 'Unknown error'}`
      };
    }
    
    // Retry with backoff
    return {
      action: 'retry',
      backoffMs: this.calculateBackoff(attempt)
    };
  }

  /**
   * Create a group update result entry
   * @param {Object} group - Group info from GroupSubscription
   * @param {string} group.email - Group email address
   * @param {string} [group.name] - Group display name
   * @param {boolean} success - Whether the update succeeded
   * @param {string} [error] - Error message if failed
   * @returns {{groupEmail: string, groupName: string, success: boolean, error?: string}}
   */
  static createGroupUpdateResult(group, success, error) {
    return {
      groupEmail: group.email,
      groupName: group.name || group.email,
      success: success,
      error: error || null
    };
  }

  /**
   * Aggregate group update results into a summary
   * @param {Array<{success: boolean, error?: string}>} results - Individual group results
   * @returns {{successCount: number, failedCount: number, overallSuccess: boolean}}
   */
  static aggregateGroupResults(results) {
    const successCount = results.filter(r => r.success).length;
    const failedCount = results.filter(r => !r.success).length;
    
    return {
      successCount,
      failedCount,
      overallSuccess: failedCount === 0
    };
  }

  /**
   * Format the final email change result message
   * @param {boolean} overallSuccess - Whether all operations succeeded
   * @param {string} oldEmail - Original email (normalized)
   * @param {string} newEmail - New email (normalized)
   * @param {number} successCount - Number of successful group updates
   * @param {number} failedCount - Number of failed group updates
   * @returns {string} Formatted message
   */
  static formatEmailChangeMessage(overallSuccess, oldEmail, newEmail, successCount, failedCount) {
    if (overallSuccess) {
      return `Email changed successfully from ${oldEmail} to ${newEmail}`;
    }
    return `Email change completed with ${failedCount} error(s). ${successCount} group(s) updated successfully.`;
  }
};

// Node.js export for testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    Manager: EmailChangeService.Manager,
    VERIFICATION_CONFIG: EmailChangeService.VERIFICATION_CONFIG,
    EMAIL_REGEX: EmailChangeService.EMAIL_REGEX
  };
}
