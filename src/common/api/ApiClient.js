// @ts-check
/// <reference path="../../types/global.d.ts" />

/**
 * ApiClient - Base API client for SPA architecture
 *
 * CRITICAL: This module is in Layer 1 (Infrastructure).
 * - Uses TokenManager for authentication (Layer 0)
 * - Uses GAS built-in Logger.log() for tracing
 *
 * Pattern: IIFE-wrapped classes with static methods (per gas-best-practices.md)
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
 */

/**
 * @typedef {{success: boolean, data?: unknown, error?: string, errorCode?: string, meta?: {requestId: string, duration: number, action: string}}} ApiResponse
 * Standard API response format
 * @property {boolean} success - Whether the operation succeeded
 * @property {unknown} [data] - Response data (if success)
 * @property {string} [error] - Error message (if failed)
 * @property {string} [errorCode] - Machine-readable error code
 * @property {{requestId: string, duration: number, action: string}} [meta] - Optional metadata with request tracking
 */

/**
 * @typedef {{action: string, params?: Record<string, unknown>, token?: string}} ApiRequest
 * Standard API request format
 * @property {string} action - The API action to perform
 * @property {Record<string, unknown>} [params] - Action parameters (key-value pairs, params are truly dynamic API data - JUSTIFIED: arbitrary API data from diverse service endpoints)
 * @property {string} [token] - Authentication token
 */

/**
 * @typedef {Object} ActionHandler
 * Action handler configuration
 * @property {function(Record<string, unknown>, string): ApiResponse} handler - The handler function (params, token) => ApiResponse (JUSTIFIED: dispatches to any action handler with dynamic params) - params are truly dynamic API data - JUSTIFIED: arbitrary API data from diverse service endpoints
 * @property {boolean} [requiresAuth] - Whether authentication is required
 * @property {string} [description] - Action description
 */

/**
 * ApiClientManager - Pure logic for API request/response handling
 * All business logic is here and is fully testable with Jest.
 *
 * Pattern: IIFE-wrapped class with static methods
 */
