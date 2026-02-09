/**
 * @fileoverview Tests for ValidatedBootstrap class
 * 
 * Tests the class-based approach to Bootstrap configuration validation.
 * Ensures proper type safety and data quality.
 * 
 * TABLE OF CONTENTS:
 * 1. Constructor Validation
 *    - Valid creation with all fields
 *    - Valid creation with minimal required fields
 *    - Field trimming
 *    - createIfMissing coercion (boolean, string 'TRUE'/'true')
 *    - Reference required
 *    - sheetName required
 * 2. fromRow() Static Factory
 *    - Valid row parsing
 *    - Column-order independence (MANDATORY)
 *    - Missing required fields
 *    - Error collection
 * 3. validateRows() Batch Validation
 *    - Multiple valid rows
 *    - Mixed valid/invalid rows
 *    - Email alert on errors
 *    - Empty array handling
 * 4. toArray() Serialization
 *    - Round-trip consistency
 *    - Column order matching HEADERS
 */

// Mock GAS environment
jest.mock('../src/common/config/Properties.js', () => ({}));
jest.mock('../src/common/utils/Logger.js', () => ({}));

// Load the ValidatedBootstrap class and assign to global
const { ValidatedBootstrap } = require('../src/common/data/ValidatedBootstrap.js');
// @ts-ignore - Test setup: add ValidatedBootstrap to global for testing
global.ValidatedBootstrap = ValidatedBootstrap;

