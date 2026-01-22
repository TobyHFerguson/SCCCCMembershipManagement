/**
 * AuditLogger type definitions
 * 
 * Flat class pattern following RideManager-style (no namespace nesting)
 */

/**
 * Parameters for creating an audit log entry
 */
interface AuditLogParams {
    /** Type of business event */
    type: string;
    /** Outcome of the operation */
    outcome: 'success' | 'fail';
    /** Optional additional note */
    note?: string;
    /** Optional error message */
    error?: string;
    /** Optional detailed data to be JSON-serialized */
    jsonData?: any;
}

/**
 * Pure JavaScript audit logger
 * Follows generator pattern - creates audit log entries without side effects
 */
declare class AuditLogger {
    /**
     * Constructor
     * @param today - Optional date to use for timestamps (defaults to current date)
     */
    constructor(today?: Date);

    /**
     * Creates an audit log entry using the safe AuditLogEntry class
     * @param params - Audit log parameters
     * @returns Validated audit log entry ready for persistence
     */
    createLogEntry(params: AuditLogParams): AuditLogEntry;

    /**
     * Creates multiple audit log entries at once
     * @param paramsArray - Array of audit log parameters
     * @returns Array of validated audit log entries
     */
    createLogEntries(paramsArray: AuditLogParams[]): AuditLogEntry[];
}

export = AuditLogger;
