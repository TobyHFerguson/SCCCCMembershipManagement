// @ts-check
/// <reference path="../../types/global.d.ts" />

/**
 * GroupManagementService.Api - GAS layer for group subscription API
 * 
 * This module provides the API endpoints for the GroupManagementService SPA.
 * It handles GAS API calls and orchestrates the Manager business logic.
 * 
 * Architecture follows GAS Layer Separation pattern:
 * - Api: GAS layer (orchestration, GAS API calls)
 * - Manager: Pure logic (testable)
 * 
 * @namespace GroupManagementService.Api
 */

// Namespace declaration pattern (works in both GAS and Jest)
// @ts-ignore
if (typeof GroupManagementService === 'undefined') GroupManagementService = {};

GroupManagementService.Api = GroupManagementService.Api || {};

/**
 * Get initial data for rendering GroupManagementService
 * Called by getServiceContent() for SPA initial page load
 * 
 * CRITICAL: No Date objects in return value - google.script.run cannot serialize them
 * 
 * LOGGING: Logs detailed execution flow to System Logs for debugging
 * Note: Service access is logged by getServiceContent() wrapper in webapp_endpoints.js
 * 
 * @param {string} email - Authenticated user email
 * @returns {{serviceName: string, subscriptions: Array, deliveryOptions: Object, error?: string}} Service data
 */
GroupManagementService.Api.getData = function(email) {
  Common.Logger.info('GroupManagementService', `getData() started for user: ${email}`);
  
  try {
    // Get user's current subscriptions
    Common.Logger.debug('GroupManagementService', `Fetching subscriptions for user: ${email}`);
    const subscriptions = GroupManagementService.getUserGroupSubscription(email);
    
    Common.Logger.info('GroupManagementService', `getData() completed successfully for user: ${email}`, {
      subscriptionCount: subscriptions ? subscriptions.length : 0
    });
    
    return {
      serviceName: 'Group Management',
      subscriptions: subscriptions,
      deliveryOptions: GroupSubscription.deliveryOptions
    };
  } catch (error) {
    Common.Logger.error('GroupManagementService', `getData() failed for user: ${email}`, error);
    return {
      serviceName: 'Group Management',
      error: `Failed to load subscriptions: ${error.message}`,
      subscriptions: [],
      deliveryOptions: {}
    };
  }
};

/**
 * Initialize API handlers for GroupManagementService
 * This should be called once during application startup
 */
GroupManagementService.initApi = function() {
  // Register getSubscriptions handler
  Common.Api.Client.registerHandler(
    'groupManagement.getSubscriptions',
    GroupManagementService.Api.handleGetSubscriptions,
    {
      requiresAuth: true,
      description: 'Get user\'s group subscriptions'
    }
  );

  // Register updateSubscriptions handler
  Common.Api.Client.registerHandler(
    'groupManagement.updateSubscriptions',
    GroupManagementService.Api.handleUpdateSubscriptions,
    {
      requiresAuth: true,
      description: 'Update user\'s group subscriptions'
    }
  );

  // Register getDeliveryOptions handler (public - for loading form options)
  Common.Api.Client.registerHandler(
    'groupManagement.getDeliveryOptions',
    GroupManagementService.Api.handleGetDeliveryOptions,
    {
      requiresAuth: false,
      description: 'Get available delivery options'
    }
  );
};

/**
 * GroupManagementService.Api - API handlers and GAS orchestration
 */

/**
 * Handle getSubscriptions API request
 * Gets user's current group subscription settings
 * 
 * @param {Object} params - Request parameters
 * @param {string} params._authenticatedEmail - Authenticated user's email (injected by ApiClient)
 * @returns {Common.Api.ApiResponse}
 */
GroupManagementService.Api.handleGetSubscriptions = function(params) {
    const userEmail = params._authenticatedEmail;
    
    if (!userEmail) {
      return Common.Api.ClientManager.errorResponse(
        'User email not available',
        'NO_EMAIL'
      );
    }

    try {
      // PURE: Normalize email
      const normalizedEmail = GroupManagementService.Manager.normalizeEmail(userEmail);

      // GAS: Get public groups
      /** @type {Array<{Name: string, Email: string}>} */
      const groups = /** @type {any} */ (Common.Data.Access.getPublicGroups());
      
      // GAS: Get member data for each group
      /** @type {Record<string, any>} */
      const membersByGroup = {};
      for (const group of groups) {
        try {
          const member = GroupSubscription.getMember(group.Email, normalizedEmail);
          membersByGroup[group.Email] = member;
        } catch (error) {
          // Log but continue - missing group membership is not fatal
          Logger.log('[GroupManagementService.Api] Error getting member for ' + group.Email + ': ' + error);
          membersByGroup[group.Email] = null;
        }
      }

      // PURE: Build subscriptions
      const subscriptions = GroupManagementService.Manager.buildUserSubscriptions(
        groups,
        membersByGroup,
        /** @type {Record<string, [string, string]>} */ (GroupSubscription.deliveryOptions || GroupManagementService.Manager.getDeliveryOptions())
      );

      // Return success response
      return Common.Api.ClientManager.successResponse({
        subscriptions: subscriptions,
        deliveryOptions: GroupManagementService.Manager.getDeliveryOptionsArray(
          /** @type {Record<string, [string, string]>} */ (GroupSubscription.deliveryOptions || GroupManagementService.Manager.getDeliveryOptions())
        )
      });
    } catch (error) {
      Logger.log('[GroupManagementService.Api] handleGetSubscriptions error: ' + error);
      return Common.Api.ClientManager.errorResponse(
        'Failed to get subscriptions',
        'GET_SUBSCRIPTIONS_ERROR'
      );
    }
  };

