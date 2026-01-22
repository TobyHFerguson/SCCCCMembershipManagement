/**
 * ValidatedMember Class
 * 
 * Purpose: Provides type safety and validation for member data.
 * Ensures all member records have proper structure and prevents corruption
 * by enforcing validation contracts at the class level.
 * 
 * Layer: Layer 1 Infrastructure (can use Common.Logger)
 * 
 * Usage:
 *   const member = new Common.Data.ValidatedMember(email, status, first, last, phone, joined, expires, ...);
 *   const members = Common.Data.ValidatedMember.validateRows(rows, headers, 'data_access.getMembers');
 * 
 * Pattern: IIFE-wrapped class (per gas-best-practices.md)
 */

// Extend Common.Data namespace (declared in 1namespaces.js in GAS)
// Use globalThis for Node.js compatibility while maintaining GAS compatibility
if (typeof Common === 'undefined') {
  if (typeof globalThis !== 'undefined') {
    globalThis.Common = globalThis.Common || {};
    var Common = globalThis.Common;
  } else {
    var Common = {};
  }
}
if (typeof Common.Data === 'undefined') Common.Data = {};

/**
 * ValidatedMember class using IIFE-wrapped pattern
 * @class
 */
Common.Data.ValidatedMember = (function() {
  /**
   * @param {string} email - Member email (required, normalized to lowercase)
   * @param {string} status - Member status (required)
   * @param {string} first - First name (required)
   * @param {string} last - Last name (required)
   * @param {string} phone - Phone number (optional, may be empty)
   * @param {Date} joined - Join date (required, must be valid Date)
   * @param {Date} expires - Expiration date (required, must be >= joined)
   * @param {number} period - Membership period (optional)
   * @param {boolean} dirName - Directory share name (optional, coerced to boolean)
   * @param {boolean} dirEmail - Directory share email (optional, coerced to boolean)
   * @param {boolean} dirPhone - Directory share phone (optional, coerced to boolean)
   * @param {Date} renewedOn - Renewed date (optional, may be null/empty)
   */
  class ValidatedMember {
    constructor(email, status, first, last, phone, joined, expires, period, dirName, dirEmail, dirPhone, renewedOn) {
      // Validate email (required, must be valid format)
      if (typeof email !== 'string' || email.trim() === '') {
        throw new Error(`ValidatedMember email is required, got: ${typeof email} "${email}"`);
      }
      
      const emailTrimmed = email.trim();
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(emailTrimmed)) {
        throw new Error(`ValidatedMember email must be valid format, got: "${emailTrimmed}"`);
      }
      
      // Validate status (required)
      if (typeof status !== 'string' || status.trim() === '') {
        throw new Error(`ValidatedMember status is required, got: ${typeof status} "${status}"`);
      }
      
      // Validate first name (required)
      if (typeof first !== 'string' || first.trim() === '') {
        throw new Error(`ValidatedMember first name is required, got: ${typeof first} "${first}"`);
      }
      
      // Validate last name (required)
      if (typeof last !== 'string' || last.trim() === '') {
        throw new Error(`ValidatedMember last name is required, got: ${typeof last} "${last}"`);
      }
      
      // Validate joined date (required, must be valid Date)
      if (!(joined instanceof Date) || isNaN(joined.getTime())) {
        throw new Error(`ValidatedMember joined date must be valid Date, got: ${joined}`);
      }
      
      // Validate expires date (required, must be valid Date)
      if (!(expires instanceof Date) || isNaN(expires.getTime())) {
        throw new Error(`ValidatedMember expires date must be valid Date, got: ${expires}`);
      }
      
      // Validate expires >= joined
      if (expires < joined) {
        throw new Error(`ValidatedMember expires date must be >= joined date (expires: ${expires.toISOString()}, joined: ${joined.toISOString()})`);
      }
      
      // Validate renewedOn if present (optional, but must be valid Date if provided)
      if (renewedOn !== null && renewedOn !== undefined && renewedOn !== '') {
        if (!(renewedOn instanceof Date) || isNaN(renewedOn.getTime())) {
          throw new Error(`ValidatedMember renewed date must be valid Date if provided, got: ${renewedOn}`);
        }
      }
      
      // Assign validated properties
      /** @type {string} */
      this.Email = emailTrimmed.toLowerCase(); // Normalize to lowercase
      /** @type {string} */
      this.Status = status.trim();
      /** @type {string} */
      this.First = first.trim();
      /** @type {string} */
      this.Last = last.trim();
      /** @type {string} */
      this.Phone = String(phone || '').trim();
      /** @type {Date} */
      this.Joined = joined;
      /** @type {Date} */
      this.Expires = expires;
      /** @type {number|null} */
      this.Period = (period === null || period === undefined || period === '') ? null : Number(period);
      
      // Coerce directory share fields to boolean
      /** @type {boolean} */
      this['Directory Share Name'] = Boolean(dirName);
      /** @type {boolean} */
      this['Directory Share Email'] = Boolean(dirEmail);
      /** @type {boolean} */
      this['Directory Share Phone'] = Boolean(dirPhone);
      
      // Handle optional renewed date
      /** @type {Date|null} */
      if (renewedOn === null || renewedOn === undefined || renewedOn === '') {
        this['Renewed On'] = null;
      } else {
        this['Renewed On'] = renewedOn;
      }
    }

    /**
     * Convert ValidatedMember to array format for spreadsheet persistence
     * Column order matches HEADERS constant
     * 
     * @returns {Array<string|Date|number|boolean|null>} Array with 12 elements matching sheet columns
     */
    toArray() {
      return [
        this.Status,
        this.Email,
        this.First,
        this.Last,
        this.Phone,
        this.Joined,
        this.Expires,
        this.Period,
        this['Directory Share Name'],
        this['Directory Share Email'],
        this['Directory Share Phone'],
        this['Renewed On']
      ];
    }

    /**
     * Column headers constant for consistency
     * @returns {Array<string>} Array of column header names
     */
    static get HEADERS() {
      return [
        'Status',
        'Email',
        'First',
        'Last',
        'Phone',
        'Joined',
        'Expires',
        'Period',
        'Directory Share Name',
        'Directory Share Email',
        'Directory Share Phone',
        'Renewed On'
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
     * @returns {ValidatedMember|null} ValidatedMember instance or null on failure
     */
    static fromRow(rowArray, headers, rowNumber, errorCollector) {
      try {
        // Map row array to object using headers
        /** @type {Record<string, *>} */
        const rowObj = {};
        for (let i = 0; i < headers.length; i++) {
          rowObj[headers[i]] = rowArray[i];
        }
        
        // Extract fields
        const email = rowObj['Email'];
        const status = rowObj['Status'];
        const first = rowObj['First'];
        const last = rowObj['Last'];
        const phone = rowObj['Phone'];
        const joined = rowObj['Joined'];
        const expires = rowObj['Expires'];
        const period = rowObj['Period'];
        const dirName = rowObj['Directory Share Name'];
        const dirEmail = rowObj['Directory Share Email'];
        const dirPhone = rowObj['Directory Share Phone'];
        const renewedOn = rowObj['Renewed On'];
        
        // Construct ValidatedMember (throws on validation failure)
        return new ValidatedMember(
          email, status, first, last, phone, 
          joined, expires, period,
          dirName, dirEmail, dirPhone, renewedOn
        );
        
      } catch (validationError) {
        // Log error
        AppLogger.error('ValidatedMember', `Row ${rowNumber}: ${validationError.message}`);
        
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
     * @returns {Array<ValidatedMember>} Array of valid ValidatedMember instances
     */
    static validateRows(rows, headers, context) {
      /** @type {Array<ValidatedMember>} */
      const validMembers = [];
      /** @type {{errors: string[], rowNumbers: number[]}} */
      const errorCollector = { errors: [], rowNumbers: [] };
      
      for (let i = 0; i < rows.length; i++) {
        const rowNumber = i + 2; // +2 because: +1 for header row, +1 for 1-based indexing
        const member = ValidatedMember.fromRow(rows[i], headers, rowNumber, errorCollector);
        
        if (member !== null) {
          validMembers.push(member);
        }
      }
      
      // Send consolidated email if any errors
      if (errorCollector.errors.length > 0) {
        const timestamp = new Date().toISOString();
        const errorList = errorCollector.errors.join('\n  ');
        
        try {
          MailApp.sendEmail({
            to: 'membership-automation@sc3.club',
            subject: `ALERT: ${errorCollector.errors.length} Member Validation Error${errorCollector.errors.length === 1 ? '' : 's'}`,
            body: `Member validation errors detected at ${timestamp}

Context: ${context}
Total rows processed: ${rows.length}
Rows skipped due to errors: ${errorCollector.errors.length}

Errors:
  ${errorList}

Processing continued with valid rows only.
Review the ActiveMembers sheet for data quality issues.`
          });
          
          AppLogger.warn('ValidatedMember', `Sent validation error alert email for ${errorCollector.errors.length} errors in ${context}`);
          
        } catch (emailError) {
          AppLogger.error('ValidatedMember', `Failed to send validation error alert: ${emailError.message}`);
        }
      }
      
      return validMembers;
    }
  }

  return ValidatedMember;
})();

// Node.js module export for testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Common;
}
