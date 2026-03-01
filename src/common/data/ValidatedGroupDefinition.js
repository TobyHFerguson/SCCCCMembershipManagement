/**
 * ValidatedGroupDefinition Class
 * 
 * Purpose: Provides type safety and validation for GroupDefinitions sheet data.
 * Ensures all group definition records have required Name, Email, Subscription,
 * Type, and Members fields. Optional fields (Aliases, Managers, Note) default
 * to empty string if absent.
 * 
 * Layer: Layer 1 Infrastructure (can use AppLogger)
 * 
 * Usage:
 *   const gd = new ValidatedGroupDefinition('Board', 'board@sc3.club', '', 'auto', 'Discussion', 'Everyone', '', '');
 *   const defs = ValidatedGroupDefinition.validateRows(rows, headers, 'DataAccess.getGroupDefinitions');
 * 
 * Pattern: Flat IIFE-wrapped class (per gas-best-practices.md)
 */

/**
 * ValidatedGroupDefinition class using flat IIFE-wrapped pattern
 * @class
 */
var ValidatedGroupDefinition = (function() {
  /**
   * @param {string} name - Human-readable group name; reference key for nested group lookups (required, non-empty)
   * @param {string} email - Group email address; bare name without '@' gets '@sc3.club' appended (required, non-empty)
   * @param {string} aliases - Comma-separated email aliases; bare names get '@sc3.club' appended (optional)
   * @param {string} subscription - Subscription type: 'auto', 'manual', or 'invitation' (required, non-empty)
   * @param {string} type - Group type: 'Announcement', 'Discussion', 'Role', or 'Security' (required, non-empty)
   * @param {string} members - Comma-separated members: group Names, 'Everyone', 'Anyone', or email addresses (required, must be a string)
   * @param {string} managers - Comma-separated managers: group Names or email addresses (optional)
   * @param {string} note - Free-text notes (optional)
   */
  class ValidatedGroupDefinition {
    constructor(name, email, aliases, subscription, type, members, managers, note) {
      // Validate Name (required)
      if (typeof name !== 'string' || name.trim() === '') {
        throw new Error(`ValidatedGroupDefinition Name is required, got: ${typeof name} "${name}"`);
      }

      // Validate Email (required)
      if (typeof email !== 'string' || email.trim() === '') {
        throw new Error(`ValidatedGroupDefinition Email is required, got: ${typeof email} "${email}"`);
      }

      // Validate Subscription (required)
      if (typeof subscription !== 'string' || subscription.trim() === '') {
        throw new Error(`ValidatedGroupDefinition Subscription is required, got: ${typeof subscription} "${subscription}"`);
      }

      // Validate Type (required)
      if (typeof type !== 'string' || type.trim() === '') {
        throw new Error(`ValidatedGroupDefinition Type is required, got: ${typeof type} "${type}"`);
      }

      // Validate Members (required - must be a string, can be empty for Security groups)
      if (typeof members !== 'string') {
        throw new Error(`ValidatedGroupDefinition Members must be a string, got: ${typeof members} "${members}"`);
      }

      /** @type {string} */
      this.Name = name.trim();

      // Normalize Email: if no '@', append '@sc3.club'
      const trimmedEmail = email.trim();
      /** @type {string} */
      this.Email = trimmedEmail.includes('@') ? trimmedEmail : trimmedEmail + '@sc3.club';

      /** @type {string} */
      this.Aliases = aliases ? String(aliases).trim() : '';

      /** @type {string} */
      this.Subscription = subscription.trim();

      /** @type {string} */
      this.Type = type.trim();

      /** @type {string} */
      this.Members = members.trim();

      /** @type {string} */
      this.Managers = managers ? String(managers).trim() : '';

      /** @type {string} */
      this.Note = note ? String(note).trim() : '';
    }

    /**
     * Convert to array format for serialization/testing.
     * NOTE: For sheet persistence, use sheetHeaders.map(h => gd[h]).
     * @returns {Array<string>} Array with 8 elements matching HEADERS
     */
    toArray() {
      return [this.Name, this.Email, this.Aliases, this.Subscription, this.Type, this.Members, this.Managers, this.Note];
    }

    /**
     * Column headers constant
     * @returns {Array<string>} Array of column header names
     */
    static get HEADERS() {
      return ['Name', 'Email', 'Aliases', 'Subscription', 'Type', 'Members', 'Managers', 'Note'];
    }

    /**
     * Static factory method - never throws, returns null on failure.
     * CRITICAL: Column-order independent. Uses header-based lookup.
     *
     * @param {Array<*>} rowArray - Row data as array
     * @param {Array<string>} headers - Column headers (can be in any order)
     * @param {number} rowNumber - Row number for error reporting (1-based)
     * @param {{errors: string[], rowNumbers: number[]}} [errorCollector] - Optional error collector
     * @returns {ValidatedGroupDefinition|null} Instance or null on failure
     */
    static fromRow(rowArray, headers, rowNumber, errorCollector) {
      try {
        /** @type {Record<string, *>} */
        const rowObj = {};
        for (let i = 0; i < headers.length; i++) {
          rowObj[headers[i]] = rowArray[i];
        }

        return new ValidatedGroupDefinition(
          rowObj['Name'],
          rowObj['Email'],
          rowObj['Aliases'],
          rowObj['Subscription'],
          rowObj['Type'],
          rowObj['Members'],
          rowObj['Managers'],
          rowObj['Note']
        );

      } catch (validationError) {
        AppLogger.error('ValidatedGroupDefinition', `Row ${rowNumber}: ${validationError.message}`);

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
     * @returns {Array<ValidatedGroupDefinition>} Array of valid instances
     */
    static validateRows(rows, headers, context) {
      /** @type {Array<ValidatedGroupDefinition>} */
      const valid = [];
      /** @type {{errors: string[], rowNumbers: number[]}} */
      const errorCollector = { errors: [], rowNumbers: [] };

      for (let i = 0; i < rows.length; i++) {
        const rowNumber = i + 2;
        const gd = ValidatedGroupDefinition.fromRow(rows[i], headers, rowNumber, errorCollector);
        if (gd !== null) {
          valid.push(gd);
        }
      }

      if (errorCollector.errors.length > 0) {
        const errorList = errorCollector.errors.join('\n  ');
        try {
          MailApp.sendEmail({
            to: 'membership-automation@sc3.club',
            subject: `ALERT: ${errorCollector.errors.length} GroupDefinition Validation Error${errorCollector.errors.length === 1 ? '' : 's'}`,
            body: `GroupDefinition validation errors detected at ${new Date().toISOString()}

Context: ${context}
Total rows processed: ${rows.length}
Rows skipped due to errors: ${errorCollector.errors.length}

Errors:
  ${errorList}

Processing continued with valid rows only.
Review the GroupDefinitions sheet for data quality issues.`
          });
          AppLogger.warn('ValidatedGroupDefinition', `Sent validation error alert for ${errorCollector.errors.length} errors in ${context}`);
        } catch (emailError) {
          AppLogger.error('ValidatedGroupDefinition', `Failed to send validation error alert: ${emailError.message}`);
        }
      }

      return valid;
    }
  }

  return ValidatedGroupDefinition;
})();

// Node.js module export for testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ValidatedGroupDefinition };
}