/**
 * Handle updateSubscriptions API request
 * Updates user's group subscription settings
 * 
 * LOGGING: Logs full execution flow including validation, actions, and results
 * Creates audit entries for subscription changes
 * 
 * @param {Object} params - Request parameters
 * @param {string} params._authenticatedEmail - Authenticated user's email (injected by ApiClient)
 * @param {Array} params.updates - Array of subscription updates
 * @returns {Common.Api.ApiResponse}
 */
GroupManagementService.Api.handleUpdateSubscriptions = function(params) {
    const userEmail = params._authenticatedEmail;
    const updates = params.updates;
    
    Common.Logger.info('GroupManagementService', `handleUpdateSubscriptions() started for user: ${userEmail}`, {
      updateCount: updates ? updates.length : 0
    });

    if (!userEmail) {
      Common.Logger.error('GroupManagementService', 'handleUpdateSubscriptions() failed: No user email');
      return Common.Api.ClientManager.errorResponse(
        'User email not available',
        'NO_EMAIL'
      );
    }

    // PURE: Validate updates
    Common.Logger.debug('GroupManagementService', `Validating ${updates.length} subscription updates`);
    const validation = GroupManagementService.Manager.validateSubscriptionUpdates(
      updates,
      /** @type {Record<string, [string, string]>} */ (GroupSubscription.deliveryOptions || GroupManagementService.Manager.getDeliveryOptions())
    );

    if (!validation.valid) {
      Common.Logger.warn('GroupManagementService', `Validation failed for user: ${userEmail}`, {
        error: validation.error,
        errorCode: validation.errorCode
      });
      return Common.Api.ClientManager.errorResponse(
        validation.error,
        validation.errorCode
      );
    }

    try {
      // PURE: Normalize email
      const normalizedEmail = GroupManagementService.Manager.normalizeEmail(userEmail);

      // GAS: Get current member status for each group being updated
      Common.Logger.debug('GroupManagementService', `Fetching current member status for ${updates.length} groups`);
      /** @type {Record<string, any>} */
      const currentMembersByGroup = {};
      for (const update of updates) {
        try {
          const member = GroupSubscription.getMember(update.groupEmail, normalizedEmail);
          currentMembersByGroup[update.groupEmail] = member;
        } catch (error) {
          Common.Logger.warn('GroupManagementService', `Error getting member for ${update.groupEmail}`, error);
          currentMembersByGroup[update.groupEmail] = null;
        }
      }

      // PURE: Calculate actions
      Common.Logger.debug('GroupManagementService', 'Calculating required actions');
      const { actions, skipped } = GroupManagementService.Manager.calculateActions(
        updates,
        currentMembersByGroup,
        normalizedEmail
      );
      
      Common.Logger.info('GroupManagementService', `Actions calculated: ${actions.length} to execute, ${skipped.length} skipped`);

      // GAS: Execute actions
      let successCount = 0;
      let failedCount = 0;
      const errors = [];

      for (const action of actions) {
        try {
          Common.Logger.debug('GroupManagementService', `Executing action: ${action.action} for ${action.groupEmail}`);
          GroupManagementService.Api._executeAction(action);
          successCount++;
        } catch (error) {
          failedCount++;
          errors.push(`${action.groupEmail}: ${error.message || error}`);
          Common.Logger.error('GroupManagementService', `Action failed for ${action.groupEmail}`, {
            action: action,
            error: error.message
          });
        }
      }

      // PURE: Format result
      const result = GroupManagementService.Manager.formatUpdateResult(
        successCount,
        failedCount,
        errors
      );
      
      // Create audit entry for subscription changes
      const logger = new Common.Logging.ServiceLogger('GroupManagementService', userEmail);
      const auditEntry = logger.logOperation(
        'SubscriptionUpdate',
        result.success ? 'success' : 'fail',
        `Updated ${successCount} subscriptions${failedCount > 0 ? `, ${failedCount} failed` : ''}`,
        result.success ? undefined : result.message,
        {
          successCount: successCount,
          failedCount: failedCount,
          actionCount: actions.length,
          skippedCount: skipped.length,
          errors: errors
        }
      );
      
      // Persist audit entry
      try {
        const auditFiddler = SpreadsheetManager.getFiddler('Audit');
        AuditPersistence.persistAuditEntries(auditFiddler, [auditEntry]);
      } catch (auditError) {
        Common.Logger.error('GroupManagementService', 'Failed to persist audit entry', auditError);
      }

      Common.Logger.info('GroupManagementService', `handleUpdateSubscriptions() completed for user: ${userEmail}`, {
        success: result.success,
        successCount: successCount,
        failedCount: failedCount
      });

      if (result.success) {
        return Common.Api.ClientManager.successResponse(result);
      } else {
        return Common.Api.ClientManager.errorResponse(
          result.message,
          'UPDATE_FAILED',
          { details: result.details }
        );
      }
    } catch (error) {
      Logger.log('[GroupManagementService.Api] handleUpdateSubscriptions error: ' + error);
      return Common.Api.ClientManager.errorResponse(
        'Failed to update subscriptions',
        'UPDATE_SUBSCRIPTIONS_ERROR'
      );
    }
  };

