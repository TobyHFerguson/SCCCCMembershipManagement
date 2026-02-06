/**
 * ValidatedTransaction Class
 * 
 * Purpose: Provides type safety and validation for transaction data.
 * Ensures all transaction records have proper structure and prevents corruption
 * by enforcing validation contracts at the class level.
 * 
 * Layer: Layer 1 Infrastructure (can use AppLogger)
 * 
 * Usage:
 *   const txn = new ValidatedTransaction(email, firstName, lastName, phone, payment, ...);
 *   const transactions = ValidatedTransaction.validateRows(rows, headers, 'MembershipManagement.processTransactions');
 * 
 * Pattern: Flat IIFE-wrapped class (per gas-best-practices.md)
 */

/**
 * ValidatedTransaction class using flat IIFE-wrapped pattern
 * @class
 */
var ValidatedTransaction = (function() {
  /**
   * @param {string} emailAddress - Member email (required)
   * @param {string} firstName - First name (required)
   * @param {string} lastName - Last name (required)
   * @param {string} phone - Phone number (optional, may be empty)
   * @param {string} payment - Payment type (optional, e.g., "1 year", "2 years")
   * @param {string} directory - Directory sharing preferences (optional, e.g., "Share Name, Share Email, Share Phone")
   * @param {string} payableStatus - Payment status (optional, e.g., "Paid", "Pending")
   * @param {Date | string | null} processed - Date when transaction was processed (optional)
   * @param {Date | string | null} timestamp - Transaction timestamp (optional)
   */
  class ValidatedTransaction {
    constructor(emailAddress, firstName, lastName, phone, payment, directory, payableStatus, processed, timestamp) {
      // Validate email address (required)
      if (typeof emailAddress !== 'string' || emailAddress.trim() === '') {
        throw new Error(`ValidatedTransaction email address is required, got: ${typeof emailAddress} "${emailAddress}"`);
      }
      
      // Validate first name (required)
      if (typeof firstName !== 'string' || firstName.trim() === '') {
        throw new Error(`ValidatedTransaction first name is required, got: ${typeof firstName} "${firstName}"`);
      }
      
      // Validate last name (required)
      if (typeof lastName !== 'string' || lastName.trim() === '') {
        throw new Error(`ValidatedTransaction last name is required, got: ${typeof lastName} "${lastName}"`);
      }
      
      // Validate processed date if present (optional, but must be valid Date if provided)
      if (processed !== null && processed !== undefined && processed !== '') {
        if (!(processed instanceof Date) || isNaN(processed.getTime())) {
          throw new Error(`ValidatedTransaction processed date must be valid Date if provided, got: ${processed}`);
        }
      }
      
      // Validate timestamp date if present (optional, but must be valid Date if provided)
      if (timestamp !== null && timestamp !== undefined && timestamp !== '') {
        if (!(timestamp instanceof Date) || isNaN(timestamp.getTime())) {
          throw new Error(`ValidatedTransaction timestamp must be valid Date if provided, got: ${timestamp}`);
        }
      }
      
      // Assign validated properties
      /** @type {string} */
      this['Email Address'] = emailAddress.trim();
      /** @type {string} */
      this['First Name'] = firstName.trim();
      /** @type {string} */
      this['Last Name'] = lastName.trim();
      /** @type {string} */
      this.Phone = String(phone || '').trim();
      /** @type {string} */
      this.Payment = String(payment || '').trim();
      /** @type {string} */
      this.Directory = String(directory || '').trim();
      /** @type {string} */
      this['Payable Status'] = String(payableStatus || '').trim();
      
      // Handle optional processed date
      /** @type {Date|null} */
      if (processed === null || processed === undefined || processed === '') {
        this.Processed = null;
      } else {
        this.Processed = processed;
      }
      
      // Handle optional timestamp
      /** @type {Date|null} */
      if (timestamp === null || timestamp === undefined || timestamp === '') {
        this.Timestamp = null;
      } else {
        this.Timestamp = timestamp;
      }
    }

    /**
     * Convert ValidatedTransaction to array format for spreadsheet persistence
     * Column order matches HEADERS constant
     * 
     * @returns {Array<string|Date|null>} Array with 9 elements matching sheet columns
     */
    toArray() {
      return [
        this['Email Address'],
        this['First Name'],
        this['Last Name'],
        this.Phone,
        this.Payment,
        this.Directory,
        this['Payable Status'],
        this.Processed,
        this.Timestamp
      ];
    }

    /**
     * Column headers constant for consistency
     * @returns {Array<string>} Array of column header names
     */
    static get HEADERS() {
      return [
        'Email Address',
        'First Name',
        'Last Name',
        'Phone',
        'Payment',
        'Directory',
        'Payable Status',
        'Processed',
        'Timestamp'
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
     * @returns {ValidatedTransaction|null} ValidatedTransaction instance or null on failure
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
        const emailAddress = rowObj['Email Address'];
        const firstName = rowObj['First Name'];
        const lastName = rowObj['Last Name'];
        const phone = rowObj['Phone'];
        const payment = rowObj['Payment'];
        const directory = rowObj['Directory'];
        const payableStatus = rowObj['Payable Status'];
        const processed = rowObj['Processed'];
        const timestamp = rowObj['Timestamp'];
        
        // Construct ValidatedTransaction (throws on validation failure)
        return new ValidatedTransaction(
          emailAddress, firstName, lastName, phone, payment,
          directory, payableStatus, processed, timestamp
        );
        
      } catch (validationError) {
        // Log error
        AppLogger.error('ValidatedTransaction', `Row ${rowNumber}: ${validationError.message}`);
        
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
     * @returns {Array<ValidatedTransaction>} Array of valid ValidatedTransaction instances
     */
    static validateRows(rows, headers, context) {
      /** @type {Array<ValidatedTransaction>} */
      const validTransactions = [];
      /** @type {{errors: string[], rowNumbers: number[]}} */
      const errorCollector = { errors: [], rowNumbers: [] };
      
      for (let i = 0; i < rows.length; i++) {
        const rowNumber = i + 2; // +2 because: +1 for header row, +1 for 1-based indexing
        const transaction = ValidatedTransaction.fromRow(rows[i], headers, rowNumber, errorCollector);
        
        if (transaction !== null) {
          validTransactions.push(transaction);
        }
      }
      
      // Send consolidated email if any errors
      if (errorCollector.errors.length > 0) {
        const timestamp = new Date().toISOString();
        const errorList = errorCollector.errors.join('\n  ');
        
        try {
          MailApp.sendEmail({
            to: 'membership-automation@sc3.club',
            subject: `ALERT: ${errorCollector.errors.length} Transaction Validation Error${errorCollector.errors.length === 1 ? '' : 's'}`,
            body: `Transaction validation errors detected at ${timestamp}

Context: ${context}
Total rows processed: ${rows.length}
Rows skipped due to errors: ${errorCollector.errors.length}

Errors:
  ${errorList}

Processing continued with valid rows only.
Review the Transactions sheet for data quality issues.`
          });
          
          AppLogger.warn('ValidatedTransaction', `Sent validation error alert email for ${errorCollector.errors.length} errors in ${context}`);
          
        } catch (emailError) {
          AppLogger.error('ValidatedTransaction', `Failed to send validation error alert: ${emailError.message}`);
        }
      }
      
      return validTransactions;
    }
  }

  return ValidatedTransaction;
})();

// Node.js module export for testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ValidatedTransaction };
}
