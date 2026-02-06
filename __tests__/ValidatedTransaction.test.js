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
        sendEmail: jest.fn()
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
      
      const emailCall = MailApp.sendEmail.mock.calls[0][0];
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
      MailApp.sendEmail.mockImplementation(() => {
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
        'test@example.com',
        'John',
        'Doe',
        '(555) 555-1234',
        '1 year',
        'Share Name, Share Email, Share Phone',
        'Paid',
        processed,
        timestamp
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
      
      expect(array[3]).toBe('(555) 555-5555'); // Phone
      expect(array[4]).toBe(''); // Payment
      expect(array[5]).toBe(''); // Directory
      expect(array[6]).toBe(''); // Payable Status
      expect(array[7]).toBe(null); // Processed
      expect(array[8]).toBe(null); // Timestamp
    });
    
  });
  
  describe('Round-trip Consistency', () => {
    
    test('should maintain data integrity through fromRow -> toArray cycle', () => {
      const headers = ValidatedTransaction.HEADERS;
      const processed = new Date('2023-12-15');
      const timestamp = new Date('2023-12-01');
      
      const originalRow = [
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
      
      const txn = ValidatedTransaction.fromRow(originalRow, headers, 2, null);
      const reconstructedRow = txn.toArray();
      
      // Compare each field
      expect(reconstructedRow[0]).toBe(originalRow[0]); // Email Address
      expect(reconstructedRow[1]).toBe(originalRow[1]); // First Name
      expect(reconstructedRow[2]).toBe(originalRow[2]); // Last Name
      expect(reconstructedRow[3]).toBe(originalRow[3]); // Phone
      expect(reconstructedRow[4]).toBe(originalRow[4]); // Payment
      expect(reconstructedRow[5]).toBe(originalRow[5]); // Directory
      expect(reconstructedRow[6]).toBe(originalRow[6]); // Payable Status
      expect(reconstructedRow[7]).toBe(originalRow[7]); // Processed
      expect(reconstructedRow[8]).toBe(originalRow[8]); // Timestamp
    });
    
  });
  
  describe('HEADERS Constant', () => {
    
    test('should define all required headers in correct order', () => {
      expect(ValidatedTransaction.HEADERS).toEqual([
        'Email Address',
        'First Name',
        'Last Name',
        'Phone',
        'Payment',
        'Directory',
        'Payable Status',
        'Processed',
        'Timestamp'
      ]);
    });
    
    test('should have 9 headers matching toArray() output length', () => {
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
        'test@example.com',
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
      
      expect(txn instanceof ValidatedTransaction).toBe(true);
    });
    
  });
  
});
