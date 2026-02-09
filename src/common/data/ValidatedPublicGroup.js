/**
 * ValidatedPublicGroup Class
 * 
 * Purpose: Provides type safety and validation for PublicGroups sheet data.
 * Ensures all group records have required Name, Email, and Subscription fields.
 * 
 * Layer: Layer 1 Infrastructure (can use AppLogger)
 * 
 * Usage:
 *   const group = new ValidatedPublicGroup('Ride Leaders', 'ride-leaders@sc3.club', 'auto');
 *   const groups = ValidatedPublicGroup.validateRows(rows, headers, 'DataAccess.getPublicGroups');
 * 
 * Pattern: Flat IIFE-wrapped class (per gas-best-practices.md)
 */

/**
 * ValidatedPublicGroup class using flat IIFE-wrapped pattern
 * @class
 */
var ValidatedPublicGroup = (function() {
  /**
   * @param {string} name - Human-readable group name (required, non-empty)
   * @param {string} email - Group email address (required, non-empty)
   * @param {string} subscription - Subscription type (required, e.g. 'auto', 'manual')
   */
  class ValidatedPublicGroup {
    constructor(name, email, subscription) {
      // Validate Name (required)
      if (typeof name !== 'string' || name.trim() === '') {
        throw new Error(`ValidatedPublicGroup Name is required, got: ${typeof name} "${name}"`);
      }

      // Validate Email (required)
      if (typeof email !== 'string' || email.trim() === '') {
        throw new Error(`ValidatedPublicGroup Email is required, got: ${typeof email} "${email}"`);
      }

      // Validate Subscription (required)
      if (typeof subscription !== 'string' || subscription.trim() === '') {
        throw new Error(`ValidatedPublicGroup Subscription is required, got: ${typeof subscription} "${subscription}"`);
      }

      /** @type {string} */
      this.Name = name.trim();

      /** @type {string} */
      this.Email = email.trim();

      /** @type {string} */
      this.Subscription = subscription.trim();
    }

    /**
     * Convert to array format for serialization/testing.
     * NOTE: For sheet persistence, use sheetHeaders.map(h => group[h]).
     * @returns {Array<string>} Array with 3 elements matching HEADERS
     */
    toArray() {
      return [this.Name, this.Email, this.Subscription];
    }

    /**
     * Column headers constant
     * @returns {Array<string>} Array of column header names
     */
    static get HEADERS() {
      return ['Name', 'Email', 'Subscription'];
    }

    /**
     * Static factory method - never throws, returns null on failure.
     * CRITICAL: Column-order independent. Uses header-based lookup.
     *
     * @param {Array<*>} rowArray - Row data as array
     * @param {Array<string>} headers - Column headers (can be in any order)
     * @param {number} rowNumber - Row number for error reporting (1-based)
     * @param {{errors: string[], rowNumbers: number[]}} [errorCollector] - Optional error collector
     * @returns {ValidatedPublicGroup|null} Instance or null on failure
     */
    static fromRow(rowArray, headers, rowNumber, errorCollector) {
      try {
        /** @type {Record<string, *>} */
        const rowObj = {};
        for (let i = 0; i < headers.length; i++) {
          rowObj[headers[i]] = rowArray[i];
        }

        return new ValidatedPublicGroup(
          rowObj['Name'],
          rowObj['Email'],
          rowObj['Subscription']
        );

      } catch (validationError) {
        AppLogger.error('ValidatedPublicGroup', `Row ${rowNumber}: ${validationError.message}`);

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
     * @returns {Array<ValidatedPublicGroup>} Array of valid instances
     */
    static validateRows(rows, headers, context) {
      /** @type {Array<ValidatedPublicGroup>} */
      const valid = [];
      /** @type {{errors: string[], rowNumbers: number[]}} */
      const errorCollector = { errors: [], rowNumbers: [] };

      for (let i = 0; i < rows.length; i++) {
        const rowNumber = i + 2;
        const group = ValidatedPublicGroup.fromRow(rows[i], headers, rowNumber, errorCollector);
        if (group !== null) {
          valid.push(group);
        }
      }

      if (errorCollector.errors.length > 0) {
        const errorList = errorCollector.errors.join('\n  ');
        try {
          MailApp.sendEmail({
            to: 'membership-automation@sc3.club',
            subject: `ALERT: ${errorCollector.errors.length} PublicGroup Validation Error${errorCollector.errors.length === 1 ? '' : 's'}`,
            body: `PublicGroup validation errors detected at ${new Date().toISOString()}

Context: ${context}
Total rows processed: ${rows.length}
Rows skipped due to errors: ${errorCollector.errors.length}

Errors:
  ${errorList}

Processing continued with valid rows only.
Review the PublicGroups sheet for data quality issues.`
          });
          AppLogger.warn('ValidatedPublicGroup', `Sent validation error alert for ${errorCollector.errors.length} errors in ${context}`);
        } catch (emailError) {
          AppLogger.error('ValidatedPublicGroup', `Failed to send validation error alert: ${emailError.message}`);
        }
      }

      return valid;
    }
  }

  return ValidatedPublicGroup;
})();

// Node.js module export for testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ValidatedPublicGroup };
}
