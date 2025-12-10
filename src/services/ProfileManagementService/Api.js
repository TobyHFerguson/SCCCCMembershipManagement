// @ts-check
/// <reference path="../../types/global.d.ts" />

/**
 * ProfileManagementService.Api - GAS layer for profile management API
 * 
 * This module provides the API endpoints for the ProfileManagementService SPA.
 * It handles GAS API calls and orchestrates the Manager business logic.
 * 
 * Architecture follows GAS Layer Separation pattern:
 * - Api: GAS layer (orchestration, GAS API calls)
 * - Manager: Pure logic (testable)
 * 
 * @namespace ProfileManagementService.Api
 */

// Namespace declaration pattern (works in both GAS and Jest)
if (typeof ProfileManagementService === 'undefined') ProfileManagementService = {};

ProfileManagementService.Api = ProfileManagementService.Api || {};

/**
 * Get initial data for rendering ProfileManagementService
 * Called by getServiceContent() for SPA initial page load
 * 
 * @param {string} email - Authenticated user email
 * @returns {{serviceName: string, profile: Object}} Service data
 */
ProfileManagementService.Api.getData = function(email) {
  console.log('ProfileManagementService.Api.getData(', email, ')');
  
  // PURE: Normalize email
  const normalizedEmail = ProfileManagementService.Manager.normalizeEmail(email);
  
  // GAS: Get member profile
  const profile = Common.Data.Access.getMember(normalizedEmail);
  
  if (!profile) {
    return {
      serviceName: 'Profile Management',
      error: 'Profile not found',
      email: email
    };
  }
  
  // PURE: Format profile for display (client-safe view)
  const displayProfile = ProfileManagementService.Manager.formatProfileForDisplay(profile);
  
  // GAS: Format dates for local timezone display and remove Date objects (google.script.run can't serialize them)
  if (displayProfile.Joined) {
    displayProfile.JoinedFormatted = Utilities.formatDate(displayProfile.Joined, Session.getScriptTimeZone(), 'MMM d, yyyy');
    delete displayProfile.Joined; // Remove Date object
  }
  if (displayProfile.Expires) {
    displayProfile.ExpiresFormatted = Utilities.formatDate(displayProfile.Expires, Session.getScriptTimeZone(), 'MMM d, yyyy');
    delete displayProfile.Expires; // Remove Date object
  }
  if (displayProfile['Renewed On']) {
    displayProfile.RenewedOnFormatted = Utilities.formatDate(displayProfile['Renewed On'], Session.getScriptTimeZone(), 'MMM d, yyyy');
    delete displayProfile['Renewed On']; // Remove Date object
  }
  
  return {
    serviceName: 'Profile Management',
    profile: displayProfile,
    email: email
  };
};

/**
 * Initialize API handlers for ProfileManagementService
 * This should be called once during application startup
 */
ProfileManagementService.initApi = function() {
  // Register getProfile handler
  Common.Api.Client.registerHandler(
    'profileManagement.getProfile',
    ProfileManagementService.Api.handleGetProfile,
    {
      requiresAuth: true,
      description: 'Get user\'s profile data'
    }
  );

  // Register updateProfile handler
  Common.Api.Client.registerHandler(
    'profileManagement.updateProfile',
    ProfileManagementService.Api.handleUpdateProfile,
    {
      requiresAuth: true,
      description: 'Update user\'s profile data'
    }
  );

  // Register getEditableFields handler (returns only fields user can edit)
  Common.Api.Client.registerHandler(
    'profileManagement.getEditableFields',
    ProfileManagementService.Api.handleGetEditableFields,
    {
      requiresAuth: true,
      description: 'Get editable profile fields for user'
    }
  );
};

/**
 * ProfileManagementService.Api - API handlers and GAS orchestration
 */

/**
 * Handle getProfile API request
 * Gets user's full profile data
 * 
 * @param {Object} params - Request parameters
 * @param {string} params._authenticatedEmail - Authenticated user's email (injected by ApiClient)
 * @returns {Common.Api.ApiResponse}
 */
