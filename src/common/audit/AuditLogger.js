/// <reference path="./Audit.d.ts" />

if (typeof require !== 'undefined') {
    // For Node.js/Jest compatibility
    var Audit = {};
}

/**
 * Pure JavaScript audit logger
 * Follows generator pattern - creates audit log entries without side effects
 */
Audit.Logger = class {
    constructor(today) {
        this._today = today || new Date();
    }

    /**
     * Creates an audit log entry
     * @param {Audit.LogParams} params - Audit log parameters
     * @returns {Audit.LogEntry} Audit log entry ready for persistence
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

        const entry = {
            Timestamp: new Date(this._today),
            Type: params.type,
            Outcome: params.outcome,
            Note: params.note || '',
            Error: params.error || '',
            JSON: params.jsonData ? JSON.stringify(params.jsonData, null, 2) : ''
        };

        return entry;
    }

    /**
     * Creates multiple audit log entries at once
     * @param {Audit.LogParams[]} paramsArray - Array of audit log parameters
     * @returns {Audit.LogEntry[]} Array of audit log entries
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
    module.exports = { Audit };
}
