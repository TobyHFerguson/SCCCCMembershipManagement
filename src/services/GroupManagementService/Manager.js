// @ts-check
/// <reference path="../../types/global.d.ts" />

/**
 * GroupManagementService.Manager - Pure business logic for group subscription management
 * 
 * This module contains all business logic for managing user group subscriptions.
 * It is fully testable with Jest as it has no GAS dependencies.
 * 
 * Architecture follows GAS Layer Separation pattern:
 * - Manager: Pure logic (testable)
 * - GAS layer (WebApp.js, Api.js): Orchestration and GAS API calls
 * 
 * @namespace GroupManagementService.Manager
 */

// Namespace declaration pattern (works in both GAS and Jest)
// @ts-ignore - Initializing namespace before adding properties
if (typeof GroupManagementService === 'undefined') GroupManagementService = {};

/**
 * @typedef {Object} PublicGroup
 * @property {string} Name - Human-readable group name
 * @property {string} Email - Group email address
 */

/**
 * @typedef {Object} GroupMember
 * @property {string} email - Member email address
 * @property {string} delivery_settings - Delivery setting value (e.g., 'ALL_MAIL', 'DIGEST')
 */

/**
 * @typedef {Object} GroupSubscription
 * @property {string} groupName - Human-readable group name
 * @property {string} groupEmail - Group email address
 * @property {string} deliveryValue - Delivery setting value (e.g., 'ALL_MAIL', 'UNSUBSCRIBE')
 * @property {string} deliveryName - Human-readable delivery setting name
 */

/**
 * @typedef {Object} SubscriptionUpdate
 * @property {string} groupEmail - Group email address
 * @property {string} deliveryValue - New delivery setting value
 */

/**
 * @typedef {Object} DeliveryOption
 * @property {string} value - Machine-readable value (e.g., 'ALL_MAIL')
 * @property {string} name - Human-readable name (e.g., 'Each message')
 * @property {string} description - Tooltip description
 */

/**
 * @typedef {Object} SubscriptionAction
 * @property {'subscribe'|'update'|'unsubscribe'} action - The action to perform
 * @property {string} groupEmail - Group email address
 * @property {string} userEmail - User email address
 * @property {string} [deliveryValue] - Delivery setting (for subscribe/update)
 */

/**
 * @typedef {Object} ValidationResult
 * @property {boolean} valid - Whether validation passed
 * @property {string} [error] - Error message if validation failed
 * @property {string} [errorCode] - Machine-readable error code
 */

/**
 * Default delivery options map
 * Maps delivery value to [human-readable name, tooltip description]
 * @type {Record<string, [string, string]>}
 */
const DEFAULT_DELIVERY_OPTIONS = {
  'UNSUBSCRIBE': ['Unsubscribed', 'Not subscribed to the group'],
  'ALL_MAIL': ['Each message', 'Receive an email for every message'],
  'DAILY': ['Abridged', 'Receive abridged, bundled emails (max 150 messages, at least once a day)'],
  'DIGEST': ['Digest', 'Receive bundled emails (max 25 messages)'],
  'NONE': ['None', 'Do not receive emails; read via the web app']
};

/**
 * GroupManagementService.Manager - Pure logic class for group subscription operations
 * All business logic is here and is fully testable with Jest.
 * 
 * @class
 */
