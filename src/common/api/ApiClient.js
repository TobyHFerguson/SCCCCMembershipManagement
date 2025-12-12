// @ts-check
/// <reference path="../../types/global.d.ts" />

/**
 * Common.Api.Client - Base API client for SPA architecture
 * 
 * This module provides utilities for handling API requests in the new SPA
 * architecture using google.script.run on the client side.
 * 
 * Key features:
 * - Standardized response format
 * - Error handling patterns
 * - Authentication token validation
 * - Request/response logging
 * 
 * Architecture follows GAS Layer Separation pattern:
 * - ApiClientManager: Pure logic (testable)
 * - ApiClient: GAS layer (orchestration)
 * 
 * @namespace Common.Api.Client
 */

// Namespace declaration pattern (works in both GAS and Jest)
if (typeof Common === 'undefined') Common = {};
if (typeof Common.Api === 'undefined') Common.Api = {};

/**
 * @typedef {Object} ApiResponse
 * @property {boolean} success - Whether the operation succeeded
 * @property {*} [data] - Response data (if success)
 * @property {string} [error] - Error message (if failed)
 * @property {string} [errorCode] - Machine-readable error code
 * @property {Object} [meta] - Optional metadata (timing, version, etc.)
 */

/**
 * @typedef {Object} ApiRequest
 * @property {string} action - The API action to perform
 * @property {Object} [params] - Action parameters
 * @property {string} [token] - Authentication token
 */

/**
 * @typedef {Object} ActionHandler
 * @property {function(Object, string): ApiResponse} handler - The handler function
 * @property {boolean} [requiresAuth] - Whether authentication is required
 * @property {string} [description] - Action description
 */

/**
 * ApiClientManager - Pure logic for API request/response handling
 * All business logic is here and is fully testable with Jest.
 * 
 * @class
 */
Common.Api.ClientManager = class {
  /**
   * Create a successful response
   * @param {*} data - Response data
   * @param {Object} [meta] - Optional metadata
   * @returns {ApiResponse}
   */
  static successResponse(data, meta) {
    const response = {
      success: true,
      data: data
    };
    if (meta) {
      response.meta = meta;
    }
    return response;
  }

  /**
   * Create an error response
   * @param {string} error - Error message
   * @param {string} [errorCode] - Machine-readable error code
   * @param {Object} [meta] - Optional metadata
   * @returns {ApiResponse}
   */
  static errorResponse(error, errorCode, meta) {
    const response = {
      success: false,
      error: error,
      errorCode: errorCode || 'ERROR'
    };
    if (meta) {
      response.meta = meta;
    }
    return response;
  }

  /**
   * Validate an API request format
   * @param {*} request - The request to validate
   * @returns {{valid: boolean, error?: string}}
   */
  static validateRequest(request) {
    if (!request || typeof request !== 'object') {
      return { valid: false, error: 'Request must be an object' };
    }
    if (!request.action || typeof request.action !== 'string') {
      return { valid: false, error: 'Request must have an action string' };
    }
    if (request.action.trim() !== request.action) {
      return { valid: false, error: 'Action cannot have leading/trailing whitespace' };
    }
    return { valid: true };
  }

  /**
   * Validate that required parameters are present
   * @param {Object} params - Request parameters
   * @param {string[]} required - Required parameter names
   * @returns {{valid: boolean, missing?: string[]}}
   */
  static validateRequiredParams(params, required) {
    const missing = [];
    
    for (const param of required) {
      if (params[param] === undefined || params[param] === null || params[param] === '') {
        missing.push(param);
      }
    }
    
    if (missing.length > 0) {
      return { valid: false, missing: missing };
    }
    
    return { valid: true };
  }

  /**
   * Sanitize a string parameter (trim and limit length)
   * @param {*} value - Value to sanitize
   * @param {number} [maxLength=1000] - Maximum length
   * @returns {string}
   */
  static sanitizeString(value, maxLength = 1000) {
    if (value === null || value === undefined) {
      return '';
    }
    const str = String(value).trim();
    if (str.length > maxLength) {
      return str.substring(0, maxLength);
    }
    return str;
  }

  /**
   * Sanitize request parameters
   * @param {Object} params - Parameters to sanitize
   * @param {Object} schema - Schema defining max lengths per field
   * @returns {Object}
   */
  static sanitizeParams(params, schema = {}) {
    const result = {};
    
    for (const [key, value] of Object.entries(params || {})) {
      const maxLength = schema[key] || 1000;
      if (typeof value === 'string') {
        result[key] = this.sanitizeString(value, maxLength);
      } else if (typeof value === 'object' && value !== null) {
        // Recursively sanitize nested objects
        result[key] = this.sanitizeParams(value, schema[key] || {});
      } else {
        result[key] = value;
      }
    }
    
    return result;
  }

  /**
   * Create a request context with timing information
   * @param {string} action - Action name
   * @param {string} [requestId] - Optional request ID
   * @returns {{action: string, requestId: string, startTime: number}}
   */
  static createRequestContext(action, requestId) {
    return {
      action: action,
      requestId: requestId || this.generateRequestId(),
      startTime: Date.now()
    };
  }

  /**
   * Generate a unique request ID
   * @returns {string}
   */
  static generateRequestId() {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `${timestamp}-${random}`;
  }

  /**
   * Calculate request duration from context
   * @param {{startTime: number}} context - Request context
   * @returns {number} Duration in milliseconds
   */
  static getRequestDuration(context) {
    return Date.now() - context.startTime;
  }

  /**
   * Create metadata from request context
   * @param {{action: string, requestId: string, startTime: number}} context - Request context
   * @returns {Object}
   */
  static createMetaFromContext(context) {
    return {
      requestId: context.requestId,
      duration: this.getRequestDuration(context),
      action: context.action
    };
  }

  /**
   * Check if an action requires authentication
   * @param {string} action - Action name
   * @param {Record<string, ActionHandler>} handlers - Action handlers
   * @returns {boolean}
   */
  static actionRequiresAuth(action, handlers) {
    const handler = handlers[action];
    if (!handler) {
      return true; // Unknown actions require auth by default
    }
    return handler.requiresAuth !== false;
  }

  /**
   * List available actions
   * @param {Record<string, ActionHandler>} handlers - Action handlers
   * @param {boolean} [includePrivate=false] - Include private actions
   * @returns {Array<{action: string, requiresAuth: boolean, description?: string}>}
   */
  static listActions(handlers, includePrivate = false) {
    const actions = [];
    
    for (const [action, config] of Object.entries(handlers)) {
      if (!includePrivate && action.startsWith('_')) {
        continue;
      }
      actions.push({
        action: action,
        requiresAuth: config.requiresAuth !== false,
        description: config.description
      });
    }
    
    return actions.sort((a, b) => a.action.localeCompare(b.action));
  }

  /**
   * Format an error for logging (hide sensitive data)
   * @param {Error|string} error - The error
   * @param {Object} [request] - The request (optional, will be sanitized)
   * @returns {Object}
   */
  static formatErrorForLogging(error, request) {
    const result = {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    };
    
    if (request) {
      // Include action but not sensitive params
      result.action = request.action;
      result.hasParams = !!request.params;
      // Don't log token values
      result.hasToken = !!request.token;
    }
    
    return result;
  }
};

