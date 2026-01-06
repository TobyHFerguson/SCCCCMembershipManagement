/// <reference path="./Audit.d.ts" />

// Load AuditLogEntry class for Node.js/Jest environment
if (typeof module !== 'undefined') {
    require('./AuditLogEntry.js');
}

// Audit namespace declared in src/1namespaces.js
// For Node.js/Jest: globalThis ensures we don't redeclare
if (typeof globalThis.Audit === 'undefined') {
    globalThis.Audit = {};
}

/**
 * Pure JavaScript audit logger
 * Follows generator pattern - creates audit log entries without side effects
 * Now uses Audit.LogEntry class for type safety and validation
 */
Audit.Logger = class {
    constructor(today) {
        this._today = today || new Date();
    }

    /**
     * Creates an audit log entry using the safe Audit.LogEntry class
     * @param {Audit.LogParams} params - Audit log parameters
     * @returns {Audit.LogEntry} Validated audit log entry ready for persistence
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

        // Use Audit.LogEntry.create for safe construction
        return Audit.LogEntry.create(
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
     * @param {Audit.LogParams[]} paramsArray - Array of audit log parameters
     * @returns {Audit.LogEntry[]} Array of validated audit log entries
     */
    createLogEntries(paramsArray) {
        if (!Array.isArray(paramsArray)) {
            throw new Error('paramsArray must be an array');
        }
        return paramsArray.map(params => this.createLogEntry(params));
    }
}

// Export for Node.js/Jest
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { Audit: globalThis.Audit };
}