GroupManagementService.Manager = class {
  /**
   * Get default delivery options
   * @returns {Record<string, [string, string]>}
   */
  static getDeliveryOptions() {
    return { ...DEFAULT_DELIVERY_OPTIONS };
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
    const trimmed = email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmed)) {
      return { valid: false, error: 'Invalid email format', errorCode: 'INVALID_EMAIL_FORMAT' };
    }
    return { valid: true };
  }

  /**
   * Validate a delivery value
   * @param {string} deliveryValue - The delivery value to validate
   * @param {Record<string, [string, string]>} [deliveryOptions] - Valid delivery options
   * @returns {ValidationResult}
   */
  static validateDeliveryValue(deliveryValue, deliveryOptions = DEFAULT_DELIVERY_OPTIONS) {
    if (!deliveryValue || typeof deliveryValue !== 'string') {
      return { valid: false, error: 'Delivery value must be a non-empty string', errorCode: 'INVALID_DELIVERY_VALUE' };
    }
    if (!deliveryOptions[deliveryValue]) {
      return { valid: false, error: `Invalid delivery value: ${deliveryValue}`, errorCode: 'UNKNOWN_DELIVERY_VALUE' };
    }
    return { valid: true };
  }

  /**
   * Validate a subscription update
   * @param {SubscriptionUpdate} update - The update to validate
   * @param {Record<string, [string, string]>} [deliveryOptions] - Valid delivery options
   * @returns {ValidationResult}
   */
  static validateSubscriptionUpdate(update, deliveryOptions = DEFAULT_DELIVERY_OPTIONS) {
    if (!update || typeof update !== 'object') {
      return { valid: false, error: 'Update must be an object', errorCode: 'INVALID_UPDATE' };
    }

    const emailValidation = this.validateEmail(update.groupEmail);
    if (!emailValidation.valid) {
      return { valid: false, error: `Invalid group email: ${emailValidation.error}`, errorCode: emailValidation.errorCode };
    }

    const deliveryValidation = this.validateDeliveryValue(update.deliveryValue, deliveryOptions);
    if (!deliveryValidation.valid) {
      return deliveryValidation;
    }

    return { valid: true };
  }

  /**
   * Validate an array of subscription updates
   * @param {SubscriptionUpdate[]} updates - The updates to validate
   * @param {Record<string, [string, string]>} [deliveryOptions] - Valid delivery options
   * @returns {ValidationResult}
   */
  static validateSubscriptionUpdates(updates, deliveryOptions = DEFAULT_DELIVERY_OPTIONS) {
    if (!Array.isArray(updates)) {
      return { valid: false, error: 'Updates must be an array', errorCode: 'INVALID_UPDATES' };
    }

    if (updates.length === 0) {
      return { valid: false, error: 'Updates array cannot be empty', errorCode: 'EMPTY_UPDATES' };
    }

    for (let i = 0; i < updates.length; i++) {
      const validation = this.validateSubscriptionUpdate(updates[i], deliveryOptions);
      if (!validation.valid) {
        return { valid: false, error: `Update at index ${i}: ${validation.error}`, errorCode: validation.errorCode };
      }
    }

    return { valid: true };
  }

  /**
   * Build a subscription object from group and member data
   * @param {ValidatedPublicGroup} group - The group
   * @param {GroupMember|null} member - The member (null if not subscribed)
   * @param {Record<string, [string, string]>} [deliveryOptions] - Delivery options map
   * @returns {GroupSubscription}
   */
  static buildSubscription(group, member, deliveryOptions = DEFAULT_DELIVERY_OPTIONS) {
    if (member && member.delivery_settings) {
      const deliveryValue = member.delivery_settings;
      const deliveryOption = deliveryOptions[deliveryValue];
      return {
        groupName: group.Name,
        groupEmail: group.Email,
        deliveryValue: deliveryValue,
        deliveryName: deliveryOption ? deliveryOption[0] : deliveryValue
      };
    } else {
      return {
        groupName: group.Name,
        groupEmail: group.Email,
        deliveryValue: 'UNSUBSCRIBE',
        deliveryName: 'UNSUBSCRIBED'
      };
    }
  }

  /**
   * Build subscriptions for a user across all groups
   * This is a pure transformation of group and member data.
   * 
   * @param {ValidatedPublicGroup[]} groups - All public groups
   * @param {Record<string, GroupMember|null>} membersByGroup - Member data keyed by group email
   * @param {Record<string, [string, string]>} [deliveryOptions] - Delivery options map
   * @returns {GroupSubscription[]}
   */
  static buildUserSubscriptions(groups, membersByGroup, deliveryOptions = DEFAULT_DELIVERY_OPTIONS) {
    return groups.map(group => {
      const member = membersByGroup[group.Email] || null;
      return this.buildSubscription(group, member, deliveryOptions);
    });
  }

  /**
   * Determine what action is needed for a subscription update
   * @param {SubscriptionUpdate} update - The update
   * @param {GroupMember|null} currentMember - Current member status (null if not subscribed)
   * @param {string} userEmail - User's email address
   * @returns {SubscriptionAction|null} Action to perform, or null if no action needed
   */
  static determineAction(update, currentMember, userEmail) {
    const isUnsubscribe = update.deliveryValue === 'UNSUBSCRIBE';
    const isCurrentlySubscribed = currentMember !== null;

    if (isUnsubscribe) {
      // Want to unsubscribe
      if (isCurrentlySubscribed) {
        return {
          action: 'unsubscribe',
          groupEmail: update.groupEmail,
          userEmail: userEmail
        };
      } else {
        // Already not subscribed, no action needed
        return null;
      }
    } else {
      // Want to subscribe or update
      if (isCurrentlySubscribed) {
        // Already subscribed, update delivery settings if different
        if (currentMember.delivery_settings !== update.deliveryValue) {
          return {
            action: 'update',
            groupEmail: update.groupEmail,
            userEmail: userEmail,
            deliveryValue: update.deliveryValue
          };
        } else {
          // Same settings, no action needed
          return null;
        }
      } else {
        // Not subscribed, need to subscribe
        return {
          action: 'subscribe',
          groupEmail: update.groupEmail,
          userEmail: userEmail,
          deliveryValue: update.deliveryValue
        };
      }
    }
  }

  /**
   * Calculate all actions needed for a set of subscription updates
   * @param {SubscriptionUpdate[]} updates - The updates to process
   * @param {Record<string, GroupMember|null>} currentMembersByGroup - Current member status by group
   * @param {string} userEmail - User's email address
   * @returns {{actions: SubscriptionAction[], skipped: number}}
   */
  static calculateActions(updates, currentMembersByGroup, userEmail) {
    const actions = [];
    let skipped = 0;

    for (const update of updates) {
      const currentMember = currentMembersByGroup[update.groupEmail] || null;
      const action = this.determineAction(update, currentMember, userEmail);
      
      if (action) {
        actions.push(action);
      } else {
        skipped++;
      }
    }

    return { actions, skipped };
  }

  /**
   * Convert delivery options to array format for frontend
   * @param {Record<string, [string, string]>} [deliveryOptions] - Delivery options map
   * @returns {DeliveryOption[]}
   */
  static getDeliveryOptionsArray(deliveryOptions = DEFAULT_DELIVERY_OPTIONS) {
    return Object.entries(deliveryOptions).map(([value, [name, description]]) => ({
      value,
      name,
      description
    }));
  }

  /**
   * Format a subscription update result for API response
   * @param {number} successCount - Number of successful updates
   * @param {number} failedCount - Number of failed updates
   * @param {string[]} [errors] - Error messages from failed updates
   * @returns {{success: boolean, message: string, details: {successCount: number, failedCount: number, errors?: string[]}}}
   */
  static formatUpdateResult(successCount, failedCount, errors) {
    const allSucceeded = failedCount === 0;
    let message;

    if (allSucceeded) {
      message = successCount === 1 
        ? 'Subscription updated successfully' 
        : `${successCount} subscriptions updated successfully`;
    } else if (successCount === 0) {
      message = 'Failed to update subscriptions';
    } else {
      message = `${successCount} subscriptions updated, ${failedCount} failed`;
    }

    const result = {
      success: allSucceeded,
      message,
      details: {
        successCount,
        failedCount
      }
    };

    if (errors && errors.length > 0) {
      result.details.errors = errors;
    }

    return result;
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
};

// Node.js export for testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    Manager: GroupManagementService.Manager,
    DEFAULT_DELIVERY_OPTIONS
  };
}
