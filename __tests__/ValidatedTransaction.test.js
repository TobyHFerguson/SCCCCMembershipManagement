/**
 * @fileoverview Tests for ValidatedTransaction class
 * 
 * Tests the class-based approach to transaction validation and construction.
 * Ensures proper type safety and data quality.
 * 
 * Test Coverage:
 * - Constructor validation (required fields, optional fields)
 * - fromRow() factory method (success/failure, error collection)
 * - validateRows() batch validation (error consolidation, email alerts)
 * - toArray() round-trip consistency
 * - HEADERS constant
 */

// Mock GAS environment
jest.mock('../src/common/config/Properties.js', () => ({}));
jest.mock('../src/common/utils/Logger.js', () => ({}));

// Load the ValidatedTransaction class and assign to global
const { ValidatedTransaction } = require('../src/common/data/ValidatedTransaction.js');
// @ts-ignore - Test setup: add ValidatedTransaction to global for testing
global.ValidatedTransaction = ValidatedTransaction;

describe('ValidatedTransaction Class', () => {
  
  describe('Constructor Validation', () => {
    
    test('should create valid transaction with all fields', () => {
      const processed = new Date('2023-12-15');
      const timestamp = new Date('2023-12-01');
      
      const txn = new ValidatedTransaction(
        'test@example.com',
        'John',
        'Doe',
        '(555) 555-1234',
        '1 year',
        'Share Name, Share Email, Share Phone',
        'Paid',
        processed,
        timestamp
      );
      
      expect(txn['Email Address']).toBe('test@example.com');
      expect(txn['First Name']).toBe('John');
      expect(txn['Last Name']).toBe('Doe');
      expect(txn.Phone).toBe('(555) 555-1234');
      expect(txn.Payment).toBe('1 year');
      expect(txn.Directory).toBe('Share Name, Share Email, Share Phone');
      expect(txn['Payable Status']).toBe('Paid');
      expect(txn.Processed).toBe(processed);
      expect(txn.Timestamp).toBe(timestamp);
    });
    
    test('should create valid transaction with only required fields', () => {
      const txn = new ValidatedTransaction(
        'minimal@example.com',
        'Jane',
        'Smith',
        '(555) 555-1234',
        '',
        '',
        '',
        null,
        null
      );
      
      expect(txn['Email Address']).toBe('minimal@example.com');
      expect(txn['First Name']).toBe('Jane');
      expect(txn['Last Name']).toBe('Smith');
      expect(txn.Phone).toBe('(555) 555-1234');
      expect(txn.Payment).toBe('');
      expect(txn.Directory).toBe('');
      expect(txn['Payable Status']).toBe('');
      expect(txn.Processed).toBe(null);
      expect(txn.Timestamp).toBe(null);
    });
    
    test('should trim whitespace from string fields', () => {
      const txn = new ValidatedTransaction(
        '  test@example.com  ',
        '  John  ',
        '  Doe  ',
        '  (555) 555-1234  ',
        '  1 year  ',
        '  Share Name  ',
        '  Paid  ',
        null,
        null
      );
      
      expect(txn['Email Address']).toBe('test@example.com');
      expect(txn['First Name']).toBe('John');
      expect(txn['Last Name']).toBe('Doe');
      expect(txn.Phone).toBe('(555) 555-1234');
      expect(txn.Payment).toBe('1 year');
      expect(txn.Directory).toBe('Share Name');
      expect(txn['Payable Status']).toBe('Paid');
    });
    
    test('should throw error for missing email address', () => {
      expect(() => new ValidatedTransaction(
        null, 'John', 'Doe', '', '', '', '', null, null
      )).toThrow('email address is required');
      
      expect(() => new ValidatedTransaction(
        '', 'John', 'Doe', '', '', '', '', null, null
      )).toThrow('email address is required');
      
      expect(() => new ValidatedTransaction(
        '   ', 'John', 'Doe', '', '', '', '', null, null
      )).toThrow('email address is required');
    });
    
    test('should throw error for missing phone', () => {
      expect(() => new ValidatedTransaction(
        'test@example.com', 'John', 'Doe', null, '', '', '', null, null
      )).toThrow('phone is required');
      
      expect(() => new ValidatedTransaction(
        'test@example.com', 'John', 'Doe', '', '', '', '', null, null
      )).toThrow('phone is required');
      
      expect(() => new ValidatedTransaction(
        'test@example.com', 'John', 'Doe', '   ', '', '', '', null, null
      )).toThrow('phone is required');
    });
    
    test('should throw error for invalid phone format', () => {
      expect(() => new ValidatedTransaction(
        'test@example.com', 'John', 'Doe', '1234567890', '', '', '', null, null
      )).toThrow('phone must be in format (NNN) NNN-NNNN');
      
      expect(() => new ValidatedTransaction(
        'test@example.com', 'John', 'Doe', '555-1234', '', '', '', null, null
      )).toThrow('phone must be in format (NNN) NNN-NNNN');
      
      expect(() => new ValidatedTransaction(
        'test@example.com', 'John', 'Doe', '(555)555-5555', '', '', '', null, null
      )).toThrow('phone must be in format (NNN) NNN-NNNN');
      
      expect(() => new ValidatedTransaction(
        'test@example.com', 'John', 'Doe', '555 555 5555', '', '', '', null, null
      )).toThrow('phone must be in format (NNN) NNN-NNNN');
    });
    
    test('should accept valid phone format', () => {
      const txn = new ValidatedTransaction(
        'test@example.com', 'John', 'Doe', '(555) 555-5555', '', '', '', null, null
      );
      expect(txn.Phone).toBe('(555) 555-5555');
      
      const txn2 = new ValidatedTransaction(
        'test@example.com', 'Jane', 'Doe', '(123) 456-7890', '', '', '', null, null
      );
      expect(txn2.Phone).toBe('(123) 456-7890');
    });
    
    test('should throw error for missing first name', () => {
      expect(() => new ValidatedTransaction(
        'test@example.com', null, 'Doe', '(555) 555-5555', '', '', '', null, null
      )).toThrow('first name is required');
      
      expect(() => new ValidatedTransaction(
        'test@example.com', '', 'Doe', '(555) 555-5555', '', '', '', null, null
      )).toThrow('first name is required');
      
      expect(() => new ValidatedTransaction(
        'test@example.com', '   ', 'Doe', '', '', '', '', null, null
      )).toThrow('first name is required');
    });
    
    test('should throw error for missing last name', () => {
      expect(() => new ValidatedTransaction(
        'test@example.com', 'John', null, '', '', '', '', null, null
      )).toThrow('last name is required');
      
      expect(() => new ValidatedTransaction(
        'test@example.com', 'John', '', '', '', '', '', null, null
      )).toThrow('last name is required');
      
      expect(() => new ValidatedTransaction(
        'test@example.com', 'John', '   ', '', '', '', '', null, null
      )).toThrow('last name is required');
    });
    
    test('should throw error for invalid processed date if provided', () => {
      expect(() => new ValidatedTransaction(
        'test@example.com', 'John', 'Doe', '(555) 555-5555', '', '', '', 'not-a-date', null
      )).toThrow('processed date must be valid Date if provided');
      
      expect(() => new ValidatedTransaction(
        'test@example.com', 'John', 'Doe', '(555) 555-5555', '', '', '', new Date('invalid'), null
      )).toThrow('processed date must be valid Date if provided');
    });
    
    test('should throw error for invalid timestamp if provided', () => {
      expect(() => new ValidatedTransaction(
        'test@example.com', 'John', 'Doe', '(555) 555-5555', '', '', '', null, 'not-a-date'
      )).toThrow('timestamp must be valid Date if provided');
      
      expect(() => new ValidatedTransaction(
        'test@example.com', 'John', 'Doe', '(555) 555-5555', '', '', '', null, new Date('invalid')
      )).toThrow('timestamp must be valid Date if provided');
    });
    
    test('should accept null/empty processed date', () => {
      const txn1 = new ValidatedTransaction(
        'test@example.com', 'John', 'Doe', '(555) 555-5555', '', '', '', null, null
      );
      expect(txn1.Processed).toBe(null);
      
      const txn2 = new ValidatedTransaction(
        'test@example.com', 'John', 'Doe', '(555) 555-5555', '', '', '', undefined, null
      );
      expect(txn2.Processed).toBe(null);
      
      const txn3 = new ValidatedTransaction(
        'test@example.com', 'John', 'Doe', '(555) 555-5555', '', '', '', '', null
      );
      expect(txn3.Processed).toBe(null);
    });
    
    test('should accept null/empty timestamp', () => {
      const txn1 = new ValidatedTransaction(
        'test@example.com', 'John', 'Doe', '(555) 555-5555', '', '', '', null, null
      );
      expect(txn1.Timestamp).toBe(null);
      
      const txn2 = new ValidatedTransaction(
        'test@example.com', 'John', 'Doe', '(555) 555-5555', '', '', '', null, undefined
      );
      expect(txn2.Timestamp).toBe(null);
      
      const txn3 = new ValidatedTransaction(
        'test@example.com', 'John', 'Doe', '(555) 555-5555', '', '', '', null, ''
      );
      expect(txn3.Timestamp).toBe(null);
    });
    
    test('should handle optional string fields as empty strings when null/undefined', () => {
      // Phone is now required, so test payment and directory only
      const txn = new ValidatedTransaction(
        'test@example.com', 'John', 'Doe', '(555) 555-5555', undefined, '', null, null, null
      );
      
      expect(txn.Phone).toBe('(555) 555-5555');
      expect(txn.Payment).toBe('');
      expect(txn.Directory).toBe('');
      expect(txn['Payable Status']).toBe('');
    });
    
  });
  
  describe('fromRow() Static Factory', () => {
    
    const headers = [
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
    
    beforeEach(() => {
      // Mock AppLogger (flat class pattern)
      global.AppLogger = {
        error: jest.fn(),
        warn: jest.fn(),
        info: jest.fn(),
        debug: jest.fn()
      };

      // Mock GAS built-in Logger
      global.Logger = {
        log: jest.fn(),
        clear: jest.fn(),
        getLog: jest.fn(() => '')
      };
    });
    
    test('should create ValidatedTransaction from valid row', () => {
      const processed = new Date('2023-12-15');
      const timestamp = new Date('2023-12-01');
      
      const row = [
        'test@example.com',
        'John',
        'Doe',
        '(555) 555-1234',
        '1 year',
        'Share Name, Share Email, Share Phone',
        'Paid',
        processed,
        timestamp
      ];
      
      const txn = ValidatedTransaction.fromRow(row, headers, 2, null);
      
      expect(txn).not.toBeNull();
      expect(txn['Email Address']).toBe('test@example.com');
      expect(txn['First Name']).toBe('John');
      expect(txn['Last Name']).toBe('Doe');
      expect(txn.Phone).toBe('(555) 555-1234');
      expect(txn.Payment).toBe('1 year');
      expect(txn['Payable Status']).toBe('Paid');
      expect(txn.Processed).toBe(processed);
      expect(txn.Timestamp).toBe(timestamp);
      
      // Verify write-back metadata
      expect(txn._sheetRowIndex).toBe(2);
      expect(txn._originalValues).toBeDefined();
      expect(txn._originalValues['Email Address']).toBe('test@example.com');
      expect(txn._originalValues['Processed']).toBe(processed);
      expect(txn._originalValues['Timestamp']).toBe(timestamp);
    });
    
    test('should return null for row with missing email address', () => {
      const row = [
        '', // Missing email
        'John',
        'Doe',
        '(555) 555-1234',
        '1 year',
        'Share Name',
        'Paid',
        null,
        null
      ];
      
      const txn = ValidatedTransaction.fromRow(row, headers, 2, null);
      
      expect(txn).toBeNull();
      expect(AppLogger.error).toHaveBeenCalledWith(
        'ValidatedTransaction',
        expect.stringContaining('Row 2:')
      );
    });
    
    test('should return null for row with missing first name', () => {
      const row = [
        'test@example.com',
        '', // Missing first name
        'Doe',
        '(555) 555-1234',
        '1 year',
        'Share Name',
        'Paid',
        null,
        null
      ];
      
      const txn = ValidatedTransaction.fromRow(row, headers, 3, null);
      
      expect(txn).toBeNull();
      expect(AppLogger.error).toHaveBeenCalledWith(
        'ValidatedTransaction',
        expect.stringContaining('Row 3:')
      );
    });
    
    test('should return null for row with missing last name', () => {
      const row = [
        'test@example.com',
        'John',
        '', // Missing last name
        '(555) 555-1234',
        '1 year',
        'Share Name',
        'Paid',
        null,
        null
      ];
      
      const txn = ValidatedTransaction.fromRow(row, headers, 4, null);
      
      expect(txn).toBeNull();
      expect(AppLogger.error).toHaveBeenCalledWith(
        'ValidatedTransaction',
        expect.stringContaining('Row 4:')
      );
    });
    
    test('should populate errorCollector on validation failure', () => {
      const row = [
        '', // Missing email address
        'John',
        'Doe',
        '(555) 555-1234',
        '1 year',
        'Share Name',
        'Paid',
        null,
        null
      ];
      
      const errorCollector = { errors: [], rowNumbers: [] };
      const txn = ValidatedTransaction.fromRow(row, headers, 5, errorCollector);
      
      expect(txn).toBeNull();
      expect(errorCollector.errors.length).toBe(1);
      expect(errorCollector.errors[0]).toContain('Row 5:');
      expect(errorCollector.errors[0]).toContain('email address is required');
      expect(errorCollector.rowNumbers).toContain(5);
    });
    
    test('should handle missing optional fields gracefully', () => {
      const row = [
        'test@example.com',
        'John',
        'Doe',
        '(555) 555-5555', // Phone now required
        '', // No payment
        '', // No directory
        '', // No payable status
        null, // No processed date
        null // No timestamp
      ];
      
      const txn = ValidatedTransaction.fromRow(row, headers, 2, null);
      
      expect(txn).not.toBeNull();
      expect(txn.Phone).toBe('(555) 555-5555');
      expect(txn.Payment).toBe('');
      expect(txn.Directory).toBe('');
      expect(txn['Payable Status']).toBe('');
      expect(txn.Processed).toBe(null);
      expect(txn.Timestamp).toBe(null);
    });

    test('should work correctly when sheet columns are in different order than HEADERS (column-order independence)', () => {
      // Arrange: Use ALL 17 HEADERS columns in REVERSED order
      const shuffledHeaders = [...ValidatedTransaction.HEADERS].reverse();
      // shuffledHeaders = ['Processed', 'Payable Last Updated', ..., 'Timestamp']

      const processed = new Date('2023-12-15');
      const timestamp = new Date('2023-12-01');

      // Build a lookup of column values keyed by header name
      const testData = {
        'Timestamp': timestamp,
        'Email Address': 'shuffled@example.com',
        'Are you 18 years of age or older?': 'Yes',
        'Privacy': 'Accepted',
        'Membership Agreement': 'Agreed',
        'Directory': 'Share Name, Share Email',
        'First Name': 'Alice',
        'Last Name': 'Wonderland',
        'Phone': '(831) 555-4321',
        'Payment': '2 years',
        'Payable Order ID': 'ORD-123',
        'Payable Total': '$60.00',
        'Payable Status': 'Paid',
        'Payable Payment Method': 'Credit Card',
        'Payable Transaction ID': 'TXN-456',
        'Payable Last Updated': '2023-12-15',
        'Processed': processed
      };

      // Build row array in shuffled header order
      const rowData = shuffledHeaders.map(h => testData[h]);

      // Act: fromRow must use header-based lookup, not positional indexing
      const txn = ValidatedTransaction.fromRow(rowData, shuffledHeaders, 3, null);

      // Assert: All properties must be correct regardless of column order
      expect(txn).not.toBeNull();
      expect(txn['Email Address']).toBe('shuffled@example.com');
      expect(txn['First Name']).toBe('Alice');
      expect(txn['Last Name']).toBe('Wonderland');
      expect(txn.Phone).toBe('(831) 555-4321');
      expect(txn.Payment).toBe('2 years');
      expect(txn.Directory).toBe('Share Name, Share Email');
      expect(txn['Payable Status']).toBe('Paid');
      expect(txn.Processed).toBe(processed);
      expect(txn.Timestamp).toBe(timestamp);

      // Verify passthrough fields preserved
      expect(txn['Are you 18 years of age or older?']).toBe('Yes');
      expect(txn.Privacy).toBe('Accepted');
      expect(txn['Membership Agreement']).toBe('Agreed');
      expect(txn['Payable Order ID']).toBe('ORD-123');
      expect(txn['Payable Total']).toBe('$60.00');
      expect(txn['Payable Payment Method']).toBe('Credit Card');
      expect(txn['Payable Transaction ID']).toBe('TXN-456');
      expect(txn['Payable Last Updated']).toBe('2023-12-15');

      // Verify write-back metadata uses shuffled headers correctly
      expect(txn._sheetRowIndex).toBe(3);
      expect(txn._originalValues['Email Address']).toBe('shuffled@example.com');
      expect(txn._originalValues['Phone']).toBe('(831) 555-4321');
      expect(txn._originalValues['Processed']).toBe(processed);
      expect(txn._originalValues['Timestamp']).toBe(timestamp);

      // Verify instance type preservation
      expect(txn).toBeInstanceOf(ValidatedTransaction);
      expect(typeof txn.toArray).toBe('function');
    });
    
  });
  
  describe('validateRows() Batch Validation', () => {
    
    const headers = [
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
    
    beforeEach(() => {
      // Mock AppLogger (flat class pattern)
      global.AppLogger = {
        error: jest.fn(),
        warn: jest.fn(),
        info: jest.fn(),
        debug: jest.fn()
      };

      // Mock GAS built-in Logger
      global.Logger = {
        log: jest.fn(),
        clear: jest.fn(),
        getLog: jest.fn(() => '')
      };
      
      // Mock MailApp
      global.MailApp = {
        sendEmail: jest.fn(),
        getRemainingDailyQuota: jest.fn(() => 100)
      };
    });
    
    test('should process all valid rows', () => {
      const rows = [
        ['test1@example.com', 'John', 'Doe', '(555) 111-1111', '1 year', 'Share Name', 'Paid', null, new Date('2023-12-01')],
        ['test2@example.com', 'Jane', 'Smith', '(555) 222-2222', '2 years', 'Share Email', 'Paid', null, new Date('2023-12-02')],
        ['test3@example.com', 'Bob', 'Jones', '(555) 333-3333', '1 year', '', 'Pending', null, new Date('2023-12-03')]
      ];
      
      const transactions = ValidatedTransaction.validateRows(rows, headers, 'test-context');
      
      expect(transactions.length).toBe(3);
      expect(transactions[0]['Email Address']).toBe('test1@example.com');
      expect(transactions[1]['Email Address']).toBe('test2@example.com');
      expect(transactions[2]['Email Address']).toBe('test3@example.com');
      expect(MailApp.sendEmail).not.toHaveBeenCalled();
    });
    
    test('should skip invalid rows and continue processing', () => {
      const rows = [
        ['test1@example.com', 'John', 'Doe', '(555) 111-1111', '1 year', 'Share Name', 'Paid', null, null],
        ['', 'Jane', 'Smith', '(555) 222-2222', '2 years', 'Share Email', 'Paid', null, null], // Missing email
        ['test3@example.com', 'Bob', 'Jones', '(555) 333-3333', '1 year', '', 'Pending', null, null]
      ];
      
      const transactions = ValidatedTransaction.validateRows(rows, headers, 'test-context');
      
      expect(transactions.length).toBe(2);
      expect(transactions[0]['Email Address']).toBe('test1@example.com');
      expect(transactions[1]['Email Address']).toBe('test3@example.com');
    });
    
    test('should send consolidated email on validation errors', () => {
      const rows = [
        ['test1@example.com', 'John', 'Doe', '(555) 111-1111', '1 year', 'Share Name', 'Paid', null, null],
        ['', 'Jane', 'Smith', '(555) 222-2222', '2 years', 'Share Email', 'Paid', null, null], // Missing email
        ['test3@example.com', '', 'Jones', '(555) 333-3333', '1 year', '', 'Pending', null, null] // Missing first name
      ];
      
      const transactions = ValidatedTransaction.validateRows(rows, headers, 'test-batch-context');
      
      expect(transactions.length).toBe(1);
      expect(MailApp.sendEmail).toHaveBeenCalledTimes(1);
      
      const emailCall = /** @type {jest.Mock} */ (MailApp.sendEmail).mock.calls[0][0];
      expect(emailCall.to).toBe('membership-automation@sc3.club');
      expect(emailCall.subject).toContain('2 Transaction Validation Errors');
      expect(emailCall.body).toContain('test-batch-context');
      expect(emailCall.body).toContain('Total rows processed: 3');
      expect(emailCall.body).toContain('Rows skipped due to errors: 2');
      expect(emailCall.body).toContain('Row 3:'); // Row 2 is first error (row index 1 + 2)
      expect(emailCall.body).toContain('Row 4:'); // Row 3 is second error
    });
    
    test('should not send email when all rows are valid', () => {
      const rows = [
        ['test1@example.com', 'John', 'Doe', '(555) 111-1111', '1 year', 'Share Name', 'Paid', null, null]
      ];
      
      const transactions = ValidatedTransaction.validateRows(rows, headers, 'test-context');
      
      expect(transactions.length).toBe(1);
      expect(MailApp.sendEmail).not.toHaveBeenCalled();
    });
    
    test('should handle empty rows array', () => {
      const transactions = ValidatedTransaction.validateRows([], headers, 'test-context');
      
      expect(transactions.length).toBe(0);
      expect(MailApp.sendEmail).not.toHaveBeenCalled();
    });
    
    test('should log warning when sending email', () => {
      const rows = [
        ['', 'John', 'Doe', '(555) 555-5555', '', '', '', null, null] // Missing email
      ];
      
      ValidatedTransaction.validateRows(rows, headers, 'test-email-context');
      
      expect(AppLogger.warn).toHaveBeenCalledWith(
        'ValidatedTransaction',
        expect.stringContaining('Sent validation error alert email')
      );
    });
    
    test('should handle email send failure gracefully', () => {
      /** @type {jest.Mock} */ (MailApp.sendEmail).mockImplementation(() => {
        throw new Error('Email service unavailable');
      });
      
      const rows = [
        ['', 'John', 'Doe', '', '', '', '', null, null] // Missing email
      ];
      
      const transactions = ValidatedTransaction.validateRows(rows, headers, 'test-context');
      
      expect(transactions.length).toBe(0);
      expect(AppLogger.error).toHaveBeenCalledWith(
        'ValidatedTransaction',
        expect.stringContaining('Failed to send validation error alert')
      );
    });
    
  });
  
  describe('toArray() Method', () => {
    
    test('should convert transaction to array in correct column order', () => {
      const processed = new Date('2023-12-15');
      const timestamp = new Date('2023-12-01');
      
      const txn = new ValidatedTransaction(
        'test@example.com',
        'John',
        'Doe',
        '(555) 555-1234',
        '1 year',
        'Share Name, Share Email, Share Phone',
        'Paid',
        processed,
        timestamp
      );
      
      const array = txn.toArray();
      
      expect(array).toEqual([
        timestamp,                              // Timestamp
        'test@example.com',                     // Email Address
        '',                                     // Are you 18 years of age or older?
        '',                                     // Privacy
        '',                                     // Membership Agreement
        'Share Name, Share Email, Share Phone',  // Directory
        'John',                                 // First Name
        'Doe',                                  // Last Name
        '(555) 555-1234',                       // Phone
        '1 year',                               // Payment
        '',                                     // Payable Order ID
        '',                                     // Payable Total
        'Paid',                                 // Payable Status
        '',                                     // Payable Payment Method
        '',                                     // Payable Transaction ID
        '',                                     // Payable Last Updated
        processed                               // Processed
      ]);
    });
    
    test('should handle null optional fields in array', () => {
      const txn = new ValidatedTransaction(
        'test@example.com',
        'John',
        'Doe',
        '(555) 555-5555',
        '',
        '',
        '',
        null,
        null
      );
      
      const array = txn.toArray();
      
      expect(array.length).toBe(17);
      expect(array[0]).toBe(null);              // Timestamp
      expect(array[1]).toBe('test@example.com'); // Email Address
      expect(array[5]).toBe('');                // Directory
      expect(array[6]).toBe('John');            // First Name
      expect(array[7]).toBe('Doe');             // Last Name
      expect(array[8]).toBe('(555) 555-5555'); // Phone
      expect(array[9]).toBe('');                // Payment
      expect(array[12]).toBe('');               // Payable Status
      expect(array[16]).toBe(null);             // Processed
    });
    
  });
  
  describe('Round-trip Consistency', () => {
    
    test('should maintain data integrity through fromRow -> toArray cycle', () => {
      const headers = ValidatedTransaction.HEADERS;
      const processed = new Date('2023-12-15');
      const timestamp = new Date('2023-12-01');
      
      const originalRow = [
        timestamp,                              // Timestamp
        'test@example.com',                     // Email Address
        'Yes',                                  // Are you 18 years of age or older?
        'I have read the privacy policy',       // Privacy
        'I Agree',                              // Membership Agreement
        'Share Name, Share Email, Share Phone',  // Directory
        'John',                                 // First Name
        'Doe',                                  // Last Name
        '(555) 555-1234',                       // Phone
        '1 year',                               // Payment
        'DK-TF-VZD2',                           // Payable Order ID
        '$0.50',                                // Payable Total
        'Paid',                                 // Payable Status
        'Credit Card',                          // Payable Payment Method
        'TXN-12345',                            // Payable Transaction ID
        '2023-12-10',                           // Payable Last Updated
        processed                               // Processed
      ];
      
      const txn = ValidatedTransaction.fromRow(originalRow, headers, 2, null);
      const reconstructedRow = txn.toArray();
      
      // Compare each field
      for (let i = 0; i < headers.length; i++) {
        expect(reconstructedRow[i]).toBe(originalRow[i]); // column: headers[i]
      }
    });
    
  });
  
  describe('HEADERS Constant', () => {
    
    test('should define all required headers in correct order', () => {
      expect(ValidatedTransaction.HEADERS).toEqual([
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
      ]);
    });
    
    test('should have 17 headers matching toArray() output length', () => {
      const txn = new ValidatedTransaction(
        'test@example.com',
        'John',
        'Doe',
        '(555) 555-5555',
        '',
        '',
        '',
        null,
        null
      );
      
      const array = txn.toArray();
      expect(array.length).toBe(ValidatedTransaction.HEADERS.length);
      expect(array.length).toBe(17);
    });
    
  });
  
  describe('Instance Type', () => {
    
    test('should preserve instanceof ValidatedTransaction', () => {
      const txn = new ValidatedTransaction(
        'test@example.com',
        'John',
        'Doe',
        '(555) 555-5555',
        '',
        '',
        '',
        null,
        null
      );
      
      expect(txn instanceof ValidatedTransaction).toBe(true);
    });
    
    test('should preserve instanceof after fromRow()', () => {
      const headers = ValidatedTransaction.HEADERS;
      const row = [
        new Date('2023-12-01'),                 // Timestamp
        'test@example.com',                     // Email Address
        'Yes',                                  // Are you 18 years of age or older?
        'I have read the privacy policy',       // Privacy
        'I Agree',                              // Membership Agreement
        'Share Name',                           // Directory
        'John',                                 // First Name
        'Doe',                                  // Last Name
        '(555) 555-1234',                       // Phone
        '1 year',                               // Payment
        'DK-TF-VZD2',                           // Payable Order ID
        '$0.50',                                // Payable Total
        'Paid',                                 // Payable Status
        '',                                     // Payable Payment Method
        '',                                     // Payable Transaction ID
        '',                                     // Payable Last Updated
        null                                    // Processed
      ];
      
      const txn = ValidatedTransaction.fromRow(row, headers, 2, null);
      
      expect(txn instanceof ValidatedTransaction).toBe(true);
    });
    
  });

  // @ts-ignore - Testing private method _valuesEqual (not in public API)
  describe('_valuesEqual()', () => {

    test('should treat null and undefined as equal', () => {
      // @ts-ignore - Testing private method
      expect(ValidatedTransaction._valuesEqual(null, null)).toBe(true);
      // @ts-ignore - Testing private method
      expect(ValidatedTransaction._valuesEqual(undefined, undefined)).toBe(true);
      // @ts-ignore - Testing private method
      expect(ValidatedTransaction._valuesEqual(null, undefined)).toBe(true);
      // @ts-ignore - Testing private method
      expect(ValidatedTransaction._valuesEqual(undefined, null)).toBe(true);
    });

    test('should treat null/undefined as not equal to other values', () => {
      // @ts-ignore - Testing private method
      expect(ValidatedTransaction._valuesEqual(null, '')).toBe(false);
      // @ts-ignore - Testing private method
      expect(ValidatedTransaction._valuesEqual(null, 0)).toBe(false);
      // @ts-ignore - Testing private method
      expect(ValidatedTransaction._valuesEqual('', null)).toBe(false);
      // @ts-ignore - Testing private method
      expect(ValidatedTransaction._valuesEqual(undefined, '')).toBe(false);
    });

    test('should compare Date objects by timestamp', () => {
      const d1 = new Date('2024-01-15T10:00:00Z');
      const d2 = new Date('2024-01-15T10:00:00Z');
      const d3 = new Date('2024-01-16T10:00:00Z');
      // @ts-ignore - Testing private method
      expect(ValidatedTransaction._valuesEqual(d1, d2)).toBe(true);
      // @ts-ignore - Testing private method
      expect(ValidatedTransaction._valuesEqual(d1, d3)).toBe(false);
    });

    test('should not consider Date equal to non-Date', () => {
      const d = new Date('2024-01-15');
      // @ts-ignore - Testing private method
      expect(ValidatedTransaction._valuesEqual(d, '2024-01-15')).toBe(false);
      // @ts-ignore - Testing private method
      expect(ValidatedTransaction._valuesEqual('2024-01-15', d)).toBe(false);
    });

    test('should compare primitives with strict equality', () => {
      // @ts-ignore - Testing private method
      expect(ValidatedTransaction._valuesEqual('abc', 'abc')).toBe(true);
      // @ts-ignore - Testing private method
      expect(ValidatedTransaction._valuesEqual('abc', 'def')).toBe(false);
      // @ts-ignore - Testing private method
      expect(ValidatedTransaction._valuesEqual(42, 42)).toBe(true);
      // @ts-ignore - Testing private method
      expect(ValidatedTransaction._valuesEqual(42, 43)).toBe(false);
      // @ts-ignore - Testing private method
      expect(ValidatedTransaction._valuesEqual(true, true)).toBe(true);
      // @ts-ignore - Testing private method
      expect(ValidatedTransaction._valuesEqual(true, false)).toBe(false);
    });
  });

  describe('writeChangedCells()', () => {

    let mockSheet;
    let mockRange;

    beforeEach(() => {
      mockRange = { setValue: jest.fn() };
      mockSheet = { getRange: jest.fn().mockReturnValue(mockRange) };

      global.AppLogger = {
        error: jest.fn(),
        warn: jest.fn(),
        info: jest.fn(),
        debug: jest.fn()
      };
      global.Logger = { log: jest.fn(), clear: jest.fn(), getLog: jest.fn(() => '') };
    });

    test('should write only changed cells to the correct row and column', () => {
      // Sheet has columns in a specific order
      const sheetHeaders = ['Timestamp', 'Email Address', 'First Name', 'Last Name', 'Phone', 'Payable Status', 'Processed'];
      const timestamp = new Date('2023-12-01');

      // Simulate a transaction read from sheet row 6 (1-based)
      const originalRow = [timestamp, 'test@example.com', 'John', 'Doe', '(555) 555-1234', 'Paid', null];
      const txn = ValidatedTransaction.fromRow(originalRow, sheetHeaders, 6, null);

      // Manager sets Processed on this transaction
      const processedDate = new Date('2024-01-20');
      txn.Processed = processedDate;

      const changeCount = ValidatedTransaction.writeChangedCells(mockSheet, [txn], sheetHeaders);

      expect(changeCount).toBe(1);
      // 'Processed' is column 7 in sheetHeaders (1-based), row 6
      expect(mockSheet.getRange).toHaveBeenCalledWith(6, 7);
      expect(mockRange.setValue).toHaveBeenCalledWith(processedDate);
    });

    test('should handle columns in any order (not depend on HEADERS order)', () => {
      // Sheet columns in DIFFERENT order than ValidatedTransaction.HEADERS
      const sheetHeaders = ['Processed', 'Phone', 'First Name', 'Last Name', 'Email Address', 'Timestamp', 'Payable Status'];
      const originalRow = [null, '(555) 555-1234', 'John', 'Doe', 'test@example.com', new Date('2023-12-01'), 'Paid'];
      const txn = ValidatedTransaction.fromRow(originalRow, sheetHeaders, 4, null);

      const processedDate = new Date('2024-01-20');
      txn.Processed = processedDate;

      const changeCount = ValidatedTransaction.writeChangedCells(mockSheet, [txn], sheetHeaders);

      expect(changeCount).toBe(1);
      // 'Processed' is column 1 in this reordered sheet (1-based), row 4
      expect(mockSheet.getRange).toHaveBeenCalledWith(4, 1);
      expect(mockRange.setValue).toHaveBeenCalledWith(processedDate);
    });

    test('should NOT write unchanged cells', () => {
      const sheetHeaders = ['Email Address', 'First Name', 'Last Name', 'Phone', 'Payable Status', 'Processed'];
      const originalRow = ['test@example.com', 'John', 'Doe', '(555) 555-1234', 'Paid', null];
      const txn = ValidatedTransaction.fromRow(originalRow, sheetHeaders, 3, null);

      // Don't change anything
      const changeCount = ValidatedTransaction.writeChangedCells(mockSheet, [txn], sheetHeaders);

      expect(changeCount).toBe(0);
      expect(mockSheet.getRange).not.toHaveBeenCalled();
    });

    test('should write to correct row for each transaction (no row shift)', () => {
      // Simulate: rows 2, 3, 5 are valid (row 4 was invalid and filtered out)
      const sheetHeaders = ['Email Address', 'First Name', 'Last Name', 'Phone', 'Payable Status', 'Processed'];

      const row2 = ['a@test.com', 'A', 'Test', '(555) 111-1111', 'Paid', null];
      const row3 = ['b@test.com', 'B', 'Test', '(555) 222-2222', 'Paid', null];
      const row5 = ['c@test.com', 'C', 'Test', '(555) 333-3333', 'Paid', null];

      const txn2 = ValidatedTransaction.fromRow(row2, sheetHeaders, 2, null);
      const txn3 = ValidatedTransaction.fromRow(row3, sheetHeaders, 3, null);
      const txn5 = ValidatedTransaction.fromRow(row5, sheetHeaders, 5, null);

      // Only txn5 gets processed (others are already processed or unpaid in real scenario)
      const processedDate = new Date('2024-01-20');
      txn5.Processed = processedDate;

      const changeCount = ValidatedTransaction.writeChangedCells(
        mockSheet, [txn2, txn3, txn5], sheetHeaders
      );

      expect(changeCount).toBe(1);
      // Must write to ROW 5, not row 4 (which would happen with old bulk write)
      expect(mockSheet.getRange).toHaveBeenCalledWith(5, 6); // row 5, col 6 (Processed)
      expect(mockRange.setValue).toHaveBeenCalledWith(processedDate);
    });

    test('should skip transactions without _sheetRowIndex', () => {
      const sheetHeaders = ['Email Address', 'Phone', 'Payable Status', 'Processed'];

      // Manually create a transaction without metadata
      const txn = new ValidatedTransaction('test@example.com', 'A', 'B', '(555) 555-1234', '', '', 'Paid', null, null);
      txn.Processed = new Date('2024-01-20');

      const changeCount = ValidatedTransaction.writeChangedCells(mockSheet, [txn], sheetHeaders);

      expect(changeCount).toBe(0);
      expect(mockSheet.getRange).not.toHaveBeenCalled();
    });

    test('should handle multiple changed fields in one transaction', () => {
      const sheetHeaders = ['Email Address', 'First Name', 'Last Name', 'Phone', 'Payable Status', 'Processed', 'Timestamp'];
      const originalRow = ['test@example.com', 'John', 'Doe', '(555) 555-1234', 'Paid', null, null];
      const txn = ValidatedTransaction.fromRow(originalRow, sheetHeaders, 7, null);

      const now = new Date('2024-01-20');
      txn.Processed = now;
      txn.Timestamp = now;

      const changeCount = ValidatedTransaction.writeChangedCells(mockSheet, [txn], sheetHeaders);

      expect(changeCount).toBe(2);
      expect(mockSheet.getRange).toHaveBeenCalledWith(7, 6); // Processed col
      expect(mockSheet.getRange).toHaveBeenCalledWith(7, 7); // Timestamp col
    });
  });
  
});
