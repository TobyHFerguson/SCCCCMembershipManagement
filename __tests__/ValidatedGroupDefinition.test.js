/**
 * @fileoverview Tests for ValidatedGroupDefinition class
 * 
 * Tests the class-based approach to GroupDefinition validation and construction.
 * Ensures proper type safety and data quality for the GroupDefinitions sheet.
 * 
 * TABLE OF CONTENTS:
 * 1. Constructor Validation
 *    - Valid creation with all fields
 *    - Field trimming
 *    - Email normalization (bare name gets @sc3.club)
 *    - Email with @ left unchanged
 *    - Name required
 *    - Email required
 *    - Subscription required
 *    - Type required
 *    - Members must be a string
 *    - Optional fields default to empty string
 * 2. fromRow() Static Factory
 *    - Valid row with all headers
 *    - Missing required fields return null with error collected
 *    - Handles extra columns gracefully
 * 3. validateRows() Batch Validation
 *    - Multiple valid rows
 *    - Mixed valid/invalid rows
 *    - Email alert sent on errors
 *    - Empty array returns empty
 * 4. toArray() Serialization
 *    - HEADERS order match
 *    - Round-trip consistency
 * 5. Column-Order Independence (MANDATORY per gas-best-practices.md)
 *    - Shuffled headers produce correct instances
 *    - Arbitrary column ordering
 *    - validateRows with shuffled headers
 */

// Mock GAS environment
jest.mock('../src/common/config/Properties.js', () => ({}));
jest.mock('../src/common/utils/Logger.js', () => ({}));

// Load the ValidatedGroupDefinition class and assign to global
const { ValidatedGroupDefinition } = require('../src/common/data/ValidatedGroupDefinition.js');
// @ts-ignore - Test setup: add ValidatedGroupDefinition to global for testing
global.ValidatedGroupDefinition = ValidatedGroupDefinition;