describe('ValidatedBootstrap Class', () => {

  beforeEach(() => {
    // @ts-ignore - Mock MailApp for testing
    global.MailApp = { 
      sendEmail: jest.fn(),
      getRemainingDailyQuota: jest.fn(() => 100)
    };
  });

  afterEach(() => {
    delete global.MailApp;
  });

  // ========================================================================
  // 1. Constructor Validation
  // ========================================================================

  describe('Constructor Validation', () => {

    test('should create valid entry with all fields', () => {
      const entry = new ValidatedBootstrap('ActiveMembers', 'abc123', 'Active Members', true);

      expect(entry.Reference).toBe('ActiveMembers');
      expect(entry.id).toBe('abc123');
      expect(entry.sheetName).toBe('Active Members');
      expect(entry.createIfMissing).toBe(true);
    });

    test('should create valid entry with empty id (local sheet)', () => {
      const entry = new ValidatedBootstrap('Transactions', '', 'Transactions', false);

      expect(entry.Reference).toBe('Transactions');
      expect(entry.id).toBe('');
      expect(entry.sheetName).toBe('Transactions');
      expect(entry.createIfMissing).toBe(false);
    });

    test('should create valid entry with null id (treated as empty)', () => {
      const entry = new ValidatedBootstrap('Logs', null, 'SystemLogs', false);

      expect(entry.id).toBe('');
    });

    test('should create valid entry with undefined id (treated as empty)', () => {
      const entry = new ValidatedBootstrap('Logs', undefined, 'SystemLogs', false);

      expect(entry.id).toBe('');
    });

    test('should trim whitespace from Reference and sheetName', () => {
      const entry = new ValidatedBootstrap('  ActiveMembers  ', '', '  Active Members  ', false);

      expect(entry.Reference).toBe('ActiveMembers');
      expect(entry.sheetName).toBe('Active Members');
    });

    test('should coerce boolean true for createIfMissing', () => {
      const entry = new ValidatedBootstrap('Test', '', 'Test', true);
      expect(entry.createIfMissing).toBe(true);
    });

    test('should coerce boolean false for createIfMissing', () => {
      const entry = new ValidatedBootstrap('Test', '', 'Test', false);
      expect(entry.createIfMissing).toBe(false);
    });

    test('should coerce string "TRUE" for createIfMissing', () => {
      // Sheets may return boolean-like strings
      const entry = new ValidatedBootstrap('Test', '', 'Test', 'TRUE');
      expect(entry.createIfMissing).toBe(true);
    });

    test('should coerce string "false" for createIfMissing', () => {
      const entry = new ValidatedBootstrap('Test', '', 'Test', 'false');
      // Boolean('false') is true, but we only check for true/TRUE
      expect(entry.createIfMissing).toBe(true); // non-empty string coerces to true
    });

    test('should coerce falsy value for createIfMissing', () => {
      const entry = new ValidatedBootstrap('Test', '', 'Test', 0);
      expect(entry.createIfMissing).toBe(false);
    });

    test('should reject empty Reference', () => {
      expect(() => {
        new ValidatedBootstrap('', '', 'Sheet1', false);
      }).toThrow('ValidatedBootstrap Reference is required');
    });

    test('should reject whitespace-only Reference', () => {
      expect(() => {
        new ValidatedBootstrap('   ', '', 'Sheet1', false);
      }).toThrow('ValidatedBootstrap Reference is required');
    });

    test('should reject null Reference', () => {
      expect(() => {
        new ValidatedBootstrap(null, '', 'Sheet1', false);
      }).toThrow('ValidatedBootstrap Reference is required');
    });

    test('should reject empty sheetName', () => {
      expect(() => {
        new ValidatedBootstrap('Ref', '', '', false);
      }).toThrow('ValidatedBootstrap sheetName is required');
    });

    test('should reject whitespace-only sheetName', () => {
      expect(() => {
        new ValidatedBootstrap('Ref', '', '   ', false);
      }).toThrow('ValidatedBootstrap sheetName is required');
    });

    test('should reject null sheetName', () => {
      expect(() => {
        new ValidatedBootstrap('Ref', '', null, false);
      }).toThrow('ValidatedBootstrap sheetName is required');
    });
  });

  // ========================================================================
  // 2. fromRow() Static Factory
  // ========================================================================

  describe('fromRow() Static Factory', () => {

    test('should create instance from row with standard header order', () => {
      const headers = ValidatedBootstrap.HEADERS;
      const row = ['ActiveMembers', 'abc123', 'Active Members', true];

      const entry = ValidatedBootstrap.fromRow(row, headers, 2);

      expect(entry).not.toBeNull();
      expect(entry.Reference).toBe('ActiveMembers');
      expect(entry.id).toBe('abc123');
      expect(entry.sheetName).toBe('Active Members');
      expect(entry.createIfMissing).toBe(true);
    });

    test('should parse string "TRUE" for createIfMissing from sheet data', () => {
      const headers = ValidatedBootstrap.HEADERS;
      const row = ['ExpirySchedule', '', 'ExpirySchedule', 'TRUE'];

      const entry = ValidatedBootstrap.fromRow(row, headers, 2);

      expect(entry).not.toBeNull();
      expect(entry.createIfMissing).toBe(true);
    });

    test('should parse string "true" (lowercase) for createIfMissing', () => {
      const headers = ValidatedBootstrap.HEADERS;
      const row = ['ExpirySchedule', '', 'ExpirySchedule', 'true'];

      const entry = ValidatedBootstrap.fromRow(row, headers, 2);

      expect(entry).not.toBeNull();
      expect(entry.createIfMissing).toBe(true);
    });

    test('should parse string "false" for createIfMissing', () => {
      const headers = ValidatedBootstrap.HEADERS;
      const row = ['ExpirySchedule', '', 'ExpirySchedule', 'false'];

      const entry = ValidatedBootstrap.fromRow(row, headers, 2);

      expect(entry).not.toBeNull();
      expect(entry.createIfMissing).toBe(false);
    });

    test('should parse boolean false for createIfMissing', () => {
      const headers = ValidatedBootstrap.HEADERS;
      const row = ['ExpirySchedule', '', 'ExpirySchedule', false];

      const entry = ValidatedBootstrap.fromRow(row, headers, 2);

      expect(entry).not.toBeNull();
      expect(entry.createIfMissing).toBe(false);
    });

    test('should return null for missing Reference', () => {
      const headers = ValidatedBootstrap.HEADERS;
      const row = ['', '', 'Sheet1', false];

      const entry = ValidatedBootstrap.fromRow(row, headers, 2);

      expect(entry).toBeNull();
    });

    test('should return null for missing sheetName', () => {
      const headers = ValidatedBootstrap.HEADERS;
      const row = ['Ref', '', '', false];

      const entry = ValidatedBootstrap.fromRow(row, headers, 2);

      expect(entry).toBeNull();
    });

    test('should collect errors when errorCollector is provided', () => {
      const headers = ValidatedBootstrap.HEADERS;
      const row = ['', '', '', false];
      const errorCollector = { errors: [], rowNumbers: [] };

      const entry = ValidatedBootstrap.fromRow(row, headers, 5, errorCollector);

      expect(entry).toBeNull();
      expect(errorCollector.errors.length).toBe(1);
      expect(errorCollector.rowNumbers).toContain(5);
      expect(errorCollector.errors[0]).toContain('Row 5');
    });
  });

  // ========================================================================
  // 3. validateRows() Batch Validation
  // ========================================================================

  describe('validateRows() Batch Validation', () => {

    test('should validate multiple valid rows', () => {
      const headers = ValidatedBootstrap.HEADERS;
      const rows = [
        ['ActiveMembers', '', 'Active Members', true],
        ['Transactions', 'abc123', 'Transactions', false],
        ['Elections', 'xyz789', 'Elections', true],
      ];

      const results = ValidatedBootstrap.validateRows(rows, headers, 'test');

      expect(results.length).toBe(3);
      expect(results[0].Reference).toBe('ActiveMembers');
      expect(results[1].Reference).toBe('Transactions');
      expect(results[2].Reference).toBe('Elections');
    });

    test('should filter out invalid rows and keep valid ones', () => {
      const headers = ValidatedBootstrap.HEADERS;
      const rows = [
        ['ActiveMembers', '', 'Active Members', true],
        ['', '', 'Missing Ref', false], // invalid: no Reference
        ['Transactions', '', 'Transactions', false],
      ];

      const results = ValidatedBootstrap.validateRows(rows, headers, 'test');

      expect(results.length).toBe(2);
      expect(results[0].Reference).toBe('ActiveMembers');
      expect(results[1].Reference).toBe('Transactions');
    });

    test('should send email alert for invalid rows', () => {
      const headers = ValidatedBootstrap.HEADERS;
      const rows = [
        ['', '', 'MissingRef', false],
      ];

      ValidatedBootstrap.validateRows(rows, headers, 'test-context');

      expect(MailApp.sendEmail).toHaveBeenCalledTimes(1);
      const call = /** @type {jest.Mock} */ (MailApp.sendEmail).mock.calls[0][0];
      expect(call.to).toBe('membership-automation@sc3.club');
      expect(call.subject).toContain('Bootstrap Validation Error');
      expect(call.body).toContain('test-context');
    });

    test('should not send email when all rows are valid', () => {
      const headers = ValidatedBootstrap.HEADERS;
      const rows = [
        ['ActiveMembers', '', 'Active Members', true],
      ];

      ValidatedBootstrap.validateRows(rows, headers, 'test');

      expect(MailApp.sendEmail).not.toHaveBeenCalled();
    });

    test('should handle empty rows array', () => {
      const headers = ValidatedBootstrap.HEADERS;

      const results = ValidatedBootstrap.validateRows([], headers, 'test');

      expect(results).toEqual([]);
      expect(MailApp.sendEmail).not.toHaveBeenCalled();
    });
  });

  // ========================================================================
  // 4. toArray() Serialization
  // ========================================================================

  describe('toArray() Serialization', () => {

    test('should convert to array matching HEADERS order', () => {
      const entry = new ValidatedBootstrap('ActiveMembers', 'abc123', 'Active Members', true);
      const arr = entry.toArray();

      expect(arr).toEqual(['ActiveMembers', 'abc123', 'Active Members', true]);
    });

    test('should convert entry with empty id to array', () => {
      const entry = new ValidatedBootstrap('Transactions', '', 'Transactions', false);
      const arr = entry.toArray();

      expect(arr).toEqual(['Transactions', '', 'Transactions', false]);
    });

    test('should round-trip through fromRow and toArray', () => {
      const headers = ValidatedBootstrap.HEADERS;
      const originalData = ['ActiveMembers', 'abc123', 'Active Members', true];

      const entry = ValidatedBootstrap.fromRow(originalData, headers, 2);
      const reconstructed = entry.toArray();

      expect(reconstructed).toEqual(originalData);
    });
  });

  // ========================================================================
  // 5. Column-Order Independence (MANDATORY per gas-best-practices.md)
  // ========================================================================

  describe('Column-Order Independence', () => {

    test('should work correctly when sheet columns are in different order than HEADERS', () => {
      // Arrange: Headers in REVERSED order
      const shuffledHeaders = [...ValidatedBootstrap.HEADERS].reverse();
      const testObj = {
        Reference: 'ActiveMembers',
        id: 'abc123',
        sheetName: 'Active Members',
        createIfMissing: true,
      };
      const rowData = shuffledHeaders.map(h => testObj[h]);

      // Act
      const instance = ValidatedBootstrap.fromRow(rowData, shuffledHeaders, 2);

      // Assert
      expect(instance).not.toBeNull();
      expect(instance.Reference).toBe('ActiveMembers');
      expect(instance.id).toBe('abc123');
      expect(instance.sheetName).toBe('Active Members');
      expect(instance.createIfMissing).toBe(true);
    });

    test('should work with arbitrary column order', () => {
      const randomHeaders = ['sheetName', 'createIfMissing', 'Reference', 'id'];
      const testObj = {
        Reference: 'Transactions',
        id: 'xyz789',
        sheetName: 'Transactions',
        createIfMissing: false,
      };
      const rowData = randomHeaders.map(h => testObj[h]);

      const instance = ValidatedBootstrap.fromRow(rowData, randomHeaders, 3);

      expect(instance).not.toBeNull();
      expect(instance.Reference).toBe('Transactions');
      expect(instance.id).toBe('xyz789');
      expect(instance.sheetName).toBe('Transactions');
      expect(instance.createIfMissing).toBe(false);
    });

    test('should work via validateRows with shuffled headers', () => {
      const shuffledHeaders = ['createIfMissing', 'sheetName', 'id', 'Reference'];
      const rows = [
        [true, 'Active Members', 'abc123', 'ActiveMembers'],
        [false, 'Transactions', '', 'Transactions'],
      ];

      const results = ValidatedBootstrap.validateRows(rows, shuffledHeaders, 'test');

      expect(results.length).toBe(2);
      expect(results[0].Reference).toBe('ActiveMembers');
      expect(results[0].sheetName).toBe('Active Members');
      expect(results[1].Reference).toBe('Transactions');
      expect(results[1].id).toBe('');
    });
  });

  // ========================================================================
  // HEADERS constant
  // ========================================================================

  describe('HEADERS constant', () => {

    test('should have correct column names', () => {
      expect(ValidatedBootstrap.HEADERS).toEqual([
        'Reference', 'id', 'sheetName', 'createIfMissing',
      ]);
    });

    test('should have 4 columns', () => {
      expect(ValidatedBootstrap.HEADERS.length).toBe(4);
    });
  });
});
