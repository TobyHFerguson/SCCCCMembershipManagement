/**
 * ValidatedElectionConfig Class
 * 
 * Purpose: Provides type safety and validation for ElectionConfiguration sheet data.
 * This is a key-value configuration sheet with Key/Setting and Value columns.
 * 
 * Layer: Layer 1 Infrastructure (can use AppLogger)
 * 
 * Usage:
 *   const entry = new ValidatedElectionConfig('BALLOT_FOLDER_URL', '', 'https://...');
 *   const entries = ValidatedElectionConfig.validateRows(rows, headers, 'DataAccess.getElectionConfiguration');
 * 
 * Pattern: Flat IIFE-wrapped class (per gas-best-practices.md)
 */

/**
 * ValidatedElectionConfig class using flat IIFE-wrapped pattern
 * @class
 */
var ValidatedElectionConfig = (function() {
  /**
   * @param {string} key - Primary lookup key (optional, but at least one of Key/Setting required)
   * @param {string} setting - Alternate lookup key (optional, but at least one of Key/Setting required)
   * @param {string} value - The configuration value (required, non-empty)
   */
  class ValidatedElectionConfig {
    constructor(key, setting, value) {
      const keyStr = String(key || '').trim();
      const settingStr = String(setting || '').trim();

      // At least one of Key or Setting must be non-empty
      if (keyStr === '' && settingStr === '') {
        throw new Error(`ValidatedElectionConfig requires at least one of Key or Setting, both are empty`);
      }

      // Validate Value (required)
      if (typeof value !== 'string' || value.trim() === '') {
        throw new Error(`ValidatedElectionConfig Value is required, got: ${typeof value} "${value}"`);
      }

      /** @type {string} */
      this.Key = keyStr;

      /** @type {string} */
      this.Setting = settingStr;

      /** @type {string} */
      this.Value = value.trim();
    }

    /**
     * Convert to array format for serialization/testing.
     * NOTE: For sheet persistence, use sheetHeaders.map(h => entry[h]).
     * @returns {Array<string>} Array with 3 elements matching HEADERS
     */
    toArray() {
      return [this.Key, this.Setting, this.Value];
    }

    /**
     * Column headers constant
     * @returns {Array<string>} Array of column header names
     */
    static get HEADERS() {
      return ['Key', 'Setting', 'Value'];
    }

    /**
     * Static factory method - never throws, returns null on failure.
     * CRITICAL: Column-order independent. Uses header-based lookup.
     *
     * @param {Array<*>} rowArray - Row data as array
     * @param {Array<string>} headers - Column headers (can be in any order)
     * @param {number} rowNumber - Row number for error reporting (1-based)
     * @param {{errors: string[], rowNumbers: number[]}} [errorCollector] - Optional error collector
     * @returns {ValidatedElectionConfig|null} Instance or null on failure
     */
    static fromRow(rowArray, headers, rowNumber, errorCollector) {
      try {
        /** @type {Record<string, *>} */
        const rowObj = {};
        for (let i = 0; i < headers.length; i++) {
          rowObj[headers[i]] = rowArray[i];
        }

        return new ValidatedElectionConfig(
          rowObj['Key'],
          rowObj['Setting'],
          rowObj['Value']
        );

      } catch (validationError) {
        AppLogger.error('ValidatedElectionConfig', `Row ${rowNumber}: ${validationError.message}`);

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
     * @returns {Array<ValidatedElectionConfig>} Array of valid instances
     */
    static validateRows(rows, headers, context) {
      /** @type {Array<ValidatedElectionConfig>} */
      const valid = [];
      /** @type {{errors: string[], rowNumbers: number[]}} */
      const errorCollector = { errors: [], rowNumbers: [] };

      for (let i = 0; i < rows.length; i++) {
        const rowNumber = i + 2;
        const entry = ValidatedElectionConfig.fromRow(rows[i], headers, rowNumber, errorCollector);
        if (entry !== null) {
          valid.push(entry);
        }
      }

      if (errorCollector.errors.length > 0) {
        const errorList = errorCollector.errors.join('\n  ');
        try {
          MailApp.sendEmail({
            to: 'membership-automation@sc3.club',
            subject: `ALERT: ${errorCollector.errors.length} ElectionConfig Validation Error${errorCollector.errors.length === 1 ? '' : 's'}`,
            body: `ElectionConfig validation errors detected at ${new Date().toISOString()}

Context: ${context}
Total rows processed: ${rows.length}
Rows skipped due to errors: ${errorCollector.errors.length}

Errors:
  ${errorList}

Processing continued with valid rows only.
Review the ElectionConfiguration sheet for data quality issues.`
          });
          AppLogger.warn('ValidatedElectionConfig', `Sent validation error alert for ${errorCollector.errors.length} errors in ${context}`);
        } catch (emailError) {
          AppLogger.error('ValidatedElectionConfig', `Failed to send validation error alert: ${emailError.message}`);
        }
      }

      return valid;
    }
  }

  return ValidatedElectionConfig;
})();

// Node.js module export for testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ValidatedElectionConfig };
}
