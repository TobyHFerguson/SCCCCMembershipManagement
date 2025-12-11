// @ts-check
/// <reference path="../../types/global.d.ts" />

/**
 * DirectoryService.Api - GAS layer for directory API
 * 
 * This module provides the API endpoints for the DirectoryService SPA.
 * It handles GAS API calls and orchestrates the Manager business logic.
 * 
 * Architecture follows GAS Layer Separation pattern:
 * - Api: GAS layer (orchestration, GAS API calls)
 * - Manager: Pure logic (testable)
 * 
 * @namespace DirectoryService.Api
 */

// Namespace declaration pattern (works in both GAS and Jest)
// @ts-ignore
if (typeof DirectoryService === 'undefined') DirectoryService = {};
DirectoryService.Api = DirectoryService.Api || {};

/**
 * Get initial data for DirectoryService SPA
 * Called by getServiceContent to provide data to client renderer
 * 
 * CRITICAL: No Date objects in return value - google.script.run cannot serialize them
 * 
 * LOGGING: Logs detailed execution flow to System Logs for debugging
 * Note: Service access is logged by getServiceContent() wrapper in webapp_endpoints.js
 * 
 * @param {string} email - Authenticated user's email
 * @returns {{serviceName: string, directoryEntries: Array, email: string, error?: string}} Service data for client renderer
 */
DirectoryService.Api.getData = function(email) {
  Common.Logger.info('DirectoryService', `getData() started for user: ${email}`);
  
  try {
    // GAS: Get directory entries (security boundary - only returns public data)
    Common.Logger.debug('DirectoryService', 'Fetching directory entries');
    const directoryEntries = DirectoryService.getDirectoryEntries();
    
    Common.Logger.info('DirectoryService', `getData() completed successfully for user: ${email}`, {
      entryCount: directoryEntries ? directoryEntries.length : 0
    });
    
    return {
      serviceName: 'Directory',
      directoryEntries: directoryEntries,
      email: email
    };
  } catch (error) {
    Common.Logger.error('DirectoryService', `getData() failed for user: ${email}`, error);
    return {
      serviceName: 'Directory',
      error: `Failed to load directory: ${error.message}`,
      directoryEntries: [],
      email: email
    };
  }
};

/**
 * Initialize API handlers for DirectoryService
 * This should be called once during application startup
 */
DirectoryService.initApi = function() {
  // Register getDirectoryEntries handler
  Common.Api.Client.registerHandler(
    'directory.getEntries',
    DirectoryService.Api.handleGetEntries,
    {
      requiresAuth: true,
      description: 'Get directory entries for active members'
    }
  );

  // Register getDirectoryStats handler
  Common.Api.Client.registerHandler(
    'directory.getStats',
    DirectoryService.Api.handleGetStats,
    {
      requiresAuth: true,
      description: 'Get directory statistics'
    }
  );
};

/**
 * DirectoryService.Api - API handlers and GAS orchestration
 */

/**
 * Handle getEntries API request
 * Gets directory entries for active public members
 * 
 * @param {Object} params - Request parameters
 * @param {string} params._authenticatedEmail - Authenticated user's email (injected by ApiClient)
 * @param {string} [params.searchTerm] - Optional search term to filter results
 * @returns {Common.Api.ApiResponse}
 */
DirectoryService.Api.handleGetEntries = function(params) {
    const userEmail = params._authenticatedEmail;
    const searchTerm = params.searchTerm;
    
    if (!userEmail) {
      return Common.Api.ClientManager.errorResponse(
        'User email not available',
        'NO_EMAIL'
      );
    }

    // PURE: Validate search term if provided
    if (searchTerm !== undefined && searchTerm !== null) {
      const validation = DirectoryService.Manager.validateSearchTerm(searchTerm);
      if (!validation.valid) {
        return Common.Api.ClientManager.errorResponse(
          validation.error,
          validation.errorCode
        );
      }
    }

    try {
      // GAS: Get all members
      const members = Common.Data.Access.getMembers();

      // PURE: Process directory (filter, transform, sort)
      const entries = DirectoryService.Manager.processDirectory(members, {
        searchTerm: searchTerm
      });

      // Return success response
      return Common.Api.ClientManager.successResponse({
        entries: entries,
        count: entries.length
      });
    } catch (error) {
      Logger.log('[DirectoryService.Api] handleGetEntries error: ' + error);
      return Common.Api.ClientManager.errorResponse(
        'Failed to get directory entries',
        'GET_ENTRIES_ERROR'
      );
    }
  };

/**
 * Handle getStats API request
 * Gets directory statistics
 * 
 * @param {Object} params - Request parameters
 * @param {string} params._authenticatedEmail - Authenticated user's email (injected by ApiClient)
 * @returns {Common.Api.ApiResponse}
 */
DirectoryService.Api.handleGetStats = function(params) {
    const userEmail = params._authenticatedEmail;
    
    if (!userEmail) {
      return Common.Api.ClientManager.errorResponse(
        'User email not available',
        'NO_EMAIL'
      );
    }

    try {
      // GAS: Get all members
      const members = Common.Data.Access.getMembers();

      // PURE: Get directory statistics
      const stats = DirectoryService.Manager.getDirectoryStats(members);

      // Return success response
      return Common.Api.ClientManager.successResponse({
        stats: stats
      });
    } catch (error) {
      Logger.log('[DirectoryService.Api] handleGetStats error: ' + error);
      return Common.Api.ClientManager.errorResponse(
        'Failed to get directory statistics',
        'GET_STATS_ERROR'
      );
    }
  };

// Node.js export for testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    Api: DirectoryService.Api,
    initApi: DirectoryService.initApi
  };
}
