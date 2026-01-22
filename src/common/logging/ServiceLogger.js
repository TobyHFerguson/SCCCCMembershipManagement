/// <reference path="../audit/Audit.d.ts" />
// @ts-check

/**
 * ServiceLogger - Unified logging utility for service executions
 * 
 * Purpose: Provides consistent dual logging for all SPA service executions:
 * 1. Business Audit Logging (Audit sheet) - Who did what when
 * 2. Technical System Logging (System Logs sheet) - Execution flow, errors, debugging
 * 
 * Architecture:
 * - Pure function pattern - returns audit entries for persistence
 * - Calls AppLogger for system logs (side effect)
 * - Follows existing AuditLogger generator pattern
 * 
 * Usage:
 *   const logger = new ServiceLogger('GroupManagementService', 'user@example.com');
 *   logger.logServiceAccess('getData'); // Logs both audit + system
 *   const auditEntry = logger.createAuditEntry('ProfileUpdate', 'success', 'Updated phone number');
 *   // Later: AuditPersistence.persistAuditEntries(fiddler, [auditEntry]);
 * 
 * Layer: Layer 1 Infrastructure (can use AppLogger)
 * Pattern: Flat IIFE-wrapped class (per gas-best-practices.md)
 */

/**
 * ServiceLogger class for unified service execution logging
 */
var ServiceLogger = (function() {
    class ServiceLogger {
    /**
     * @param {string} serviceName - Service name (e.g., 'GroupManagementService')
     * @param {string} userEmail - User email for audit trail
     * @param {Date} [timestamp] - Optional timestamp (for testing)
     */
    constructor(serviceName, userEmail, timestamp) {
        this.serviceName = serviceName;
        this.userEmail = userEmail;
        this.timestamp = timestamp || new Date();
        this.auditLogger = new AuditLogger(this.timestamp);
    }

    /**
     * Log service access (getData call)
     * Creates audit entry + system log for service access
     * 
     * @param {string} operation - Operation name (e.g., 'getData', 'getProfile')
     * @returns {AuditLogEntry} Audit entry for persistence
     */
    logServiceAccess(operation) {
        // System log: INFO level for normal access
        AppLogger.info(
            this.serviceName,
            `User ${this.userEmail} accessed service via ${operation}()`
        );

        // Audit entry: business record of access
        return this.auditLogger.createLogEntry({
            type: `${this.serviceName}.Access`,
            outcome: 'success',
            note: `User ${this.userEmail} accessed ${this.serviceName} via ${operation}()`
        });
    }

    /**
     * Log service operation (update, delete, etc.)
     * Creates audit entry + system log for service operations
     * 
     * @param {string} operationType - Type of operation (e.g., 'ProfileUpdate', 'SubscriptionChange')
     * @param {'success' | 'fail'} outcome - Operation outcome
     * @param {string} note - Human-readable description of what happened
     * @param {string} [error] - Error message if outcome is 'fail'
     * @param {any} [jsonData] - Additional structured data for debugging (JUSTIFIED: arbitrary debugging data)
     * @returns {AuditLogEntry} Audit entry for persistence
     */
    logOperation(operationType, outcome, note, error, jsonData) {
        // System log: INFO for success, ERROR for failure
        if (outcome === 'success') {
            AppLogger.info(
                this.serviceName,
                `${operationType}: ${note}`,
                jsonData
            );
        } else {
            AppLogger.error(
                this.serviceName,
                `${operationType} FAILED: ${error || note}`,
                jsonData || { error: error }
            );
        }

        // Audit entry: business record of operation
        return this.auditLogger.createLogEntry({
            type: `${this.serviceName}.${operationType}`,
            outcome: outcome,
            note: note,
            error: error || '',
            jsonData: jsonData
        });
    }

    /**
     * Log service error (unexpected failures during execution)
     * Creates audit entry + system log for errors
     * 
     * @param {string} operation - Operation that failed
     * @param {Error | string} error - Error object or message
     * @param {any} [additionalData] - Additional debugging data (JUSTIFIED: arbitrary debugging data)
     * @returns {AuditLogEntry} Audit entry for persistence
     */
    logError(operation, error, additionalData) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        const errorData = error instanceof Error ? {
            name: error.name,
            message: error.message,
            stack: error.stack
        } : { error: String(error) };

        // Merge additional data if provided
        const fullData = additionalData ? { ...errorData, ...additionalData } : errorData;

        // System log: ERROR level
        AppLogger.error(
            this.serviceName,
            `Error in ${operation}: ${errorMessage}`,
            fullData
        );

        // Audit entry: business record of error
        return this.auditLogger.createLogEntry({
            type: `${this.serviceName}.Error`,
            outcome: 'fail',
            note: `Error in ${operation} for user ${this.userEmail}`,
            error: errorMessage,
            jsonData: fullData
        });
    }

    /**
     * Create a custom audit entry without system logging
     * Useful when you want manual control over system logs
     * 
     * @param {string} type - Event type
     * @param {'success' | 'fail'} outcome - Operation outcome
     * @param {string} note - Human-readable note
     * @param {string} [error] - Error message
     * @param {any} [jsonData] - Additional data (JUSTIFIED: arbitrary debugging data)
     * @returns {AuditLogEntry} Audit entry for persistence
     */
    createAuditEntry(type, outcome, note, error, jsonData) {
        return this.auditLogger.createLogEntry({
            type: type,
            outcome: outcome,
            note: note,
            error: error || '',
            jsonData: jsonData
        });
    }
}

    return ServiceLogger;
})();

// Backward compatibility alias - will be removed in future version
if (typeof Common === 'undefined') var Common = {};
if (typeof Common.Logging === 'undefined') Common.Logging = {};
Common.Logging.ServiceLogger = ServiceLogger;

// Node.js export for testing
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ServiceLogger };
}
