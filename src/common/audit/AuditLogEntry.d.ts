/**
 * AuditLogEntry type definitions
 * 
 * Flat class pattern following RideManager-style (no namespace nesting)
 */

/**
 * Audit Log Entry class (IIFE-wrapped pattern)
 */
declare class AuditLogEntry {
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
    ): AuditLogEntry;

    /**
     * Validate array of entries
     */
    static validateArray(
        entries: Array<AuditLogEntry | object>,
        context: string
    ): AuditLogEntry[];
}

export = AuditLogEntry;