/**
 * ApiClient - GAS layer for handling API requests
 * Provides the runtime integration for SPA API calls
 */
Common.Api.Client = {
  /**
   * Registered action handlers
   * @type {Record<string, ActionHandler>}
   * @private
   */
  _handlers: {},

  /**
   * Register an action handler
   * @param {string} action - Action name
   * @param {function(Object, string): ApiResponse} handler - Handler function
   * @param {Object} [options] - Handler options
   * @param {boolean} [options.requiresAuth=true] - Whether authentication is required
   * @param {string} [options.description] - Action description
   */
  registerHandler: function(action, handler, options = {}) {
    this._handlers[action] = {
      handler: handler,
      requiresAuth: options.requiresAuth !== false,
      description: options.description
    };
  },

  /**
   * Handle an API request
   * @param {ApiRequest} request - The API request
   * @returns {string} JSON-encoded ApiResponse
   */
  handleRequest: function(request) {
    const context = Common.Api.ClientManager.createRequestContext(
      request && request.action,
      undefined
    );

    try {
      // PURE: Validate request format
      const validation = Common.Api.ClientManager.validateRequest(request);
      if (!validation.valid) {
        return this._respond(
          Common.Api.ClientManager.errorResponse(validation.error, 'INVALID_REQUEST'),
          context
        );
      }

      const action = request.action;
      const params = request.params || {};
      const token = request.token;

      // Check if action exists
      const handlerConfig = this._handlers[action];
      if (!handlerConfig) {
        return this._respond(
          Common.Api.ClientManager.errorResponse(
            `Unknown action: ${action}`,
            'UNKNOWN_ACTION'
          ),
          context
        );
      }

      // Check authentication if required
      if (handlerConfig.requiresAuth) {
        if (!token) {
          return this._respond(
            Common.Api.ClientManager.errorResponse(
              'Authentication required',
              'AUTH_REQUIRED'
            ),
            context
          );
        }
        
        // GAS: Validate token
        const email = Common.Auth.TokenManager.getEmailFromMUT(token);
        if (!email) {
          return this._respond(
            Common.Api.ClientManager.errorResponse(
              'Invalid or expired session',
              'INVALID_TOKEN'
            ),
            context
          );
        }

        // Add authenticated email to params
        params._authenticatedEmail = email;
      }

      // Execute handler
      const result = handlerConfig.handler(params, token);
      
      return this._respond(result, context);
    } catch (error) {
      // Log error (don't expose internal details to client)
      Logger.log('[ApiClient.handleRequest] Error: ' + error);
      Logger.log('[ApiClient.handleRequest] Stack: ' + (error && error.stack));
      
      return this._respond(
        Common.Api.ClientManager.errorResponse(
          'An internal error occurred',
          'INTERNAL_ERROR'
        ),
        context
      );
    }
  },

  /**
   * Format and return response
   * @private
   * @param {ApiResponse} response - The response
   * @param {Object} context - Request context
   * @returns {string} JSON-encoded response
   */
  _respond: function(response, context) {
    // Add metadata
    response.meta = Common.Api.ClientManager.createMetaFromContext(context);
    
    return JSON.stringify(response);
  },

  /**
   * List available actions (for documentation)
   * @returns {string} JSON-encoded action list
   */
  listActions: function() {
    const actions = Common.Api.ClientManager.listActions(this._handlers);
    return JSON.stringify(
      Common.Api.ClientManager.successResponse(actions)
    );
  },

  /**
   * Get handler configuration (for testing)
   * @param {string} action - Action name
   * @returns {ActionHandler|undefined}
   */
  getHandler: function(action) {
    return this._handlers[action];
  },

  /**
   * Clear all handlers (for testing)
   */
  clearHandlers: function() {
    this._handlers = {};
  }
};

// Node.js export for testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { 
    ApiClient: Common.Api.Client,
    ClientManager: Common.Api.ClientManager
  };
}