var ApiClientManager = (function () {
    class ApiClientManager {
        /**
         * Create a successful response
         * @param {unknown} data - Response data
         * @param {Record<string, unknown>} [meta] - Optional metadata (key-value pairs - JUSTIFIED: arbitrary metadata from diverse contexts)
         * @returns {ApiResponse}
         */
        static successResponse(data, meta) {
            var response = {
                success: true,
                data: data,
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
         * @param {Record<string, unknown>} [meta] - Optional metadata (key-value pairs - JUSTIFIED: arbitrary metadata from diverse contexts)
         * @returns {ApiResponse}
         */
        static errorResponse(error, errorCode, meta) {
            var response = {
                success: false,
                error: error,
                errorCode: errorCode || 'ERROR',
            };
            if (meta) {
                response.meta = meta;
            }
            return response;
        }

        /**
         * Validate an API request format
         * @param {unknown} request - The request to validate
         * @returns {{valid: boolean, error?: string}}
         */
        static validateRequest(request) {
            if (!request || typeof request !== 'object') {
                return { valid: false, error: 'Request must be an object' };
            }
            // Type guard: check if request has action property
            var req = /** @type {Record<string, unknown>} */ (request);
            if (!req.action || typeof req.action !== 'string') {
                return { valid: false, error: 'Request must have an action string' };
            }
            var action = /** @type {string} */ (req.action);
            if (action.trim() !== action) {
                return { valid: false, error: 'Action cannot have leading/trailing whitespace' };
            }
            return { valid: true };
        }

        /**
         * Validate that required parameters are present
         * @param {Record<string, unknown>} params - Request parameters (key-value pairs - JUSTIFIED: arbitrary API data from diverse service endpoints)
         * @param {string[]} required - Required parameter names
         * @returns {{valid: boolean, missing?: string[]}}
         */
        static validateRequiredParams(params, required) {
            var missing = [];

            for (var i = 0; i < required.length; i++) {
                var param = required[i];
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
         * @param {unknown} value - Value to sanitize
         * @param {number} [maxLength=1000] - Maximum length
         * @returns {string}
         */
        static sanitizeString(value, maxLength) {
            if (maxLength === undefined) maxLength = 1000;
            if (value === null || value === undefined) {
                return '';
            }
            var str = String(value).trim();
            if (str.length > maxLength) {
                return str.substring(0, maxLength);
            }
            return str;
        }

        /**
         * Sanitize request parameters
         * @param {Record<string, unknown>} params - Parameters to sanitize (key-value pairs - JUSTIFIED: arbitrary API data from diverse service endpoints)
         * @param {Record<string, number | Record<string, unknown>>} schema - Schema defining max lengths per field (JUSTIFIED: recursive schema structure with arbitrary nested data)
         * @returns {Record<string, unknown>} Sanitized parameters (JUSTIFIED: mirrors input parameter structure)
         */
        static sanitizeParams(params, schema) {
            if (schema === undefined) schema = {};
            /** @type {Record<string, unknown>} */
            var result = {};

            var entries = Object.entries(params || {});
            for (var i = 0; i < entries.length; i++) {
                var key = entries[i][0];
                var value = entries[i][1];
                var schemaValue = schema[key];
                if (typeof value === 'string') {
                    // For strings, schema value should be a number (max length)
                    var maxLength = typeof schemaValue === 'number' ? schemaValue : 1000;
                    result[key] = ApiClientManager.sanitizeString(value, maxLength);
                } else if (typeof value === 'object' && value !== null) {
                    // Recursively sanitize nested objects
                    var nestedSchema = typeof schemaValue === 'object' && schemaValue !== null ? /** @type {Record<string, unknown>} */ (schemaValue) : {};
                    result[key] = ApiClientManager.sanitizeParams(/** @type {Record<string, unknown>} */ (value), /** @type {Record<string, number | Record<string, unknown>>} */ (nestedSchema));
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
                requestId: requestId || ApiClientManager.generateRequestId(),
                startTime: Date.now(),
            };
        }

        /**
         * Generate a unique request ID
         * @returns {string}
         */
        static generateRequestId() {
            var timestamp = Date.now().toString(36);
            var random = Math.random().toString(36).substring(2, 8);
            return timestamp + '-' + random;
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
         * @returns {{requestId: string, duration: number, action: string}}
         */
        static createMetaFromContext(context) {
            return {
                requestId: context.requestId,
                duration: ApiClientManager.getRequestDuration(context),
                action: context.action,
            };
        }

        /**
         * Check if an action requires authentication
         * @param {string} action - Action name
         * @param {Record<string, ActionHandler>} handlers - Action handlers
         * @returns {boolean}
         */
        static actionRequiresAuth(action, handlers) {
            var handler = handlers[action];
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
        static listActions(handlers, includePrivate) {
            if (includePrivate === undefined) includePrivate = false;
            var actions = [];

            var entries = Object.entries(handlers);
            for (var i = 0; i < entries.length; i++) {
                var action = entries[i][0];
                var config = entries[i][1];
                if (!includePrivate && action.startsWith('_')) {
                    continue;
                }
                actions.push({
                    action: action,
                    requiresAuth: config.requiresAuth !== false,
                    description: config.description,
                });
            }

            return actions.sort(function (a, b) {
                return a.action.localeCompare(b.action);
            });
        }

        /**
         * Format an error for logging (hide sensitive data)
         * @param {Error|string} error - The error
         * @param {{action?: string, params?: Record<string, unknown>, token?: string}} [request] - The request (optional, will be sanitized, params are truly dynamic API data - JUSTIFIED: arbitrary API data from diverse service endpoints)
         * @returns {{message: string, stack?: string, action?: string, hasParams?: boolean, hasToken?: boolean}}
         */
        static formatErrorForLogging(error, request) {
            var result = {
                message: error instanceof Error ? error.message : String(error),
                stack: error instanceof Error ? error.stack : undefined,
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
    }

    return ApiClientManager;
})();

/**
 * ApiClient - GAS layer for handling API requests
 * Provides the runtime integration for SPA API calls
 *
 * Pattern: IIFE-wrapped class with static methods
 */
var ApiClient = (function () {
    /**
     * Registered action handlers
     * @type {Record<string, ActionHandler>}
     * @private
     */
    var _handlers = {};

    class ApiClient {
        /**
         * Register an action handler
         * @param {string} action - Action name
         * @param {function(Record<string, unknown>, string): ApiResponse} handler - Handler function (params are truly dynamic API data - JUSTIFIED: arbitrary API data from diverse service endpoints)
         * @param {{requiresAuth?: boolean, description?: string}} [options] - Handler options (requiresAuth defaults to true, description is optional)
         */
        static registerHandler(action, handler, options) {
            if (options === undefined) options = {};
            _handlers[action] = {
                handler: handler,
                requiresAuth: options.requiresAuth !== false,
                description: options.description,
            };
        }

        /**
         * Handle an API request
         * @param {ApiRequest} request - The API request
         * @returns {string} JSON-encoded ApiResponse
         */
        static handleRequest(request) {
            var context = ApiClientManager.createRequestContext(request && request.action, undefined);

            try {
                // PURE: Validate request format
                var validation = ApiClientManager.validateRequest(request);
                if (!validation.valid) {
                    return ApiClient._respond(ApiClientManager.errorResponse(validation.error, 'INVALID_REQUEST'), context);
                }

                var action = request.action;
                var params = request.params || {};
                var token = request.token;

                // Check if action exists
                var handlerConfig = _handlers[action];
                if (!handlerConfig) {
                    return ApiClient._respond(
                        ApiClientManager.errorResponse('Unknown action: ' + action, 'UNKNOWN_ACTION'),
                        context
                    );
                }

                // Check authentication if required
                if (handlerConfig.requiresAuth) {
                    if (!token) {
                        return ApiClient._respond(
                            ApiClientManager.errorResponse('Authentication required', 'AUTH_REQUIRED'),
                            context
                        );
                    }

                    // GAS: Validate token
                    var email = TokenManager.getEmailFromMUT(token);
                    if (!email) {
                        return ApiClient._respond(
                            ApiClientManager.errorResponse('Invalid or expired session', 'INVALID_TOKEN'),
                            context
                        );
                    }

                    // Add authenticated email to params
                    params._authenticatedEmail = email;
                }

                // Execute handler
                var result = handlerConfig.handler(params, token);

                return ApiClient._respond(result, context);
            } catch (error) {
                // Log error (don't expose internal details to client)
                Logger.log('[ApiClient.handleRequest] Error: ' + error);
                Logger.log('[ApiClient.handleRequest] Stack: ' + (error && error.stack));

                return ApiClient._respond(
                    ApiClientManager.errorResponse('An internal error occurred', 'INTERNAL_ERROR'),
                    context
                );
            }
        }

        /**
         * Format and return response
         * @private
         * @param {ApiResponse} response - The response
         * @param {{action: string, requestId: string, startTime: number}} context - Request context
         * @returns {string} JSON-encoded response
         */
        static _respond(response, context) {
            // Add metadata
            response.meta = ApiClientManager.createMetaFromContext(context);

            return JSON.stringify(response);
        }

        /**
         * List available actions (for documentation)
         * @returns {string} JSON-encoded action list
         */
        static listActions() {
            var actions = ApiClientManager.listActions(_handlers);
            return JSON.stringify(ApiClientManager.successResponse(actions));
        }

        /**
         * Get handler configuration (for testing)
         * @param {string} action - Action name
         * @returns {ActionHandler|undefined}
         */
        static getHandler(action) {
            return _handlers[action];
        }

        /**
         * Clear all handlers (for testing)
         */
        static clearHandlers() {
            _handlers = {};
        }
    }

    return ApiClient;
})();
// Node.js export for testing
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        ApiClient: ApiClient,
        ClientManager: ApiClientManager,
    };
}
