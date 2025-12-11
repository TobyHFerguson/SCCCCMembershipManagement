/// <reference path="../audit/Audit.d.ts" />
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
 *   return Common.Logging.ServiceExecutionLogger.wrapGetData(
 *     'GroupManagementService',
 *     email,
 *     () => { /* actual getData logic */ }
 *   );
 * 
 * Layer: Layer 1 Infrastructure (can use Common.Logger)
 */

// Namespace declaration pattern
if (typeof Common === 'undefined') Common = {};
if (typeof Common.Logging === 'undefined') Common.Logging = {};

Common.Logging.ServiceExecutionLogger = {
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
        const logger = new Common.Logging.ServiceLogger(serviceName, email);
        const auditEntries = [];
        
        // Log service access
        Common.Logger.info(serviceName, `getData() called for user: ${email}`);
        
        try {
            // Execute the actual getData function
            const result = getDataFn();
            
            // Log successful access
            const accessEntry = logger.logServiceAccess('getData');
            auditEntries.push(accessEntry);
            
            // Persist audit entries
            this._persistAuditEntries(auditEntries);
            
            Common.Logger.info(serviceName, `getData() completed successfully for user: ${email}`);
            
            return result;
        } catch (error) {
            // Log error
            const errorEntry = logger.logError('getData', error);
            auditEntries.push(errorEntry);
            
            // Persist audit entries even on error
            this._persistAuditEntries(auditEntries);
            
            Common.Logger.error(serviceName, `getData() failed for user: ${email}`, error);
            
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
     * @param {Object} [params] - Optional parameters for logging context
     * @returns {Object} Handler result with logging metadata
     */
    wrapApiHandler: function(serviceName, operationName, email, handlerFn, params) {
        const logger = new Common.Logging.ServiceLogger(serviceName, email);
        const auditEntries = [];
        
        // Log operation start
        Common.Logger.info(serviceName, `${operationName} started for user: ${email}`, params);
        
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
                
                Common.Logger.info(serviceName, `${operationName} completed successfully for user: ${email}`);
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
                
                Common.Logger.warn(serviceName, `${operationName} failed for user: ${email}: ${errorMsg}`);
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
            
            Common.Logger.error(serviceName, `${operationName} threw exception for user: ${email}`, error);
            
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
     * @param {Audit.LogEntry[]} auditEntries - Audit entries to persist
     * @private
     */
    _persistAuditEntries: function(auditEntries) {
        if (!auditEntries || auditEntries.length === 0) {
            return;
        }
        
        try {
            // Get Audit fiddler
            const auditFiddler = Common.Data.Storage.SpreadsheetManager.getFiddler('Audit');
            
            // Persist entries
            const numWritten = Audit.Persistence.persistAuditEntries(auditFiddler, auditEntries);
            
            Common.Logger.debug('ServiceExecutionLogger', `Persisted ${numWritten} audit entries`);
        } catch (error) {
            // Log error but don't fail the operation
            Common.Logger.error('ServiceExecutionLogger', 'Failed to persist audit entries', error);
        }
    }
};

// Node.js export for testing
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { Common };
}
