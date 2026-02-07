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
   * @param {string} phone - Phone number (required, must be in format (NNN) NNN-NNNN)
   * @param {string} payment - Payment type (optional, e.g., "1 year", "2 years")
   * @param {string} directory - Directory sharing preferences (optional, e.g., "Share Name, Share Email, Share Phone")
   * @param {string} payableStatus - Payment status (optional, e.g., "Paid", "Pending")
   * @param {Date | string | null} processed - Date when transaction was processed (optional)
   * @param {Date | string | null} timestamp - Transaction timestamp (optional)
   * @param {{'Are you 18 years of age or older?'?: *, Privacy?: *, 'Membership Agreement'?: *, 'Payable Order ID'?: *, 'Payable Total'?: *, 'Payable Payment Method'?: *, 'Payable Transaction ID'?: *, 'Payable Last Updated'?: *}} [passthrough] - Additional sheet columns stored as-is for round-trip persistence
   */
  class ValidatedTransaction {
    constructor(emailAddress, firstName, lastName, phone, payment, directory, payableStatus, processed, timestamp, passthrough = {}) {
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
      
      // Validate phone (required, must be in format (NNN) NNN-NNNN)
      if (typeof phone !== 'string' || phone.trim() === '') {
        throw new Error(`ValidatedTransaction phone is required, got: ${typeof phone} "${phone}"`);
      }
      const phonePattern = /^\(\d{3}\) \d{3}-\d{4}$/;
      const trimmedPhone = phone.trim();
      if (!phonePattern.test(trimmedPhone)) {
        throw new Error(`ValidatedTransaction phone must be in format (NNN) NNN-NNNN, got: "${trimmedPhone}"`);
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
      this.Phone = trimmedPhone;
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

      // Passthrough fields — stored as-is for round-trip persistence to sheet
      this['Are you 18 years of age or older?'] = passthrough['Are you 18 years of age or older?'] ?? '';
      this.Privacy = passthrough.Privacy ?? '';
      this['Membership Agreement'] = passthrough['Membership Agreement'] ?? '';
      this['Payable Order ID'] = passthrough['Payable Order ID'] ?? '';
      this['Payable Total'] = passthrough['Payable Total'] ?? '';
      this['Payable Payment Method'] = passthrough['Payable Payment Method'] ?? '';
      this['Payable Transaction ID'] = passthrough['Payable Transaction ID'] ?? '';
      this['Payable Last Updated'] = passthrough['Payable Last Updated'] ?? '';

      // Write-back metadata — set by fromRow(), not by direct constructor calls
      /** @type {number|undefined} 1-based sheet row index for targeted write-back */
      this._sheetRowIndex = undefined;
      /** @type {Record<string, *>|undefined} Header-keyed snapshot of original cell values */
      this._originalValues = undefined;
    }

    /**
     * Convert ValidatedTransaction to array format for spreadsheet persistence
     * Column order matches HEADERS constant (all 17 sheet columns)
     * 
     * @returns {Array<string|Date|number|null>} Array with 17 elements matching sheet columns
     */
    toArray() {
      return [
        this.Timestamp,
        this['Email Address'],
        this['Are you 18 years of age or older?'],
        this.Privacy,
        this['Membership Agreement'],
        this.Directory,
        this['First Name'],
        this['Last Name'],
        this.Phone,
        this.Payment,
        this['Payable Order ID'],
        this['Payable Total'],
        this['Payable Status'],
        this['Payable Payment Method'],
        this['Payable Transaction ID'],
        this['Payable Last Updated'],
        this.Processed
      ];
    }

    /**
     * Column headers constant for consistency
     * @returns {Array<string>} Array of column header names
     */
    static get HEADERS() {
      return [
        'Timestamp',
        'Email Address',
        'Are you 18 years of age or older?',
        'Privacy',
        'Membership Agreement',
        'Directory',
        'First Name',
        'Last Name',
        'Phone',
        'Payment',
        'Payable Order ID',
        'Payable Total',
        'Payable Status',
        'Payable Payment Method',
        'Payable Transaction ID',
        'Payable Last Updated',
        'Processed'
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
        
        // Extract validated fields
        const emailAddress = rowObj['Email Address'];
        const firstName = rowObj['First Name'];
        const lastName = rowObj['Last Name'];
        const phone = rowObj['Phone'];
        const payment = rowObj['Payment'];
        const directory = rowObj['Directory'];
        const payableStatus = rowObj['Payable Status'];
        const processed = rowObj['Processed'];
        const timestamp = rowObj['Timestamp'];
        
        // Passthrough fields — stored as-is for round-trip persistence
        const passthrough = {
          'Are you 18 years of age or older?': rowObj['Are you 18 years of age or older?'],
          'Privacy': rowObj['Privacy'],
          'Membership Agreement': rowObj['Membership Agreement'],
          'Payable Order ID': rowObj['Payable Order ID'],
          'Payable Total': rowObj['Payable Total'],
          'Payable Payment Method': rowObj['Payable Payment Method'],
          'Payable Transaction ID': rowObj['Payable Transaction ID'],
          'Payable Last Updated': rowObj['Payable Last Updated']
        };
        
        // Construct ValidatedTransaction (throws on validation failure)
        const txn = new ValidatedTransaction(
          emailAddress, firstName, lastName, phone, payment,
          directory, payableStatus, processed, timestamp,
          passthrough
        );

        // Store original row metadata for selective write-back
        // _sheetRowIndex: 1-based sheet row (same as rowNumber param, which accounts for header row)
        // _originalValues: header-keyed snapshot of original cell values for change detection
        txn._sheetRowIndex = rowNumber;
        /** @type {Record<string, *>} */
        txn._originalValues = {};
        for (let i = 0; i < headers.length; i++) {
          txn._originalValues[headers[i]] = rowArray[i];
        }

        return txn;
        
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

    /**
     * Compare two values for equality, handling Date objects and null/undefined.
     * Used internally by writeChangedCells for change detection.
     *
     * @param {*} a - First value
     * @param {*} b - Second value
     * @returns {boolean} True if values are considered equal
     * @private
     */
    static _valuesEqual(a, b) {
      // null/undefined are equal to each other
      if ((a === null || a === undefined) && (b === null || b === undefined)) {
        return true;
      }
      // One null, one not
      if (a === null || a === undefined || b === null || b === undefined) {
        return false;
      }
      // Both Dates — compare timestamps
      if (a instanceof Date && b instanceof Date) {
        return a.getTime() === b.getTime();
      }
      // Mixed Date/non-Date — not equal
      if (a instanceof Date || b instanceof Date) {
        return false;
      }
      return a === b;
    }

    /**
     * Write back only changed cells to the sheet using header-based column lookup.
     * Each transaction's _sheetRowIndex tells us which row to write to,
     * and the sheetHeaders tell us which column each field maps to.
     * This avoids both row-shift bugs (from filtered invalid rows) and
     * column-order bugs (from assuming sheet matches HEADERS order).
     *
     * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet - The Transactions sheet
     * @param {ValidatedTransaction[]} transactions - Transactions with _sheetRowIndex metadata
     * @param {string[]} sheetHeaders - Actual column headers from the sheet (in sheet order)
     * @returns {number} Number of cells written
     */
    static writeChangedCells(sheet, transactions, sheetHeaders) {
      let changeCount = 0;

      for (const txn of transactions) {
        if (!txn._sheetRowIndex || !txn._originalValues) continue;

        // Build a map of current field values from the transaction's named properties
        // We iterate over sheetHeaders so we only touch columns that exist in the sheet
        for (let col = 0; col < sheetHeaders.length; col++) {
          const fieldName = sheetHeaders[col];
          const currentValue = txn[fieldName];
          const originalValue = txn._originalValues[fieldName];

          if (!ValidatedTransaction._valuesEqual(currentValue, originalValue)) {
            sheet.getRange(txn._sheetRowIndex, col + 1).setValue(currentValue);
            changeCount++;
          }
        }
      }

      return changeCount;
    }
  }

  return ValidatedTransaction;
})();

// Node.js module export for testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ValidatedTransaction };
}
