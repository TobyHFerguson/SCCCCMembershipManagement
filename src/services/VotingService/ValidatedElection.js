/**
 * ValidatedElection Class
 * 
 * Purpose: Provides type safety and validation for election data.
 * Ensures all election records have proper structure and prevents corruption
 * by enforcing validation contracts at the class level.
 * 
 * Layer: Layer 1 Infrastructure (can use AppLogger)
 * 
 * Usage:
 *   const election = new ValidatedElection(title, start, end, formEditUrl, electionOfficers, triggerId);
 *   const elections = ValidatedElection.validateRows(rows, headers, 'data_access.getElections');
 * 
 * Pattern: Flat IIFE-wrapped class (per gas-best-practices.md)
 */

/**
 * ValidatedElection class using flat IIFE-wrapped pattern
 * @class
 */
var ValidatedElection = (function() {
  /**
   * @param {string} title - Election title (required, non-empty)
   * @param {Date | string | null} start - Start date (optional, must be valid Date or parseable string if provided)
   * @param {Date | string | null} end - End date (optional, must be valid Date or parseable string if provided, must be >= start if both present)
   * @param {string} formEditUrl - Form edit URL (optional, may be empty)
   * @param {string} electionOfficers - Election officers comma-separated emails (optional, may be empty)
   * @param {string} triggerId - Trigger ID (optional, may be empty)
   */
  class ValidatedElection {
    constructor(title, start, end, formEditUrl, electionOfficers, triggerId) {
      // Validate title (required)
      if (typeof title !== 'string' || title.trim() === '') {
        throw new Error(`ValidatedElection title is required, got: ${typeof title} "${title}"`);
      }
      
      // Parse and validate start date if provided
      let startDate = null;
      if (start !== null && start !== undefined && start !== '') {
        if (start instanceof Date) {
          if (isNaN(start.getTime())) {
            throw new Error(`ValidatedElection start date must be valid Date, got invalid Date`);
          }
          startDate = start;
        } else if (typeof start === 'string') {
          const parsed = new Date(start);
          if (isNaN(parsed.getTime())) {
            throw new Error(`ValidatedElection start date must be parseable, got: "${start}"`);
          }
          startDate = parsed;
        } else {
          throw new Error(`ValidatedElection start date must be Date or string, got: ${typeof start}`);
        }
      }
      
      // Parse and validate end date if provided
      let endDate = null;
      if (end !== null && end !== undefined && end !== '') {
        if (end instanceof Date) {
          if (isNaN(end.getTime())) {
            throw new Error(`ValidatedElection end date must be valid Date, got invalid Date`);
          }
          endDate = end;
        } else if (typeof end === 'string') {
          const parsed = new Date(end);
          if (isNaN(parsed.getTime())) {
            throw new Error(`ValidatedElection end date must be parseable, got: "${end}"`);
          }
          endDate = parsed;
        } else {
          throw new Error(`ValidatedElection end date must be Date or string, got: ${typeof end}`);
        }
      }
      
      // Validate end >= start if both present
      if (startDate !== null && endDate !== null && endDate < startDate) {
        throw new Error(
          `ValidatedElection end date must be >= start date (end: ${endDate.toISOString()}, start: ${startDate.toISOString()})`
        );
      }
      
      // Assign validated properties
      /** @type {string} */
      this.Title = title.trim();
      
      /** @type {Date|null} */
      this.Start = startDate;
      
      /** @type {Date|null} */
      this.End = endDate;
      
      /** @type {string} */
      this['Form Edit URL'] = String(formEditUrl || '').trim();
      
      /** @type {string} */
      this['Election Officers'] = String(electionOfficers || '').trim();
      
      /** @type {string} */
      this.TriggerId = String(triggerId || '').trim();
    }

    /**
     * Convert ValidatedElection to array format for serialization/testing
     * Column order matches HEADERS constant
     * 
     * NOTE: This is for serialization/testing ONLY. For sheet persistence,
     * use sheetHeaders.map(h => election[h]) to ensure column-order independence.
     * 
     * @returns {Array<string|Date|null>} Array with 6 elements matching HEADERS
     */
    toArray() {
      return [
        this.Title,
        this.Start,
        this.End,
        this['Form Edit URL'],
        this['Election Officers'],
        this.TriggerId
      ];
    }

    /**
     * Column headers constant for consistency
     * @returns {Array<string>} Array of column header names
     */
    static get HEADERS() {
      return [
        'Title',
        'Start',
        'End',
        'Form Edit URL',
        'Election Officers',
        'TriggerId'
      ];
    }

    /**
     * Static factory method - never throws, returns null on failure
     * Logs errors and adds to error collector if provided
     * 
     * CRITICAL: Column-order independent. Uses header-based lookup, not positional indexing.
     * 
     * @param {Array<*>} rowArray - Row data as array
     * @param {Array<string>} headers - Column headers (can be in any order)
     * @param {number} rowNumber - Row number for error reporting (1-based, includes header)
     * @param {{errors: string[], rowNumbers: number[]}} [errorCollector] - Optional object to collect errors
     * @returns {ValidatedElection|null} ValidatedElection instance or null on failure
     */
    static fromRow(rowArray, headers, rowNumber, errorCollector) {
      try {
        // Map row array to object using headers (column-order independent)
        /** @type {Record<string, *>} */
        const rowObj = {};
        for (let i = 0; i < headers.length; i++) {
          rowObj[headers[i]] = rowArray[i];
        }
        
        // Extract fields by name (not position)
        const title = rowObj['Title'];
        const start = rowObj['Start'];
        const end = rowObj['End'];
        const formEditUrl = rowObj['Form Edit URL'];
        const electionOfficers = rowObj['Election Officers'];
        const triggerId = rowObj['TriggerId'];
        
        // Construct ValidatedElection (throws on validation failure)
        return new ValidatedElection(
          title,
          start,
          end,
          formEditUrl,
          electionOfficers,
          triggerId
        );
        
      } catch (validationError) {
        // Log error
        AppLogger.error('ValidatedElection', `Row ${rowNumber}: ${validationError.message}`);
        
        // Add to error collector if provided
        if (errorCollector) {
          errorCollector.errors.push(`Row ${rowNumber}: ${validationError.message}`);
          errorCollector.rowNumbers.push(rowNumber);
        }
        
        return null;
      }
    }

    /**
     * Batch validation with consolidated email alert
     * Processes all rows, collects errors, sends single email if any errors
     * 
     * @param {Array<Array<*>>} rows - Array of row data (without headers)
     * @param {Array<string>} headers - Column headers
     * @param {string} context - Context string for error reporting
     * @returns {Array<ValidatedElection>} Array of valid ValidatedElection instances
     */
    static validateRows(rows, headers, context) {
      /** @type {Array<ValidatedElection>} */
      const validElections = [];
      /** @type {{errors: string[], rowNumbers: number[]}} */
      const errorCollector = { errors: [], rowNumbers: [] };
      
      for (let i = 0; i < rows.length; i++) {
        const rowNumber = i + 2; // +2 because: +1 for header row, +1 for 1-based indexing
        const election = ValidatedElection.fromRow(rows[i], headers, rowNumber, errorCollector);
        
        if (election !== null) {
          validElections.push(election);
        }
      }
      
      // Send consolidated email if any errors
      if (errorCollector.errors.length > 0) {
        const timestamp = new Date().toISOString();
        const errorList = errorCollector.errors.join('\n  ');
        
        try {
          MailApp.sendEmail({
            to: 'membership-automation@sc3.club',
            subject: `ALERT: ${errorCollector.errors.length} Election Validation Error${errorCollector.errors.length === 1 ? '' : 's'}`,
            body: `Election validation errors detected at ${timestamp}

Context: ${context}
Total rows processed: ${rows.length}
Rows skipped due to errors: ${errorCollector.errors.length}

Errors:
  ${errorList}

Processing continued with valid rows only.
Review the Elections sheet for data quality issues.`
          });
          
          AppLogger.warn('ValidatedElection', `Sent validation error alert email for ${errorCollector.errors.length} errors in ${context}`);
          
        } catch (emailError) {
          AppLogger.error('ValidatedElection', `Failed to send validation error alert: ${emailError.message}`);
        }
      }
      
      return validElections;
    }
  }

  return ValidatedElection;
})();

// Node.js module export for testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ValidatedElection };
}