/**
 * Handle getDeliveryOptions API request
 * Returns available delivery options for the dropdown
 * 
 * @returns {Common.Api.ApiResponse}
 */
GroupManagementService.Api.handleGetDeliveryOptions = function() {
    try {
      const options = GroupManagementService.Manager.getDeliveryOptionsArray(
        /** @type {Record<string, [string, string]>} */ (GroupSubscription.deliveryOptions || GroupManagementService.Manager.getDeliveryOptions())
      );

      return Common.Api.ClientManager.successResponse({
        deliveryOptions: options
      });
    } catch (error) {
      Logger.log('[GroupManagementService.Api] handleGetDeliveryOptions error: ' + error);
      return Common.Api.ClientManager.errorResponse(
        'Failed to get delivery options',
        'GET_OPTIONS_ERROR'
      );
    }
  };

/**
 * Execute a subscription action
 * @private
 * @param {Object} action - The action to execute
 * @param {'subscribe'|'update'|'unsubscribe'} action.action - Action type
 * @param {string} action.groupEmail - Group email
 * @param {string} action.userEmail - User email
 * @param {string} [action.deliveryValue] - Delivery setting (for subscribe/update)
 */
GroupManagementService.Api._executeAction = function(action) {
    switch (action.action) {
      case 'unsubscribe':
        // GAS: Remove member from group
        GroupSubscription.removeMember(action.groupEmail, action.userEmail);
        Logger.log('[GroupManagementService.Api] Unsubscribed ' + action.userEmail + ' from ' + action.groupEmail);
        break;

      case 'subscribe':
        // GAS: Subscribe member to group
        const newMember = {
          email: action.userEmail,
          delivery_settings: action.deliveryValue
        };
        GroupSubscription.subscribeMember(newMember, action.groupEmail);
        Logger.log('[GroupManagementService.Api] Subscribed ' + action.userEmail + ' to ' + action.groupEmail);
        break;

      case 'update':
        // GAS: Get current member and update delivery settings
        // Note: We re-fetch the member here to handle potential race conditions
        // where the member was removed between calculateActions and _executeAction.
        // This fallback to subscribe ensures the user's intent is fulfilled.
        const member = GroupSubscription.getMember(action.groupEmail, action.userEmail);
        if (member) {
          member.delivery_settings = action.deliveryValue;
          GroupSubscription.updateMember(member, action.groupEmail);
          Logger.log('[GroupManagementService.Api] Updated ' + action.userEmail + ' in ' + action.groupEmail);
        } else {
          // Member not found (possibly removed since action was calculated)
          // Fall back to subscribe to fulfill user's intent
          Logger.log('[GroupManagementService.Api] WARNING: Member not found for update, falling back to subscribe');
          const fallbackMember = {
            email: action.userEmail,
            delivery_settings: action.deliveryValue
          };
          GroupSubscription.subscribeMember(fallbackMember, action.groupEmail);
          Logger.log('[GroupManagementService.Api] Subscribed (update fallback) ' + action.userEmail + ' to ' + action.groupEmail);
        }
        break;

      default:
        throw new Error('Unknown action: ' + action.action);
    }
  };

// Node.js export for testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    Api: GroupManagementService.Api,
    initApi: GroupManagementService.initApi
  };
}
