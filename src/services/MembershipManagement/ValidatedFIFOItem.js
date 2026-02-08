/**
 * ValidatedFIFOItem Class
 * 
 * Purpose: Provides type safety and validation for FIFO queue items.
 * Ensures all FIFO records have proper structure and prevents corruption
 * by enforcing validation contracts at the class level.
 * 
 * Layer: Layer 1 Infrastructure (can use AppLogger)
 * 
 * Usage:
 *   const item = new ValidatedFIFOItem(id, email, subject, htmlBody, groups, attempts, ...);
 *   const items = ValidatedFIFOItem.validateRows(rows, headers, 'DataAccess.getExpirationFIFO');
 * 
 * Pattern: Flat IIFE-wrapped class (per gas-best-practices.md)
 */

/**
 * ValidatedFIFOItem class using flat IIFE-wrapped pattern
 * @class
 */
var ValidatedFIFOItem = (function() {
  /**
   * @param {string} id - Unique identifier (required)
   * @param {string} email - Member email (required, validated format)
   * @param {string} subject - Email subject (required, non-empty)
   * @param {string} htmlBody - Email HTML body (required, non-empty)
   * @param {string} groups - Comma-separated group emails (optional, may be empty)
   * @param {number} attempts - Number of attempts (required, >= 0)
   * @param {string} lastAttemptAt - Last attempt timestamp ISO string (optional, may be empty)
   * @param {string} lastError - Last error message (optional, may be empty)
   * @param {string} nextAttemptAt - Next attempt timestamp ISO string (optional, may be empty)
   * @param {number | null | undefined} maxAttempts - Max attempts override (optional)
   * @param {boolean} dead - Dead letter flag (optional, defaults to false)
   */
  class ValidatedFIFOItem {
    constructor(id, email, subject, htmlBody, groups, attempts, lastAttemptAt, lastError, nextAttemptAt, maxAttempts, dead) {
      // Validate id (required, must be non-empty string)
      if (typeof id !== 'string' || id.trim() === '') {
        throw new Error(`ValidatedFIFOItem id is required, got: ${typeof id} "${id}"`);
      }
      
      // Validate email (required, must be valid format)
      if (typeof email !== 'string' || email.trim() === '') {
        throw new Error(`ValidatedFIFOItem email is required, got: ${typeof email} "${email}"`);
      }
      
      const emailTrimmed = email.trim();
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(emailTrimmed)) {
        throw new Error(`ValidatedFIFOItem email must be valid format, got: "${emailTrimmed}"`);
      }
      
      // Validate subject (required, non-empty)
      if (typeof subject !== 'string' || subject.trim() === '') {
        throw new Error(`ValidatedFIFOItem subject is required, got: ${typeof subject} "${subject}"`);
      }
      
      // Validate htmlBody (required, non-empty)
      if (typeof htmlBody !== 'string' || htmlBody.trim() === '') {
        throw new Error(`ValidatedFIFOItem htmlBody is required, got: ${typeof htmlBody} "${htmlBody}"`);
      }
      
      // Validate attempts (required, must be number >= 0)
      if (attempts === null || attempts === undefined) {
        throw new Error(`ValidatedFIFOItem attempts must be number >= 0, got: ${attempts}`);
      }
      const attemptsNum = Number(attempts);
      if (isNaN(attemptsNum) || attemptsNum < 0) {
        throw new Error(`ValidatedFIFOItem attempts must be number >= 0, got: ${attempts}`);
      }
      
      // Assign validated properties
      /** @type {string} */
      this.id = id.trim();
      /** @type {string} */
      this.email = emailTrimmed;
      /** @type {string} */
      this.subject = subject.trim();
      /** @type {string} */
      this.htmlBody = htmlBody.trim();
      /** @type {string} */
      this.groups = String(groups || '').trim();
      /** @type {number} */
      this.attempts = attemptsNum;
      /** @type {string} */
      this.lastAttemptAt = String(lastAttemptAt || '').trim();
      /** @type {string} */
      this.lastError = String(lastError || '').trim();
      /** @type {string} */
      this.nextAttemptAt = String(nextAttemptAt || '').trim();
      /** @type {number|null} */
      this.maxAttempts = (maxAttempts === null || maxAttempts === undefined || maxAttempts === '') ? null : Number(maxAttempts);
      /** @type {boolean} */
      this.dead = Boolean(dead);
    }

    /**
     * Convert ValidatedFIFOItem to array format for serialization/testing
     * Column order matches HEADERS constant
     * NOTE: This is for serialization/testing ONLY - never for sheet persistence.
     * Sheet writes MUST use sheetHeaders.map(h => item[h]) to be column-order independent.
     * 
     * @returns {Array<string|number|boolean|null>} Array with 11 elements matching HEADERS
     */
    toArray() {
      return [
        this.id,
        this.email,
        this.subject,
        this.htmlBody,
        this.groups,
        this.attempts,
        this.lastAttemptAt,
        this.lastError,
        this.nextAttemptAt,
        this.maxAttempts,
        this.dead
      ];
    }

    /**
     * Column headers constant for consistency
     * @returns {Array<string>} Array of column header names
     */
    static get HEADERS() {
      return [
        'id',
        'email',
        'subject',
        'htmlBody',
        'groups',
        'attempts',
        'lastAttemptAt',
        'lastError',
        'nextAttemptAt',
        'maxAttempts',
        'dead'
      ];
    }

    /**
     * Static factory method - never throws, returns null on failure
     * Logs errors and adds to error collector if provided
     * 
     * CRITICAL: Uses header-based lookup for column-order independence.
     * Never assumes column positions - sheet columns can be reordered at any time.
     * 
     * @param {Array<*>} rowArray - Row data as array
     * @param {Array<string>} headers - Column headers
     * @param {number} rowNumber - Row number for error reporting (1-based, includes header)
     * @param {{errors: string[], rowNumbers: number[]}} [errorCollector] - Optional object to collect errors
     * @returns {ValidatedFIFOItem|null} ValidatedFIFOItem instance or null on failure
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
        const id = rowObj['id'];
        const email = rowObj['email'];
        const subject = rowObj['subject'];
        const htmlBody = rowObj['htmlBody'];
        const groups = rowObj['groups'];
        const attempts = rowObj['attempts'];
        const lastAttemptAt = rowObj['lastAttemptAt'];
        const lastError = rowObj['lastError'];
        const nextAttemptAt = rowObj['nextAttemptAt'];
        const maxAttempts = rowObj['maxAttempts'];
        const dead = rowObj['dead'];
        
        // Construct ValidatedFIFOItem (throws on validation failure)
        return new ValidatedFIFOItem(
          id, email, subject, htmlBody, groups,
          attempts, lastAttemptAt, lastError, nextAttemptAt,
          maxAttempts, dead
        );
        
      } catch (validationError) {
        // Log error
        AppLogger.error('ValidatedFIFOItem', `Row ${rowNumber}: ${validationError.message}`);
        
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
     * @returns {Array<ValidatedFIFOItem>} Array of valid ValidatedFIFOItem instances
     */
    static validateRows(rows, headers, context) {
      /** @type {Array<ValidatedFIFOItem>} */
      const validItems = [];
      /** @type {{errors: string[], rowNumbers: number[]}} */
      const errorCollector = { errors: [], rowNumbers: [] };
      
      // Process all rows
      for (let i = 0; i < rows.length; i++) {
        const rowNumber = i + 2; // +2 because row 1 is headers
        const item = ValidatedFIFOItem.fromRow(rows[i], headers, rowNumber, errorCollector);
        if (item !== null) {
          validItems.push(item);
        }
      }
      
      // If errors occurred, send consolidated email alert
      if (errorCollector.errors.length > 0) {
        const errorSummary = `${errorCollector.errors.length} validation error(s) in ${context}:\n` +
          errorCollector.errors.join('\n');
        
        AppLogger.error('ValidatedFIFOItem', errorSummary);
        
        // Send email alert
        try {
          const recipient = Properties.getProperty('VALIDATION_ERROR_EMAIL') || 'membership_automation@sc3.club';
          MailApp.sendEmail({
            to: recipient,
            subject: `Data Validation Errors: ${context}`,
            body: errorSummary
          });
        } catch (emailError) {
          AppLogger.error('ValidatedFIFOItem', `Failed to send validation error email: ${emailError.message}`);
        }
      }
      
      return validItems;
    }
  }

  // Export class constructor and static methods
  return ValidatedFIFOItem;
})();

// Export for testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ValidatedFIFOItem };
}
