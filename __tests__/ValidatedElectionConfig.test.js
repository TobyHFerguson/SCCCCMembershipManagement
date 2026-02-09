/**
 * @fileoverview Tests for ValidatedElectionConfig class
 * 
 * Tests the class-based approach to ElectionConfiguration sheet validation.
 * This is a key-value configuration sheet with Key/Setting and Value columns.
 * 
 * TABLE OF CONTENTS:
 * 1. Constructor Validation
 *    - Valid creation with Key + Value
 *    - Valid creation with Setting + Value
 *    - Valid creation with both Key and Setting
 *    - Field trimming
 *    - At least one of Key/Setting required
 *    - Value required
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

// Load the ValidatedElectionConfig class and assign to global
const { ValidatedElectionConfig } = require('../src/services/VotingService/ValidatedElectionConfig.js');
// @ts-ignore - Test setup: add ValidatedElectionConfig to global for testing
global.ValidatedElectionConfig = ValidatedElectionConfig;

describe('ValidatedElectionConfig Class', () => {

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

    test('should create valid entry with Key and Value', () => {
      const entry = new ValidatedElectionConfig('BALLOT_FOLDER_URL', '', 'https://drive.google.com/drive/folders/abc123');

      expect(entry.Key).toBe('BALLOT_FOLDER_URL');
      expect(entry.Setting).toBe('');
      expect(entry.Value).toBe('https://drive.google.com/drive/folders/abc123');
    });

    test('should create valid entry with Setting and Value', () => {
      const entry = new ValidatedElectionConfig('', 'BALLOT_FOLDER_URL', 'https://drive.google.com/drive/folders/abc123');

      expect(entry.Key).toBe('');
      expect(entry.Setting).toBe('BALLOT_FOLDER_URL');
      expect(entry.Value).toBe('https://drive.google.com/drive/folders/abc123');
    });

    test('should create valid entry with both Key and Setting', () => {
      const entry = new ValidatedElectionConfig('MyKey', 'MySetting', 'some-value');

      expect(entry.Key).toBe('MyKey');
      expect(entry.Setting).toBe('MySetting');
      expect(entry.Value).toBe('some-value');
    });

    test('should trim whitespace from all fields', () => {
      const entry = new ValidatedElectionConfig(
        '  BALLOT_FOLDER_URL  ',
        '  setting  ',
        '  https://drive.google.com/drive/folders/abc123  '
      );

      expect(entry.Key).toBe('BALLOT_FOLDER_URL');
      expect(entry.Setting).toBe('setting');
      expect(entry.Value).toBe('https://drive.google.com/drive/folders/abc123');
    });

    test('should accept null Key if Setting is present', () => {
      const entry = new ValidatedElectionConfig(null, 'MySetting', 'value');

      expect(entry.Key).toBe('');
      expect(entry.Setting).toBe('MySetting');
    });

    test('should accept null Setting if Key is present', () => {
      const entry = new ValidatedElectionConfig('MyKey', null, 'value');

      expect(entry.Key).toBe('MyKey');
      expect(entry.Setting).toBe('');
    });

    test('should reject when both Key and Setting are empty', () => {
      expect(() => {
        new ValidatedElectionConfig('', '', 'value');
      }).toThrow('requires at least one of Key or Setting');
    });

    test('should reject when both Key and Setting are null', () => {
      expect(() => {
        new ValidatedElectionConfig(null, null, 'value');
      }).toThrow('requires at least one of Key or Setting');
    });

    test('should reject when both Key and Setting are whitespace-only', () => {
      expect(() => {
        new ValidatedElectionConfig('   ', '   ', 'value');
      }).toThrow('requires at least one of Key or Setting');
    });

    test('should reject empty Value', () => {
      expect(() => {
        new ValidatedElectionConfig('MyKey', '', '');
      }).toThrow('ValidatedElectionConfig Value is required');
    });

    test('should reject null Value', () => {
      expect(() => {
        new ValidatedElectionConfig('MyKey', '', null);
      }).toThrow('ValidatedElectionConfig Value is required');
    });

    test('should reject whitespace-only Value', () => {
      expect(() => {
        new ValidatedElectionConfig('MyKey', '', '   ');
      }).toThrow('ValidatedElectionConfig Value is required');
    });

    test('should reject undefined Value', () => {
      expect(() => {
        new ValidatedElectionConfig('MyKey', '', undefined);
      }).toThrow('ValidatedElectionConfig Value is required');
    });
  });

  // ========================================================================
  // 2. fromRow() Static Factory
  // ========================================================================

  describe('fromRow() Static Factory', () => {

    test('should create instance from row with standard header order', () => {
      const headers = ValidatedElectionConfig.HEADERS;
      const row = ['BALLOT_FOLDER_URL', '', 'https://drive.google.com/drive/folders/abc123'];

      const entry = ValidatedElectionConfig.fromRow(row, headers, 2);

      expect(entry).not.toBeNull();
      expect(entry.Key).toBe('BALLOT_FOLDER_URL');
      expect(entry.Setting).toBe('');
      expect(entry.Value).toBe('https://drive.google.com/drive/folders/abc123');
    });

    test('should create instance with Setting instead of Key', () => {
      const headers = ValidatedElectionConfig.HEADERS;
      const row = ['', 'BALLOT_FOLDER_URL', 'https://drive.google.com/drive/folders/abc123'];

      const entry = ValidatedElectionConfig.fromRow(row, headers, 2);

      expect(entry).not.toBeNull();
      expect(entry.Key).toBe('');
      expect(entry.Setting).toBe('BALLOT_FOLDER_URL');
    });

    test('should return null for row with both Key and Setting empty', () => {
      const headers = ValidatedElectionConfig.HEADERS;
      const row = ['', '', 'some-value'];

      const entry = ValidatedElectionConfig.fromRow(row, headers, 2);

      expect(entry).toBeNull();
    });

    test('should return null for row with empty Value', () => {
      const headers = ValidatedElectionConfig.HEADERS;
      const row = ['MyKey', '', ''];

      const entry = ValidatedElectionConfig.fromRow(row, headers, 2);

      expect(entry).toBeNull();
    });

    test('should collect errors when errorCollector is provided', () => {
      const headers = ValidatedElectionConfig.HEADERS;
      const row = ['', '', ''];
      const errorCollector = { errors: [], rowNumbers: [] };

      const entry = ValidatedElectionConfig.fromRow(row, headers, 4, errorCollector);

      expect(entry).toBeNull();
      expect(errorCollector.errors.length).toBe(1);
      expect(errorCollector.rowNumbers).toContain(4);
      expect(errorCollector.errors[0]).toContain('Row 4');
    });
  });

  // ========================================================================
  // 3. validateRows() Batch Validation
  // ========================================================================

  describe('validateRows() Batch Validation', () => {

    test('should validate multiple valid rows', () => {
      const headers = ValidatedElectionConfig.HEADERS;
      const rows = [
        ['BALLOT_FOLDER_URL', '', 'https://drive.google.com/drive/folders/abc123'],
        ['ADMIN_EMAIL', 'Admin Email', 'admin@sc3.club'],
      ];

      const results = ValidatedElectionConfig.validateRows(rows, headers, 'test');

      expect(results.length).toBe(2);
      expect(results[0].Key).toBe('BALLOT_FOLDER_URL');
      expect(results[1].Key).toBe('ADMIN_EMAIL');
    });

    test('should filter out invalid rows and keep valid ones', () => {
      const headers = ValidatedElectionConfig.HEADERS;
      const rows = [
        ['BALLOT_FOLDER_URL', '', 'https://drive.google.com/drive/folders/abc123'],
        ['', '', 'orphan-value'], // invalid: no Key or Setting
        ['ADMIN_EMAIL', '', 'admin@sc3.club'],
      ];

      const results = ValidatedElectionConfig.validateRows(rows, headers, 'test');

      expect(results.length).toBe(2);
      expect(results[0].Key).toBe('BALLOT_FOLDER_URL');
      expect(results[1].Key).toBe('ADMIN_EMAIL');
    });

    test('should send email alert for invalid rows', () => {
      const headers = ValidatedElectionConfig.HEADERS;
      const rows = [
        ['', '', 'no-key-or-setting'],
      ];

      ValidatedElectionConfig.validateRows(rows, headers, 'test-context');

      expect(MailApp.sendEmail).toHaveBeenCalledTimes(1);
      const call = MailApp.sendEmail.mock.calls[0][0];
      expect(call.to).toBe('membership-automation@sc3.club');
      expect(call.subject).toContain('ElectionConfig Validation Error');
      expect(call.body).toContain('test-context');
    });

    test('should not send email when all rows are valid', () => {
      const headers = ValidatedElectionConfig.HEADERS;
      const rows = [
        ['BALLOT_FOLDER_URL', '', 'https://drive.google.com/drive/folders/abc123'],
      ];

      ValidatedElectionConfig.validateRows(rows, headers, 'test');

      expect(MailApp.sendEmail).not.toHaveBeenCalled();
    });

    test('should handle empty rows array', () => {
      const headers = ValidatedElectionConfig.HEADERS;

      const results = ValidatedElectionConfig.validateRows([], headers, 'test');

      expect(results).toEqual([]);
      expect(MailApp.sendEmail).not.toHaveBeenCalled();
    });
  });

  // ========================================================================
  // 4. toArray() Serialization
  // ========================================================================

  describe('toArray() Serialization', () => {

    test('should convert to array matching HEADERS order', () => {
      const entry = new ValidatedElectionConfig('BALLOT_FOLDER_URL', '', 'https://drive.google.com/drive/folders/abc123');
      const arr = entry.toArray();

      expect(arr).toEqual(['BALLOT_FOLDER_URL', '', 'https://drive.google.com/drive/folders/abc123']);
    });

    test('should round-trip through fromRow and toArray', () => {
      const headers = ValidatedElectionConfig.HEADERS;
      const originalData = ['BALLOT_FOLDER_URL', 'Folder URL', 'https://drive.google.com/drive/folders/abc123'];

      const entry = ValidatedElectionConfig.fromRow(originalData, headers, 2);
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
      const shuffledHeaders = [...ValidatedElectionConfig.HEADERS].reverse();
      const testObj = {
        Key: 'BALLOT_FOLDER_URL',
        Setting: 'Folder URL',
        Value: 'https://drive.google.com/drive/folders/abc123',
      };
      const rowData = shuffledHeaders.map(h => testObj[h]);

      // Act
      const instance = ValidatedElectionConfig.fromRow(rowData, shuffledHeaders, 2);

      // Assert
      expect(instance).not.toBeNull();
      expect(instance.Key).toBe('BALLOT_FOLDER_URL');
      expect(instance.Setting).toBe('Folder URL');
      expect(instance.Value).toBe('https://drive.google.com/drive/folders/abc123');
    });

    test('should work with arbitrary column order', () => {
      const randomHeaders = ['Value', 'Key', 'Setting'];
      const testObj = {
        Key: 'ADMIN_EMAIL',
        Setting: '',
        Value: 'admin@sc3.club',
      };
      const rowData = randomHeaders.map(h => testObj[h]);

      const instance = ValidatedElectionConfig.fromRow(rowData, randomHeaders, 3);

      expect(instance).not.toBeNull();
      expect(instance.Key).toBe('ADMIN_EMAIL');
      expect(instance.Setting).toBe('');
      expect(instance.Value).toBe('admin@sc3.club');
    });

    test('should work via validateRows with shuffled headers', () => {
      const shuffledHeaders = ['Setting', 'Value', 'Key'];
      const rows = [
        ['', 'https://drive.google.com/drive/folders/abc123', 'BALLOT_FOLDER_URL'],
        ['Admin', 'admin@sc3.club', 'ADMIN_EMAIL'],
      ];

      const results = ValidatedElectionConfig.validateRows(rows, shuffledHeaders, 'test');

      expect(results.length).toBe(2);
      expect(results[0].Key).toBe('BALLOT_FOLDER_URL');
      expect(results[0].Value).toBe('https://drive.google.com/drive/folders/abc123');
      expect(results[1].Key).toBe('ADMIN_EMAIL');
      expect(results[1].Value).toBe('admin@sc3.club');
    });
  });

  // ========================================================================
  // HEADERS constant
  // ========================================================================

  describe('HEADERS constant', () => {

    test('should have correct column names', () => {
      expect(ValidatedElectionConfig.HEADERS).toEqual([
        'Key', 'Setting', 'Value',
      ]);
    });

    test('should have 3 columns', () => {
      expect(ValidatedElectionConfig.HEADERS.length).toBe(3);
    });
  });
});
