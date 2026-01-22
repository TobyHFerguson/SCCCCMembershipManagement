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
}
