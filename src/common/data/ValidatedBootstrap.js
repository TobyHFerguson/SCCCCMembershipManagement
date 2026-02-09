/**
 * ValidatedBootstrap Class
 * 
 * Purpose: Provides type safety and validation for Bootstrap configuration data.
 * Ensures all bootstrap records have proper structure with required Reference and sheetName fields.
 * 
 * Layer: Layer 1 Infrastructure (can use AppLogger)
 * 
 * Usage:
 *   const entry = new ValidatedBootstrap('ActiveMembers', '', 'ActiveMembers', false);
 *   const entries = ValidatedBootstrap.validateRows(rows, headers, 'DataAccess.getBootstrapData');
 * 
 * Pattern: Flat IIFE-wrapped class (per gas-best-practices.md)
 */

/**
 * ValidatedBootstrap class using flat IIFE-wrapped pattern
 * @class
 */
var ValidatedBootstrap = (function() {
  /**
   * @param {string} reference - Logical name used in code (required, non-empty)
   * @param {string} id - Spreadsheet ID or URL (optional, empty string means local sheet)
   * @param {string} sheetName - Actual tab name within the spreadsheet (required, non-empty)
   * @param {boolean} createIfMissing - Whether to auto-create the sheet if not found
   */
  class ValidatedBootstrap {
    constructor(reference, id, sheetName, createIfMissing) {
      // Validate Reference (required)
      if (typeof reference !== 'string' || reference.trim() === '') {
        throw new Error(`ValidatedBootstrap Reference is required, got: ${typeof reference} "${reference}"`);
      }

      // Validate sheetName (required)
      if (typeof sheetName !== 'string' || sheetName.trim() === '') {
        throw new Error(`ValidatedBootstrap sheetName is required, got: ${typeof sheetName} "${sheetName}"`);
      }

      // Assign validated properties
      /** @type {string} */
      this.Reference = reference.trim();

      /** @type {string} */
      this.id = String(id || '').trim();

      /** @type {string} */
      this.sheetName = sheetName.trim();

      /** @type {boolean} */
      this.createIfMissing = Boolean(createIfMissing);
    }

    /**
     * Convert to array format for serialization/testing.
     * NOTE: For sheet persistence, use sheetHeaders.map(h => entry[h]).
     * @returns {Array<string|boolean>} Array with 4 elements matching HEADERS
     */
    toArray() {
      return [
        this.Reference,
        this.id,
        this.sheetName,
        this.createIfMissing
      ];
    }

    /**
     * Column headers constant
     * @returns {Array<string>} Array of column header names
     */
    static get HEADERS() {
      return ['Reference', 'id', 'sheetName', 'createIfMissing'];
    }

    /**
     * Static factory method - never throws, returns null on failure.
     * CRITICAL: Column-order independent. Uses header-based lookup.
     *
     * @param {Array<*>} rowArray - Row data as array
     * @param {Array<string>} headers - Column headers (can be in any order)
     * @param {number} rowNumber - Row number for error reporting (1-based)
     * @param {{errors: string[], rowNumbers: number[]}} [errorCollector] - Optional error collector
     * @returns {ValidatedBootstrap|null} Instance or null on failure
     */
    static fromRow(rowArray, headers, rowNumber, errorCollector) {
      try {
        // Map row array to object using headers (column-order independent)
        /** @type {Record<string, *>} */
        const rowObj = {};
        for (let i = 0; i < headers.length; i++) {
          rowObj[headers[i]] = rowArray[i];
        }

        const reference = rowObj['Reference'];
        const id = rowObj['id'];
        const sheetName = rowObj['sheetName'];
        // createIfMissing may come as boolean or string 'TRUE'/'true'
        const rawCreate = rowObj['createIfMissing'];
        const createIfMissing = rawCreate === true || String(rawCreate).toLowerCase() === 'true';

        return new ValidatedBootstrap(reference, id, sheetName, createIfMissing);

      } catch (validationError) {
        AppLogger.error('ValidatedBootstrap', `Row ${rowNumber}: ${validationError.message}`);

        if (errorCollector) {
          errorCollector.errors.push(`Row ${rowNumber}: ${validationError.message}`);
          errorCollector.rowNumbers.push(rowNumber);
        }

        return null;
      }
    }

    /**
     * Batch validation with consolidated error reporting.
     *
     * @param {Array<Array<*>>} rows - Row data (without headers)
     * @param {Array<string>} headers - Column headers
     * @param {string} context - Context string for error reporting
     * @returns {Array<ValidatedBootstrap>} Array of valid instances
     */
    static validateRows(rows, headers, context) {
      /** @type {Array<ValidatedBootstrap>} */
      const valid = [];
      /** @type {{errors: string[], rowNumbers: number[]}} */
      const errorCollector = { errors: [], rowNumbers: [] };

      for (let i = 0; i < rows.length; i++) {
        const rowNumber = i + 2; // +1 header, +1 for 1-based
        const entry = ValidatedBootstrap.fromRow(rows[i], headers, rowNumber, errorCollector);
        if (entry !== null) {
          valid.push(entry);
        }
      }

      if (errorCollector.errors.length > 0) {
        const errorList = errorCollector.errors.join('\n  ');
        try {
          MailApp.sendEmail({
            to: 'membership-automation@sc3.club',
            subject: `ALERT: ${errorCollector.errors.length} Bootstrap Validation Error${errorCollector.errors.length === 1 ? '' : 's'}`,
            body: `Bootstrap validation errors detected at ${new Date().toISOString()}

Context: ${context}
Total rows processed: ${rows.length}
Rows skipped due to errors: ${errorCollector.errors.length}

Errors:
  ${errorList}

Processing continued with valid rows only.
Review the Bootstrap sheet for data quality issues.`
          });
          AppLogger.warn('ValidatedBootstrap', `Sent validation error alert for ${errorCollector.errors.length} errors in ${context}`);
        } catch (emailError) {
          AppLogger.error('ValidatedBootstrap', `Failed to send validation error alert: ${emailError.message}`);
        }
      }

      return valid;
    }
  }

  return ValidatedBootstrap;
})();

// Node.js module export for testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ValidatedBootstrap };
}
