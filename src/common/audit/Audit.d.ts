/**
 * Audit logging type definitions
 */

declare namespace Audit {
    /**
     * Audit log entry type
     */
    interface LogEntry {
        /** Timestamp of the event in ISO format */
        Timestamp: Date;
        /** Type of business event (ActionType values or 'DeadLetter') */
        Type: string;
        /** Outcome of the operation */
        Outcome: 'success' | 'fail';
        /** Additional human-readable note */
        Note: string;
        /** Error message if applicable */
        Error: string;
        /** JSON-serialized detailed data (e.g., stack traces, error details) */
        JSON: string;
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