describe('ValidatedGroupDefinition Class', () => {

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

    test('should create valid group definition with all fields', () => {
      const gd = new ValidatedGroupDefinition(
        'Board Members', 'board@sc3.club', 'board-alias@sc3.club',
        'manual', 'Discussion', 'board-leads, Everyone', 'president@sc3.club', 'Main board group'
      );

      expect(gd.Name).toBe('Board Members');
      expect(gd.Email).toBe('board@sc3.club');
      expect(gd.Aliases).toBe('board-alias@sc3.club');
      expect(gd.Subscription).toBe('manual');
      expect(gd.Type).toBe('Discussion');
      expect(gd.Members).toBe('board-leads, Everyone');
      expect(gd.Managers).toBe('president@sc3.club');
      expect(gd.Note).toBe('Main board group');
    });

    test('should trim whitespace from all fields', () => {
      const gd = new ValidatedGroupDefinition(
        '  Ride Leaders  ', '  ride-leaders@sc3.club  ', '  alias@sc3.club  ',
        '  auto  ', '  Discussion  ', '  Everyone  ', '  manager@sc3.club  ', '  A note  '
      );

      expect(gd.Name).toBe('Ride Leaders');
      expect(gd.Email).toBe('ride-leaders@sc3.club');
      expect(gd.Aliases).toBe('alias@sc3.club');
      expect(gd.Subscription).toBe('auto');
      expect(gd.Type).toBe('Discussion');
      expect(gd.Members).toBe('Everyone');
      expect(gd.Managers).toBe('manager@sc3.club');
      expect(gd.Note).toBe('A note');
    });

    test('should normalize email without @ by appending @sc3.club', () => {
      const gd = new ValidatedGroupDefinition(
        'Board', 'board_announcements', '', 'auto', 'Announcement', 'Everyone', '', ''
      );
      expect(gd.Email).toBe('board_announcements@sc3.club');
    });

    test('should leave email with @ unchanged', () => {
      const gd = new ValidatedGroupDefinition(
        'Board', 'board@otherdomain.com', '', 'auto', 'Announcement', 'Everyone', '', ''
      );
      expect(gd.Email).toBe('board@otherdomain.com');
    });

    test('should leave sc3.club email unchanged', () => {
      const gd = new ValidatedGroupDefinition(
        'Board', 'board@sc3.club', '', 'auto', 'Announcement', 'Everyone', '', ''
      );
      expect(gd.Email).toBe('board@sc3.club');
    });

    test('optional fields default to empty string when null/undefined', () => {
      const gd = new ValidatedGroupDefinition(
        'Security', 'security@sc3.club', null, 'manual', 'Security', '', undefined, undefined
      );
      expect(gd.Aliases).toBe('');
      expect(gd.Managers).toBe('');
      expect(gd.Note).toBe('');
    });

    test('Members can be empty string (Security groups)', () => {
      const gd = new ValidatedGroupDefinition(
        'Security', 'security@sc3.club', '', 'manual', 'Security', '', '', ''
      );
      expect(gd.Members).toBe('');
    });

    test('should reject empty Name', () => {
      expect(() => {
        new ValidatedGroupDefinition('', 'test@sc3.club', '', 'auto', 'Discussion', 'Everyone', '', '');
      }).toThrow('ValidatedGroupDefinition Name is required');
    });

    test('should reject whitespace-only Name', () => {
      expect(() => {
        new ValidatedGroupDefinition('   ', 'test@sc3.club', '', 'auto', 'Discussion', 'Everyone', '', '');
      }).toThrow('ValidatedGroupDefinition Name is required');
    });

    test('should reject null Name', () => {
      expect(() => {
        new ValidatedGroupDefinition(null, 'test@sc3.club', '', 'auto', 'Discussion', 'Everyone', '', '');
      }).toThrow('ValidatedGroupDefinition Name is required');
    });

    test('should reject empty Email', () => {
      expect(() => {
        new ValidatedGroupDefinition('Test', '', '', 'auto', 'Discussion', 'Everyone', '', '');
      }).toThrow('ValidatedGroupDefinition Email is required');
    });

    test('should reject null Email', () => {
      expect(() => {
        new ValidatedGroupDefinition('Test', null, '', 'auto', 'Discussion', 'Everyone', '', '');
      }).toThrow('ValidatedGroupDefinition Email is required');
    });

    test('should reject empty Subscription', () => {
      expect(() => {
        new ValidatedGroupDefinition('Test', 'test@sc3.club', '', '', 'Discussion', 'Everyone', '', '');
      }).toThrow('ValidatedGroupDefinition Subscription is required');
    });

    test('should reject null Subscription', () => {
      expect(() => {
        new ValidatedGroupDefinition('Test', 'test@sc3.club', '', null, 'Discussion', 'Everyone', '', '');
      }).toThrow('ValidatedGroupDefinition Subscription is required');
    });

    test('should reject whitespace-only Subscription', () => {
      expect(() => {
        new ValidatedGroupDefinition('Test', 'test@sc3.club', '', '   ', 'Discussion', 'Everyone', '', '');
      }).toThrow('ValidatedGroupDefinition Subscription is required');
    });

    test('should reject empty Type', () => {
      expect(() => {
        new ValidatedGroupDefinition('Test', 'test@sc3.club', '', 'auto', '', 'Everyone', '', '');
      }).toThrow('ValidatedGroupDefinition Type is required');
    });

    test('should reject null Type', () => {
      expect(() => {
        new ValidatedGroupDefinition('Test', 'test@sc3.club', '', 'auto', null, 'Everyone', '', '');
      }).toThrow('ValidatedGroupDefinition Type is required');
    });

    test('should reject non-string Members', () => {
      expect(() => {
        new ValidatedGroupDefinition('Test', 'test@sc3.club', '', 'auto', 'Discussion', null, '', '');
      }).toThrow('ValidatedGroupDefinition Members must be a string');
    });
  });

  // ========================================================================
  // 2. fromRow() Static Factory
  // ========================================================================

  describe('fromRow() Static Factory', () => {

    test('should create instance from row with standard header order', () => {
      const headers = ValidatedGroupDefinition.HEADERS;
      const row = ['Ride Leaders', 'ride-leaders@sc3.club', '', 'auto', 'Discussion', 'Everyone', '', ''];

      const gd = ValidatedGroupDefinition.fromRow(row, headers, 2);

      expect(gd).not.toBeNull();
      expect(gd.Name).toBe('Ride Leaders');
      expect(gd.Email).toBe('ride-leaders@sc3.club');
      expect(gd.Subscription).toBe('auto');
      expect(gd.Type).toBe('Discussion');
      expect(gd.Members).toBe('Everyone');
    });

    test('should return null for missing Name', () => {
      const headers = ValidatedGroupDefinition.HEADERS;
      const row = ['', 'test@sc3.club', '', 'auto', 'Discussion', 'Everyone', '', ''];

      const gd = ValidatedGroupDefinition.fromRow(row, headers, 2);

      expect(gd).toBeNull();
    });

    test('should return null for missing Email', () => {
      const headers = ValidatedGroupDefinition.HEADERS;
      const row = ['Test Group', '', '', 'auto', 'Discussion', 'Everyone', '', ''];

      const gd = ValidatedGroupDefinition.fromRow(row, headers, 2);

      expect(gd).toBeNull();
    });

    test('should return null for missing Subscription', () => {
      const headers = ValidatedGroupDefinition.HEADERS;
      const row = ['Test Group', 'test@sc3.club', '', '', 'Discussion', 'Everyone', '', ''];

      const gd = ValidatedGroupDefinition.fromRow(row, headers, 2);

      expect(gd).toBeNull();
    });

    test('should return null for missing Type', () => {
      const headers = ValidatedGroupDefinition.HEADERS;
      const row = ['Test Group', 'test@sc3.club', '', 'auto', '', 'Everyone', '', ''];

      const gd = ValidatedGroupDefinition.fromRow(row, headers, 2);

      expect(gd).toBeNull();
    });

    test('should collect errors when errorCollector is provided', () => {
      const headers = ValidatedGroupDefinition.HEADERS;
      const row = ['', '', '', '', '', '', '', ''];
      const errorCollector = { errors: [], rowNumbers: [] };

      const gd = ValidatedGroupDefinition.fromRow(row, headers, 7, errorCollector);

      expect(gd).toBeNull();
      expect(errorCollector.errors.length).toBe(1);
      expect(errorCollector.rowNumbers).toContain(7);
      expect(errorCollector.errors[0]).toContain('Row 7');
    });

    test('should handle extra columns gracefully', () => {
      const headers = [...ValidatedGroupDefinition.HEADERS, 'ExtraColumn'];
      const row = ['Ride Leaders', 'ride-leaders@sc3.club', '', 'auto', 'Discussion', 'Everyone', '', '', 'extra data'];

      const gd = ValidatedGroupDefinition.fromRow(row, headers, 2);

      expect(gd).not.toBeNull();
      expect(gd.Name).toBe('Ride Leaders');
    });
  });

  // ========================================================================
  // 3. validateRows() Batch Validation
  // ========================================================================

  describe('validateRows() Batch Validation', () => {

    test('should validate multiple valid rows', () => {
      const headers = ValidatedGroupDefinition.HEADERS;
      const rows = [
        ['Ride Leaders', 'ride-leaders@sc3.club', '', 'auto', 'Discussion', 'Everyone', '', ''],
        ['Board Members', 'board@sc3.club', '', 'manual', 'Role', 'president, secretary', 'president@sc3.club', ''],
        ['All Members', 'all@sc3.club', '', 'auto', 'Announcement', 'Everyone', '', 'Club-wide list'],
      ];

      const results = ValidatedGroupDefinition.validateRows(rows, headers, 'test');

      expect(results.length).toBe(3);
      expect(results[0].Name).toBe('Ride Leaders');
      expect(results[1].Name).toBe('Board Members');
      expect(results[2].Name).toBe('All Members');
    });

    test('should filter out invalid rows and keep valid ones', () => {
      const headers = ValidatedGroupDefinition.HEADERS;
      const rows = [
        ['Ride Leaders', 'ride-leaders@sc3.club', '', 'auto', 'Discussion', 'Everyone', '', ''],
        ['', 'broken@sc3.club', '', 'auto', 'Discussion', 'Everyone', '', ''], // invalid: no Name
        ['Board Members', 'board@sc3.club', '', 'manual', 'Role', 'president', '', ''],
      ];

      const results = ValidatedGroupDefinition.validateRows(rows, headers, 'test');

      expect(results.length).toBe(2);
      expect(results[0].Name).toBe('Ride Leaders');
      expect(results[1].Name).toBe('Board Members');
    });

    test('should send email alert for invalid rows', () => {
      const headers = ValidatedGroupDefinition.HEADERS;
      const rows = [
        ['', '', '', '', '', '', '', ''],
      ];

      ValidatedGroupDefinition.validateRows(rows, headers, 'test-context');

      expect(MailApp.sendEmail).toHaveBeenCalledTimes(1);
      const call = /** @type {jest.Mock} */ (MailApp.sendEmail).mock.calls[0][0];
      expect(call.to).toBe('membership-automation@sc3.club');
      expect(call.subject).toContain('GroupDefinition Validation Error');
      expect(call.body).toContain('test-context');
    });

    test('should not send email when all rows are valid', () => {
      const headers = ValidatedGroupDefinition.HEADERS;
      const rows = [
        ['Ride Leaders', 'ride-leaders@sc3.club', '', 'auto', 'Discussion', 'Everyone', '', ''],
      ];

      ValidatedGroupDefinition.validateRows(rows, headers, 'test');

      expect(MailApp.sendEmail).not.toHaveBeenCalled();
    });

    test('should handle empty rows array', () => {
      const headers = ValidatedGroupDefinition.HEADERS;

      const results = ValidatedGroupDefinition.validateRows([], headers, 'test');

      expect(results).toEqual([]);
      expect(MailApp.sendEmail).not.toHaveBeenCalled();
    });
  });

  // ========================================================================
  // 4. toArray() Serialization
  // ========================================================================

  describe('toArray() Serialization', () => {

    test('should convert to array matching HEADERS order', () => {
      const gd = new ValidatedGroupDefinition(
        'Ride Leaders', 'ride-leaders@sc3.club', '', 'auto', 'Discussion', 'Everyone', '', ''
      );
      const arr = gd.toArray();

      expect(arr).toEqual(['Ride Leaders', 'ride-leaders@sc3.club', '', 'auto', 'Discussion', 'Everyone', '', '']);
    });

    test('should round-trip through fromRow and toArray', () => {
      const headers = ValidatedGroupDefinition.HEADERS;
      const originalData = ['Ride Leaders', 'ride-leaders@sc3.club', 'alias@sc3.club', 'auto', 'Discussion', 'Everyone', 'mgr@sc3.club', 'A note'];

      const gd = ValidatedGroupDefinition.fromRow(originalData, headers, 2);
      const reconstructed = gd.toArray();

      expect(reconstructed).toEqual(originalData);
    });

    test('toArray() length should match HEADERS length', () => {
      const gd = new ValidatedGroupDefinition(
        'Test', 'test@sc3.club', '', 'auto', 'Discussion', 'Everyone', '', ''
      );
      expect(gd.toArray().length).toBe(ValidatedGroupDefinition.HEADERS.length);
    });
  });

  // ========================================================================
  // 5. Column-Order Independence (MANDATORY per gas-best-practices.md)
  // ========================================================================

  describe('Column-Order Independence', () => {

    test('should work correctly when sheet columns are in different order than HEADERS', () => {
      // Arrange: Headers in REVERSED order
      const shuffledHeaders = [...ValidatedGroupDefinition.HEADERS].reverse();
      const testObj = {
        Name: 'Ride Leaders',
        Email: 'ride-leaders@sc3.club',
        Aliases: '',
        Subscription: 'auto',
        Type: 'Discussion',
        Members: 'Everyone',
        Managers: '',
        Note: '',
      };
      const rowData = shuffledHeaders.map(h => testObj[h]);

      // Act
      const instance = ValidatedGroupDefinition.fromRow(rowData, shuffledHeaders, 2);

      // Assert
      expect(instance).not.toBeNull();
      expect(instance.Name).toBe('Ride Leaders');
      expect(instance.Email).toBe('ride-leaders@sc3.club');
      expect(instance.Subscription).toBe('auto');
      expect(instance.Type).toBe('Discussion');
      expect(instance.Members).toBe('Everyone');
    });

    test('should work with arbitrary column order', () => {
      const randomHeaders = ['Type', 'Members', 'Name', 'Note', 'Email', 'Subscription', 'Managers', 'Aliases'];
      const testObj = {
        Name: 'Board Members',
        Email: 'board@sc3.club',
        Aliases: '',
        Subscription: 'manual',
        Type: 'Role',
        Members: 'president, secretary',
        Managers: 'president@sc3.club',
        Note: 'Leadership',
      };
      const rowData = randomHeaders.map(h => testObj[h]);

      const instance = ValidatedGroupDefinition.fromRow(rowData, randomHeaders, 3);

      expect(instance).not.toBeNull();
      expect(instance.Name).toBe('Board Members');
      expect(instance.Email).toBe('board@sc3.club');
      expect(instance.Subscription).toBe('manual');
      expect(instance.Type).toBe('Role');
      expect(instance.Members).toBe('president, secretary');
      expect(instance.Managers).toBe('president@sc3.club');
      expect(instance.Note).toBe('Leadership');
    });

    test('should work via validateRows with shuffled headers', () => {
      const shuffledHeaders = ['Email', 'Type', 'Subscription', 'Name', 'Members', 'Aliases', 'Note', 'Managers'];
      const rows = [
        ['ride-leaders@sc3.club', 'Discussion', 'auto', 'Ride Leaders', 'Everyone', '', '', ''],
        ['board@sc3.club', 'Role', 'manual', 'Board Members', 'president', '', '', 'president@sc3.club'],
      ];

      const results = ValidatedGroupDefinition.validateRows(rows, shuffledHeaders, 'test');

      expect(results.length).toBe(2);
      expect(results[0].Name).toBe('Ride Leaders');
      expect(results[0].Email).toBe('ride-leaders@sc3.club');
      expect(results[0].Subscription).toBe('auto');
      expect(results[0].Type).toBe('Discussion');
      expect(results[1].Name).toBe('Board Members');
    });
  });

  // ========================================================================
  // HEADERS constant
  // ========================================================================

  describe('HEADERS constant', () => {

    test('should have correct column names', () => {
      expect(ValidatedGroupDefinition.HEADERS).toEqual([
        'Name', 'Email', 'Aliases', 'Subscription', 'Type', 'Members', 'Managers', 'Note',
      ]);
    });

    test('should have 8 columns', () => {
      expect(ValidatedGroupDefinition.HEADERS.length).toBe(8);
    });
  });
});
