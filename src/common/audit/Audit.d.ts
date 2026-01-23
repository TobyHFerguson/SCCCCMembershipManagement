/**
 * Audit logging type definitions
 */

declare namespace Audit {
    /**
     * Audit Log Entry class (IIFE-wrapped pattern)
     */
    class LogEntry {
        /** Timestamp of the event */
        Timestamp: Date;
        /** Type of business event (ActionType values or 'DeadLetter') */
        Type: string;
        /** Outcome of the operation */
        Outcome: string;
        /** Additional human-readable note */
        Note: string;
        /** Error message if applicable */
        Error: string;
        /** JSON-serialized detailed data (e.g., stack traces, error details) */
        JSON: string;
        /** Optional unique identifier for deduplication */
        Id?: string;

        /**
         * Constructor
         */
        constructor(
            type: string,
            outcome: string,
            note?: string,
            error?: string,
            jsonData?: string,
            timestamp?: Date
        );

        /**
         * Convert to array for spreadsheet persistence
         */
        toArray(): Array<Date | string>;

        /**
         * Static factory method - never throws
         */
        static create(
            type: string,
            outcome: string,
            note?: string,
            error?: string,
            jsonData?: string,
            timestamp?: Date
        ): LogEntry;

        /**
         * Validate array of entries
         */
        static validateArray(
            entries: Array<LogEntry | object>,
            context: string
        ): LogEntry[];
    }

    /**
     * Parameters for creating an audit log entry
     */
    interface LogParams {
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
    class Logger {
        /**
         * Constructor
         * @param today - Optional date to use for timestamps (defaults to current date)
         */
        constructor(today?: Date);

        /**
         * Creates an audit log entry using the safe Audit.LogEntry class
         * @param params - Audit log parameters
         * @returns Validated audit log entry ready for persistence
         */
        createLogEntry(params: LogParams): LogEntry;

        /**
         * Creates multiple audit log entries at once
         * @param paramsArray - Array of audit log parameters
         * @returns Array of validated audit log entries
         */
        createLogEntries(paramsArray: LogParams[]): LogEntry[];
    }

    /**
     * Persistence namespace for writing audit entries to the Audit sheet
     */
    namespace Persistence {
        /**
         * Persist audit entries to the Audit sheet via direct SpreadsheetApp
         * @param auditEntries - Array of audit log entries from Manager
         * @returns Number of rows written
         */
        function persistAuditEntries(auditEntries: LogEntry[]): number;
    }
}
