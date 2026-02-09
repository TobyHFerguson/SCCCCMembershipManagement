/**
 * @fileoverview Tests for ValidatedPublicGroup class
 * 
 * Tests the class-based approach to PublicGroup validation and construction.
 * Ensures proper type safety and data quality.
 * 
 * TABLE OF CONTENTS:
 * 1. Constructor Validation
 *    - Valid creation with all fields
 *    - Field trimming
 *    - Name required
 *    - Email required
 *    - Subscription required
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

// Load the ValidatedPublicGroup class and assign to global
const { ValidatedPublicGroup } = require('../src/common/data/ValidatedPublicGroup.js');
// @ts-ignore - Test setup: add ValidatedPublicGroup to global for testing
global.ValidatedPublicGroup = ValidatedPublicGroup;

describe('ValidatedPublicGroup Class', () => {

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

    test('should create valid group with all fields', () => {
      const group = new ValidatedPublicGroup('Ride Leaders', 'ride-leaders@sc3.club', 'auto');

      expect(group.Name).toBe('Ride Leaders');
      expect(group.Email).toBe('ride-leaders@sc3.club');
      expect(group.Subscription).toBe('auto');
    });

    test('should create valid group with manual subscription', () => {
      const group = new ValidatedPublicGroup('Board Members', 'board@sc3.club', 'manual');

      expect(group.Name).toBe('Board Members');
      expect(group.Email).toBe('board@sc3.club');
      expect(group.Subscription).toBe('manual');
    });

    test('should trim whitespace from all fields', () => {
      const group = new ValidatedPublicGroup(
        '  Ride Leaders  ',
        '  ride-leaders@sc3.club  ',
        '  auto  '
      );

      expect(group.Name).toBe('Ride Leaders');
      expect(group.Email).toBe('ride-leaders@sc3.club');
      expect(group.Subscription).toBe('auto');
    });

    test('should reject empty Name', () => {
      expect(() => {
        new ValidatedPublicGroup('', 'test@sc3.club', 'auto');
      }).toThrow('ValidatedPublicGroup Name is required');
    });

    test('should reject whitespace-only Name', () => {
      expect(() => {
        new ValidatedPublicGroup('   ', 'test@sc3.club', 'auto');
      }).toThrow('ValidatedPublicGroup Name is required');
    });

    test('should reject null Name', () => {
      expect(() => {
        new ValidatedPublicGroup(null, 'test@sc3.club', 'auto');
      }).toThrow('ValidatedPublicGroup Name is required');
    });

    test('should reject empty Email', () => {
      expect(() => {
        new ValidatedPublicGroup('Test', '', 'auto');
      }).toThrow('ValidatedPublicGroup Email is required');
    });

    test('should reject null Email', () => {
      expect(() => {
        new ValidatedPublicGroup('Test', null, 'auto');
      }).toThrow('ValidatedPublicGroup Email is required');
    });

    test('should reject empty Subscription', () => {
      expect(() => {
        new ValidatedPublicGroup('Test', 'test@sc3.club', '');
      }).toThrow('ValidatedPublicGroup Subscription is required');
    });

    test('should reject null Subscription', () => {
      expect(() => {
        new ValidatedPublicGroup('Test', 'test@sc3.club', null);
      }).toThrow('ValidatedPublicGroup Subscription is required');
    });

    test('should reject whitespace-only Subscription', () => {
      expect(() => {
        new ValidatedPublicGroup('Test', 'test@sc3.club', '   ');
      }).toThrow('ValidatedPublicGroup Subscription is required');
    });
  });

  // ========================================================================
  // 2. fromRow() Static Factory
  // ========================================================================

  describe('fromRow() Static Factory', () => {

    test('should create instance from row with standard header order', () => {
      const headers = ValidatedPublicGroup.HEADERS;
      const row = ['Ride Leaders', 'ride-leaders@sc3.club', 'auto'];

      const group = ValidatedPublicGroup.fromRow(row, headers, 2);

      expect(group).not.toBeNull();
      expect(group.Name).toBe('Ride Leaders');
      expect(group.Email).toBe('ride-leaders@sc3.club');
      expect(group.Subscription).toBe('auto');
    });

    test('should return null for missing Name', () => {
      const headers = ValidatedPublicGroup.HEADERS;
      const row = ['', 'test@sc3.club', 'auto'];

      const group = ValidatedPublicGroup.fromRow(row, headers, 2);

      expect(group).toBeNull();
    });

    test('should return null for missing Email', () => {
      const headers = ValidatedPublicGroup.HEADERS;
      const row = ['Test Group', '', 'auto'];

      const group = ValidatedPublicGroup.fromRow(row, headers, 2);

      expect(group).toBeNull();
    });

    test('should return null for missing Subscription', () => {
      const headers = ValidatedPublicGroup.HEADERS;
      const row = ['Test Group', 'test@sc3.club', ''];

      const group = ValidatedPublicGroup.fromRow(row, headers, 2);

      expect(group).toBeNull();
    });

    test('should collect errors when errorCollector is provided', () => {
      const headers = ValidatedPublicGroup.HEADERS;
      const row = ['', '', ''];
      const errorCollector = { errors: [], rowNumbers: [] };

      const group = ValidatedPublicGroup.fromRow(row, headers, 7, errorCollector);

      expect(group).toBeNull();
      expect(errorCollector.errors.length).toBe(1);
      expect(errorCollector.rowNumbers).toContain(7);
      expect(errorCollector.errors[0]).toContain('Row 7');
    });
  });

  // ========================================================================
  // 3. validateRows() Batch Validation
  // ========================================================================

  describe('validateRows() Batch Validation', () => {

    test('should validate multiple valid rows', () => {
      const headers = ValidatedPublicGroup.HEADERS;
      const rows = [
        ['Ride Leaders', 'ride-leaders@sc3.club', 'auto'],
        ['Board Members', 'board@sc3.club', 'manual'],
        ['All Members', 'all@sc3.club', 'auto'],
      ];

      const results = ValidatedPublicGroup.validateRows(rows, headers, 'test');

      expect(results.length).toBe(3);
      expect(results[0].Name).toBe('Ride Leaders');
      expect(results[1].Name).toBe('Board Members');
      expect(results[2].Name).toBe('All Members');
    });

    test('should filter out invalid rows and keep valid ones', () => {
      const headers = ValidatedPublicGroup.HEADERS;
      const rows = [
        ['Ride Leaders', 'ride-leaders@sc3.club', 'auto'],
        ['', 'broken@sc3.club', 'auto'], // invalid: no Name
        ['Board Members', 'board@sc3.club', 'manual'],
      ];

      const results = ValidatedPublicGroup.validateRows(rows, headers, 'test');

      expect(results.length).toBe(2);
      expect(results[0].Name).toBe('Ride Leaders');
      expect(results[1].Name).toBe('Board Members');
    });

    test('should send email alert for invalid rows', () => {
      const headers = ValidatedPublicGroup.HEADERS;
      const rows = [
        ['', '', ''],
      ];

      ValidatedPublicGroup.validateRows(rows, headers, 'test-context');

      expect(MailApp.sendEmail).toHaveBeenCalledTimes(1);
      const call = /** @type {jest.Mock} */ (MailApp.sendEmail).mock.calls[0][0];
      expect(call.to).toBe('membership-automation@sc3.club');
      expect(call.subject).toContain('PublicGroup Validation Error');
      expect(call.body).toContain('test-context');
    });

    test('should not send email when all rows are valid', () => {
      const headers = ValidatedPublicGroup.HEADERS;
      const rows = [
        ['Ride Leaders', 'ride-leaders@sc3.club', 'auto'],
      ];

      ValidatedPublicGroup.validateRows(rows, headers, 'test');

      expect(MailApp.sendEmail).not.toHaveBeenCalled();
    });

    test('should handle empty rows array', () => {
      const headers = ValidatedPublicGroup.HEADERS;

      const results = ValidatedPublicGroup.validateRows([], headers, 'test');

      expect(results).toEqual([]);
      expect(MailApp.sendEmail).not.toHaveBeenCalled();
    });
  });

  // ========================================================================
  // 4. toArray() Serialization
  // ========================================================================

  describe('toArray() Serialization', () => {

    test('should convert to array matching HEADERS order', () => {
      const group = new ValidatedPublicGroup('Ride Leaders', 'ride-leaders@sc3.club', 'auto');
      const arr = group.toArray();

      expect(arr).toEqual(['Ride Leaders', 'ride-leaders@sc3.club', 'auto']);
    });

    test('should round-trip through fromRow and toArray', () => {
      const headers = ValidatedPublicGroup.HEADERS;
      const originalData = ['Ride Leaders', 'ride-leaders@sc3.club', 'auto'];

      const group = ValidatedPublicGroup.fromRow(originalData, headers, 2);
      const reconstructed = group.toArray();

      expect(reconstructed).toEqual(originalData);
    });
  });

  // ========================================================================
  // 5. Column-Order Independence (MANDATORY per gas-best-practices.md)
  // ========================================================================

  describe('Column-Order Independence', () => {

    test('should work correctly when sheet columns are in different order than HEADERS', () => {
      // Arrange: Headers in REVERSED order
      const shuffledHeaders = [...ValidatedPublicGroup.HEADERS].reverse();
      const testObj = {
        Name: 'Ride Leaders',
        Email: 'ride-leaders@sc3.club',
        Subscription: 'auto',
      };
      const rowData = shuffledHeaders.map(h => testObj[h]);

      // Act
      const instance = ValidatedPublicGroup.fromRow(rowData, shuffledHeaders, 2);

      // Assert
      expect(instance).not.toBeNull();
      expect(instance.Name).toBe('Ride Leaders');
      expect(instance.Email).toBe('ride-leaders@sc3.club');
      expect(instance.Subscription).toBe('auto');
    });

    test('should work with arbitrary column order', () => {
      const randomHeaders = ['Subscription', 'Name', 'Email'];
      const testObj = {
        Name: 'Board Members',
        Email: 'board@sc3.club',
        Subscription: 'manual',
      };
      const rowData = randomHeaders.map(h => testObj[h]);

      const instance = ValidatedPublicGroup.fromRow(rowData, randomHeaders, 3);

      expect(instance).not.toBeNull();
      expect(instance.Name).toBe('Board Members');
      expect(instance.Email).toBe('board@sc3.club');
      expect(instance.Subscription).toBe('manual');
    });

    test('should work via validateRows with shuffled headers', () => {
      const shuffledHeaders = ['Email', 'Subscription', 'Name'];
      const rows = [
        ['ride-leaders@sc3.club', 'auto', 'Ride Leaders'],
        ['board@sc3.club', 'manual', 'Board Members'],
      ];

      const results = ValidatedPublicGroup.validateRows(rows, shuffledHeaders, 'test');

      expect(results.length).toBe(2);
      expect(results[0].Name).toBe('Ride Leaders');
      expect(results[0].Email).toBe('ride-leaders@sc3.club');
      expect(results[0].Subscription).toBe('auto');
      expect(results[1].Name).toBe('Board Members');
    });
  });

  // ========================================================================
  // HEADERS constant
  // ========================================================================

  describe('HEADERS constant', () => {

    test('should have correct column names', () => {
      expect(ValidatedPublicGroup.HEADERS).toEqual([
        'Name', 'Email', 'Subscription',
      ]);
    });

    test('should have 3 columns', () => {
      expect(ValidatedPublicGroup.HEADERS.length).toBe(3);
    });
  });
});