ProfileManagementService.Api.handleGetProfile = function(params) {
    const userEmail = params._authenticatedEmail;
    
    if (!userEmail) {
      return Common.Api.ClientManager.errorResponse(
        'User email not available',
        'NO_EMAIL'
      );
    }

    try {
      // PURE: Normalize email
      const normalizedEmail = ProfileManagementService.Manager.normalizeEmail(userEmail);

      // GAS: Get member profile
      const profile = Common.Data.Access.getMember(normalizedEmail);
      
      if (!profile) {
        return Common.Api.ClientManager.errorResponse(
          'Profile not found',
          'PROFILE_NOT_FOUND'
        );
      }

      // PURE: Format profile for display (client-safe view)
      const displayProfile = ProfileManagementService.Manager.formatProfileForDisplay(profile);

      // GAS: Format dates for local timezone display
      if (displayProfile.Joined) {
        displayProfile.JoinedFormatted = Utilities.formatDate(displayProfile.Joined, Session.getScriptTimeZone(), 'MMM d, yyyy');
      }
      if (displayProfile.Expires) {
        displayProfile.ExpiresFormatted = Utilities.formatDate(displayProfile.Expires, Session.getScriptTimeZone(), 'MMM d, yyyy');
      }
      if (displayProfile['Renewed On']) {
        displayProfile.RenewedOnFormatted = Utilities.formatDate(displayProfile['Renewed On'], Session.getScriptTimeZone(), 'MMM d, yyyy');
      }

      // Return success response
      return Common.Api.ClientManager.successResponse({
        profile: displayProfile
      });
    } catch (error) {
      Logger.log('[ProfileManagementService.Api] handleGetProfile error: ' + error);
      return Common.Api.ClientManager.errorResponse(
        'Failed to get profile',
        'GET_PROFILE_ERROR'
      );
    }
  };

/**
 * Handle getEditableFields API request
 * Gets only the editable fields from user's profile
 * 
 * @param {Object} params - Request parameters
 * @param {string} params._authenticatedEmail - Authenticated user's email (injected by ApiClient)
 * @returns {Common.Api.ApiResponse}
 */
ProfileManagementService.Api.handleGetEditableFields = function(params) {
    const userEmail = params._authenticatedEmail;
    
    if (!userEmail) {
      return Common.Api.ClientManager.errorResponse(
        'User email not available',
        'NO_EMAIL'
      );
    }

    try {
      // PURE: Normalize email
      const normalizedEmail = ProfileManagementService.Manager.normalizeEmail(userEmail);

      // GAS: Get member profile
      const profile = Common.Data.Access.getMember(normalizedEmail);
      
      if (!profile) {
        return Common.Api.ClientManager.errorResponse(
          'Profile not found',
          'PROFILE_NOT_FOUND'
        );
      }

      // PURE: Get editable fields only
      const editableFields = ProfileManagementService.Manager.getEditableFields(profile);

      // Return success response
      return Common.Api.ClientManager.successResponse({
        profile: editableFields,
        fieldSchema: ProfileManagementService.Manager.getProfileFieldSchema()
      });
    } catch (error) {
      Logger.log('[ProfileManagementService.Api] handleGetEditableFields error: ' + error);
      return Common.Api.ClientManager.errorResponse(
        'Failed to get profile fields',
        'GET_FIELDS_ERROR'
      );
    }
  };

/**
 * Handle updateProfile API request
 * Updates user's profile data
 * 
 * @param {Object} params - Request parameters
 * @param {string} params._authenticatedEmail - Authenticated user's email (injected by ApiClient)
 * @param {Object} params.updates - Profile updates to apply
 * @returns {Common.Api.ApiResponse}
 */
ProfileManagementService.Api.handleUpdateProfile = function(params) {
    const userEmail = params._authenticatedEmail;
    const updates = params.updates;

    if (!userEmail) {
      return Common.Api.ClientManager.errorResponse(
        'User email not available',
        'NO_EMAIL'
      );
    }

    if (!updates || typeof updates !== 'object') {
      return Common.Api.ClientManager.errorResponse(
        'Profile updates must be provided',
        'INVALID_UPDATES'
      );
    }

    try {
      // PURE: Normalize email
      const normalizedEmail = ProfileManagementService.Manager.normalizeEmail(userEmail);

      // GAS: Get current profile
      const originalProfile = Common.Data.Access.getMember(normalizedEmail);
      
      if (!originalProfile) {
        return Common.Api.ClientManager.errorResponse(
          'Profile not found',
          'PROFILE_NOT_FOUND'
        );
      }

      // PURE: Process the update (validation, forbidden field check, merge)
      const result = ProfileManagementService.Manager.processProfileUpdate(
        originalProfile,
        updates,
        ProfileManagementService.Manager.getForbiddenFields()
      );

      if (!result.success) {
        return Common.Api.ClientManager.errorResponse(
          result.message,
          'UPDATE_VALIDATION_FAILED'
        );
      }

      // GAS: Persist the update
      Common.Data.Access.updateMember(normalizedEmail, result.mergedProfile);

      // Log successful update
      Logger.log('[ProfileManagementService.Api] Profile updated for: ' + normalizedEmail);

      // Return success response
      return Common.Api.ClientManager.successResponse({
        success: true,
        message: result.message,
        profile: ProfileManagementService.Manager.formatProfileForDisplay(result.mergedProfile)
      });
    } catch (error) {
      Logger.log('[ProfileManagementService.Api] handleUpdateProfile error: ' + error);
      return Common.Api.ClientManager.errorResponse(
        'Failed to update profile',
        'UPDATE_PROFILE_ERROR'
      );
    }
  };

// Node.js export for testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    Api: ProfileManagementService.Api,
    initApi: ProfileManagementService.initApi
  };
}
