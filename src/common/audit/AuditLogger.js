/**
 * AuditLogger Class
 * 
 * Purpose: Pure JavaScript audit logger following generator pattern.
 * Creates audit log entries without side effects.
 * Uses AuditLogEntry class for type safety and validation.
 * 
 * Layer: Layer 1 Infrastructure
 * 
 * Usage:
 *   const logger = new AuditLogger();
 *   const entry = logger.createLogEntry({type: 'transaction', outcome: 'success'});
 * 
 * Pattern: IIFE-wrapped class (per gas-best-practices.md)
 */

// Load AuditLogEntry class for Node.js/Jest environment
if (typeof module !== 'undefined') {
    if (typeof AuditLogEntry === 'undefined') {
        var AuditLogEntry = require('./AuditLogEntry.js');
    }
}

/**
 * @typedef {Object} AuditLogParams
 * @property {string} type - Type of business event
 * @property {'success' | 'fail'} outcome - Outcome of the operation
 * @property {string} [note] - Optional additional note
 * @property {string} [error] - Optional error message
 * @property {any} [jsonData] - Optional detailed data to be JSON-serialized
 */

/**
 * AuditLogger class using IIFE-wrapped pattern
 * @class
 */
var AuditLogger = (function() {
  class AuditLogger {
    /**
     * @param {Date} [today] - Optional date to use for timestamps
     */
    constructor(today) {
      this._today = today || new Date();
    }

    /**
     * Creates an audit log entry using the safe AuditLogEntry class
     * @param {AuditLogParams} params - Audit log parameters
     * @returns {AuditLogEntry} Validated audit log entry ready for persistence
     */
    createLogEntry(params) {
      if (!params || typeof params !== 'object') {
        throw new Error('params must be an object');
      }
      if (!params.type) {
        throw new Error('type is required');
      }
      if (!params.outcome || (params.outcome !== 'success' && params.outcome !== 'fail')) {
        throw new Error('outcome must be "success" or "fail"');
      }

      // Use AuditLogEntry.create for safe construction
      return AuditLogEntry.create(
        params.type,
        params.outcome,
        params.note || '',
        params.error || '',
        params.jsonData ? JSON.stringify(params.jsonData, null, 2) : '',
        this._today  // Pass the logger's timestamp
      );
    }

    /**
     * Creates multiple audit log entries at once
     * @param {AuditLogParams[]} paramsArray - Array of audit log parameters
     * @returns {AuditLogEntry[]} Array of validated audit log entries
     */
    createLogEntries(paramsArray) {
      if (!Array.isArray(paramsArray)) {
        throw new Error('paramsArray must be an array');
      }
      return paramsArray.map(params => this.createLogEntry(params));
    }
  }

  return AuditLogger;
})();

// Node.js module export for testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AuditLogger;
}
