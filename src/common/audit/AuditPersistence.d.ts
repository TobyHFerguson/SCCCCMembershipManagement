/**
 * AuditPersistence type definitions
 * 
 * IIFE-wrapped class pattern following RideManager-style (no namespace nesting)
 */

/**
 * AuditPersistence class with static methods
 */
declare class AuditPersistence {
    /**
     * Persist audit entries to the Audit sheet via direct SpreadsheetApp
     * @param auditEntries - Array of audit log entries from Manager
     * @returns Number of rows written
     */
    static persistAuditEntries(auditEntries: AuditLogEntry[]): number;
}

export = AuditPersistence;
