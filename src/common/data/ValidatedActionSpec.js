/**
 * ValidatedActionSpec Class
 * 
 * Purpose: Provides type safety and validation for action specification data.
 * Ensures all ActionSpec records have proper structure and prevents corruption
 * by enforcing validation contracts at the class level.
 * 
 * Layer: Layer 1 Infrastructure (can use AppLogger)
 * 
 * Usage:
 *   const spec = new ValidatedActionSpec(type, subject, body, offset);
 *   const specs = ValidatedActionSpec.validateRows(rows, headers, 'DataAccess.getActionSpecs');
 * 
 * Pattern: Flat IIFE-wrapped class (per gas-best-practices.md)
 */

/**
 * ValidatedActionSpec class using flat IIFE-wrapped pattern
 * @class
 */
var ValidatedActionSpec = (function() {
  /**
   * Known action types (from MembershipManagement.ActionType)
   */
  const VALID_ACTION_TYPES = ['Migrate', 'Join', 'Renew', 'Expiry1', 'Expiry2', 'Expiry3', 'Expiry4'];
  
  /**
   * @param {string} type - Action type (required, must be one of known ActionTypes)
   * @param {string} subject - Email subject line (required)
   * @param {string | {text: string, url: string}} body - Email body (required, may be string or RichText object)
   * @param {number | null | undefined | string} offset - Days offset for expiry actions (optional)
   */
  class ValidatedActionSpec {
    constructor(type, subject, body, offset) {
      // Validate Type (required, must be valid ActionType)
      if (typeof type !== 'string' || type.trim() === '') {
        throw new Error(`ValidatedActionSpec Type is required, got: ${typeof type} "${type}"`);
      }
      
      const typeTrimmed = type.trim();
      if (!VALID_ACTION_TYPES.includes(typeTrimmed)) {
        throw new Error(`ValidatedActionSpec Type must be one of [${VALID_ACTION_TYPES.join(', ')}], got: "${typeTrimmed}"`);
      }
      
      // Validate Subject (required)
      if (typeof subject !== 'string' || subject.trim() === '') {
        throw new Error(`ValidatedActionSpec Subject is required, got: ${typeof subject} "${subject}"`);
      }
      
      // Validate Body (required, may be string or RichText object)
      // Body can be:
      // 1. A string (plain text or HTML)
      // 2. A RichText object with {text, url} structure (from getDataWithRichText)
      if (body === null || body === undefined || body === '') {
        throw new Error(`ValidatedActionSpec Body is required, got: ${body}`);
      }
      
      // Accept both string and object (RichText) formats
      if (typeof body !== 'string' && typeof body !== 'object') {
        throw new Error(`ValidatedActionSpec Body must be string or RichText object, got: ${typeof body}`);
      }
      
      // If Body is an object, verify it has expected RichText structure
      if (typeof body === 'object' && body !== null) {
        if (!('text' in body)) {
          throw new Error(`ValidatedActionSpec Body object must have 'text' property`);
        }
      }
      
      // Assign validated properties
      /** @type {string} */
      this.Type = typeTrimmed;
      
      /** @type {string} */
      this.Subject = subject.trim();
      
      /** @type {string | {text: string, url: string}} */
      this.Body = body;
      
      /** @type {number | null} */
      // Handle optional Offset (days offset for expiry actions)
      if (offset === null || offset === undefined || offset === '') {
        this.Offset = null;
      } else {
        const offsetNum = Number(offset);
        if (isNaN(offsetNum)) {
          throw new Error(`ValidatedActionSpec Offset must be a valid number if provided, got: ${offset}`);
        }
        this.Offset = offsetNum;
      }
    }

    /**
     * Convert ValidatedActionSpec to array format for spreadsheet persistence
     * Column order matches HEADERS constant
     * 
     * @returns {Array<string | number | null | {text: string, url: string}>} Array with 4 elements matching sheet columns
     */
    toArray() {
      return [
        this.Type,
        this.Offset,
        this.Subject,
        this.Body
      ];
    }

    /**
     * Column headers constant for consistency
     * @returns {Array<string>} Array of column header names
     */
    static get HEADERS() {
      return [
        'Type',
        'Offset',
        'Subject',
        'Body'
      ];
    }

    /**
     * Static factory method - never throws, returns null on failure
     * Logs errors and adds to error collector if provided
     * 
     * @param {Array<*>} rowArray - Row data as array
     * @param {Array<string>} headers - Column headers
     * @param {number} rowNumber - Row number for error reporting (1-based, includes header)
     * @param {{errors: string[], rowNumbers: number[]}} [errorCollector] - Optional object to collect errors
     * @returns {ValidatedActionSpec | null} ValidatedActionSpec instance or null on failure
     */
    static fromRow(rowArray, headers, rowNumber, errorCollector) {
      try {
        // Map row array to object using headers (column-order independent)
        /** @type {Record<string, *>} */
        const rowObj = {};
        for (let i = 0; i < headers.length; i++) {
          rowObj[headers[i]] = rowArray[i];
        }
        
        // Extract fields by name (not by position)
        const type = rowObj['Type'];
        const subject = rowObj['Subject'];
        const body = rowObj['Body'];
        const offset = rowObj['Offset'];
        
        // Construct ValidatedActionSpec (throws on validation failure)
        return new ValidatedActionSpec(
          type, subject, body, offset
        );
        
      } catch (validationError) {
        // Log error
        AppLogger.error('ValidatedActionSpec', `Row ${rowNumber}: ${validationError.message}`);
        
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
     * @returns {Array<ValidatedActionSpec>} Array of valid ValidatedActionSpec instances
     */
    static validateRows(rows, headers, context) {
      /** @type {Array<ValidatedActionSpec>} */
      const validSpecs = [];
      /** @type {{errors: string[], rowNumbers: number[]}} */
      const errorCollector = { errors: [], rowNumbers: [] };
      
      for (let i = 0; i < rows.length; i++) {
        const rowNumber = i + 2; // +2 because: +1 for header row, +1 for 1-based indexing
        const spec = ValidatedActionSpec.fromRow(rows[i], headers, rowNumber, errorCollector);
        
        if (spec !== null) {
          validSpecs.push(spec);
        }
      }
      
      // Send consolidated email if any errors
      if (errorCollector.errors.length > 0) {
        const timestamp = new Date().toISOString();
        const errorList = errorCollector.errors.join('\n  ');
        
        try {
          MailApp.sendEmail({
            to: 'membership-automation@sc3.club',
            subject: `ALERT: ${errorCollector.errors.length} ActionSpec Validation Error${errorCollector.errors.length === 1 ? '' : 's'}`,
            body: `ActionSpec validation errors detected at ${timestamp}

Context: ${context}
Total rows processed: ${rows.length}
Rows skipped due to errors: ${errorCollector.errors.length}

Errors:
  ${errorList}

Processing continued with valid rows only.
Review the ActionSpecs sheet for data quality issues.`
          });
          
          AppLogger.warn('ValidatedActionSpec', `Sent validation error alert email for ${errorCollector.errors.length} errors in ${context}`);
          
        } catch (emailError) {
          AppLogger.error('ValidatedActionSpec', `Failed to send validation error alert: ${emailError.message}`);
        }
      }
      
      return validSpecs;
    }
  }

  return ValidatedActionSpec;
})();

// Node.js module export for testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ValidatedActionSpec };
}
