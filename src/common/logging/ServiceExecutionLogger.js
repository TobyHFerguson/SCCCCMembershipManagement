/// <reference path="../../types/global.d.ts" />
// @ts-check

/**
 * ServiceExecutionLogger - Wrapper for logging service executions
 * 
 * Purpose: Provides logging wrapper functions for service API calls
 * Automatically logs service access and persists audit entries
 * 
 * Architecture:
 * - Wraps service API functions with logging
 * - Handles audit entry persistence automatically
 * - Logs both success and failure paths
 * 
 * Usage:
 *   // In Api.getData:
 *   return ServiceExecutionLogger.wrapGetData(
 *     'GroupManagementService',
 *     email,
 *     () => { actual getData logic  }
 *   );
 * 
 * Layer: Layer 1 Infrastructure (can use AppLogger)
 * Pattern: Flat object literal (per gas-best-practices.md)
 */

/**
 * ServiceExecutionLogger object for wrapping service API calls
 */
var ServiceExecutionLogger = {
    /**
     * Wrap a getData function with logging
     * Logs service access and persists audit entry automatically
     * 
     * @param {string} serviceName - Service name
     * @param {string} email - User email
     * @param {Function} getDataFn - Function that returns service data
     * @returns {Object} Service data with logging metadata
     */
    wrapGetData: function(serviceName, email, getDataFn) {
        const logger = new ServiceLogger(serviceName, email);
        const auditEntries = [];
        
        // Log service access
        AppLogger.info(serviceName, `getData() called for user: ${email}`);
        
        try {
            // Execute the actual getData function
            const result = getDataFn();
            
            // Log successful access
            const accessEntry = logger.logServiceAccess('getData');
            auditEntries.push(accessEntry);
            
            // Persist audit entries
            this._persistAuditEntries(auditEntries);
            
            AppLogger.info(serviceName, `getData() completed successfully for user: ${email}`);
            
            return result;
        } catch (error) {
            // Log error
            const errorEntry = logger.logError('getData', error);
            auditEntries.push(errorEntry);
            
            // Persist audit entries even on error
            this._persistAuditEntries(auditEntries);
            
            AppLogger.error(serviceName, `getData() failed for user: ${email}`, error);
            
            // Return error response (don't throw)
            return {
                serviceName: serviceName,
                error: error instanceof Error ? error.message : String(error)
            };
        }
    },

    /**
     * Wrap an API handler function with logging
     * Logs operation start, success/failure, and persists audit entries
     * 
     * @param {string} serviceName - Service name
     * @param {string} operationName - Operation name (e.g., 'updateProfile')
     * @param {string} email - User email
     * @param {Function} handlerFn - Handler function that performs the operation
     * @param {Record<string, any>} [params] - Optional parameters for logging context (JUSTIFIED: arbitrary debugging data)
     * @returns {Record<string, any>} Handler result with logging metadata
     */
    wrapApiHandler: function(serviceName, operationName, email, handlerFn, params) {
        const logger = new ServiceLogger(serviceName, email);
        const auditEntries = [];
        
        // Log operation start
        AppLogger.info(serviceName, `${operationName} started for user: ${email}`, params);
        
        try {
            // Execute the actual handler function
            const result = handlerFn();
            
            // Check if result indicates success or failure
            const isSuccess = !result.error && (!result.success || result.success === true);
            
            if (isSuccess) {
                // Log successful operation
                const operationEntry = logger.logOperation(
                    operationName,
                    'success',
                    `User ${email} successfully completed ${operationName}`,
                    undefined,
                    params
                );
                auditEntries.push(operationEntry);
                
                AppLogger.info(serviceName, `${operationName} completed successfully for user: ${email}`);
            } else {
                // Log failed operation
                const errorMsg = result.error || 'Operation failed';
                const operationEntry = logger.logOperation(
                    operationName,
                    'fail',
                    `User ${email} failed ${operationName}`,
                    errorMsg,
                    params
                );
                auditEntries.push(operationEntry);
                
                AppLogger.warn(serviceName, `${operationName} failed for user: ${email}: ${errorMsg}`);
            }
            
            // Persist audit entries
            this._persistAuditEntries(auditEntries);
            
            return result;
        } catch (error) {
            // Log error
            const errorEntry = logger.logError(operationName, error, params);
            auditEntries.push(errorEntry);
            
            // Persist audit entries even on error
            this._persistAuditEntries(auditEntries);
            
            AppLogger.error(serviceName, `${operationName} threw exception for user: ${email}`, error);
            
            // Return error response (don't throw)
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error)
            };
        }
    },

    /**
     * Persist audit entries to the Audit sheet
     * Internal helper that safely handles persistence errors
     * 
     * @param {AuditLogEntry[]} auditEntries - Audit entries to persist
     * @private
     */
    _persistAuditEntries: function(auditEntries) {
        if (!auditEntries || auditEntries.length === 0) {
            return;
        }
        
        try {
            // Persist entries directly (AuditPersistence handles fiddler internally)
            const numWritten = AuditPersistence.persistAuditEntries(auditEntries);
            
            AppLogger.debug('ServiceExecutionLogger', `Persisted ${numWritten} audit entries`);
        } catch (error) {
            // Log error but don't fail the operation
            AppLogger.error('ServiceExecutionLogger', 'Failed to persist audit entries', error);
        }
    }
};

// Backward compatibility alias - will be removed in future version
if (typeof Common === 'undefined') var Common = {};
if (typeof Common.Logging === 'undefined') Common.Logging = {};
Common.Logging.ServiceExecutionLogger = ServiceExecutionLogger;

// Node.js export for testing
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ServiceExecutionLogger };
}
