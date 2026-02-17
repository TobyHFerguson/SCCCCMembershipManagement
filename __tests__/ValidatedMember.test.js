/**
 * @fileoverview Tests for ValidatedMember class
 * 
 * Tests the class-based approach to member validation and construction.
 * Ensures proper type safety and data quality.
 */

// Mock GAS environment
jest.mock('../src/common/config/Properties.js', () => ({}));
jest.mock('../src/common/utils/Logger.js', () => ({}));

// Load the ValidatedMember class and assign to global
const { ValidatedMember } = require('../src/common/data/ValidatedMember.js');
global.ValidatedMember = ValidatedMember;

describe('ValidatedMember Class', () => {
  
  describe('Constructor Validation', () => {
    
    test('should create valid member with all fields', () => {
      const joined = new Date('2023-01-15');
      const expires = new Date('2024-01-15');
      const renewedOn = new Date('2023-12-01');
      
      const member = new ValidatedMember(
        'test@example.com',
        'Active',
        'John',
        'Doe',
        '555-1234',
        joined,
        expires,
        12, null,
        true,
        false,
        true,
        renewedOn
      );
      
      expect(member.Email).toBe('test@example.com');
      expect(member.Status).toBe('Active');
      expect(member.First).toBe('John');
      expect(member.Last).toBe('Doe');
      expect(member.Phone).toBe('555-1234');
      expect(member.Joined).toBe(joined);
      expect(member.Expires).toBe(expires);
      expect(member.Period).toBe(12);
      expect(member['Directory Share Name']).toBe(true);
      expect(member['Directory Share Email']).toBe(false);
      expect(member['Directory Share Phone']).toBe(true);
      expect(member['Renewed On']).toBe(renewedOn);
    });
    
    test('should create valid member with minimal required fields', () => {
      const joined = new Date('2023-01-15');
      const expires = new Date('2024-01-15');
      
      const member = new ValidatedMember(
        'minimal@example.com',
        'Active',
        'Jane',
        'Smith',
        '',
        joined,
        expires,
        null, null,
        false,
        false,
        false,
        null
      );
      
      expect(member.Email).toBe('minimal@example.com');
      expect(member.Status).toBe('Active');
      expect(member.First).toBe('Jane');
      expect(member.Last).toBe('Smith');
      expect(member.Phone).toBe('');
      expect(member.Period).toBe(null);
      expect(member['Directory Share Name']).toBe(false);
      expect(member['Renewed On']).toBe(null);
    });
    
    test('should normalize email to lowercase', () => {
      const member = new ValidatedMember(
        'Test@EXAMPLE.COM',
        'Active',
        'John',
        'Doe',
        '',
        new Date('2023-01-15'),
        new Date('2024-01-15'),
        null, null,
        false,
        false,
        false,
        null
      );
      
      expect(member.Email).toBe('test@example.com');
    });
    
    test('should handle Date object in Period by setting to null (cell formatting corruption)', () => {
      // When a cell is formatted as Date in Google Sheets, getValues() returns a Date
      // object even if the underlying value was an integer. This can happen when the 
      // previous column-order bug wrote a Date (Expires) into the Period column.
      // Number(Date) would produce milliseconds-since-epoch (a huge number), so we
      // must detect Date and set Period to null instead.
      const corruptedPeriod = new Date('1899-12-31'); // Serial number 1 as Date
      
      const member = new ValidatedMember(
        'test@example.com',
        'Active',
        'John',
        'Doe',
        '555-1234',
        new Date('2023-01-15'),
        new Date('2024-01-15'),
        corruptedPeriod, // Date instead of integer
        null,
        true,
        false,
        true,
        null
      );
      
      // Should be null, NOT Number(Date) which would be -2209161600000
      expect(member.Period).toBe(null);
      expect(member.Period).not.toBe(corruptedPeriod.getTime());
    });
    
    test('should handle recent Date object in Period (post-epoch date corruption)', () => {
      // A recent Date (e.g., member's Expires written to Period column) would produce
      // a positive milliseconds value if we used Number(). Must still be null.
      const corruptedPeriod = new Date('2025-01-15');
      
      const member = new ValidatedMember(
        'test@example.com',
        'Active',
        'John',
        'Doe',
        '',
        new Date('2023-01-15'),
        new Date('2024-01-15'),
        corruptedPeriod,
        null,
        false, false, false, null
      );
      
      expect(member.Period).toBe(null);
    });

    test('should trim whitespace from string fields', () => {
      const member = new ValidatedMember(
        '  test@example.com  ',
        '  Active  ',
        '  John  ',
        '  Doe  ',
        '  555-1234  ',
        new Date('2023-01-15'),
        new Date('2024-01-15'),
        null, null,
        false,
        false,
        false,
        null
      );
      
      expect(member.Email).toBe('test@example.com');
      expect(member.Status).toBe('Active');
      expect(member.First).toBe('John');
      expect(member.Last).toBe('Doe');
      expect(member.Phone).toBe('555-1234');
    });
    
    test('should coerce Directory Share Name to boolean', () => {
      const member1 = new ValidatedMember(
        'test@example.com', 'Active', 'John', 'Doe', '',
        new Date('2023-01-15'), new Date('2024-01-15'),
        null, null, 'yes', false, false, null
      );
      expect(member1['Directory Share Name']).toBe(true);
      
      const member2 = new ValidatedMember(
        'test@example.com', 'Active', 'John', 'Doe', '',
        new Date('2023-01-15'), new Date('2024-01-15'),
        null, null, 0, false, false, null
      );
      expect(member2['Directory Share Name']).toBe(false);
      
      const member3 = new ValidatedMember(
        'test@example.com', 'Active', 'John', 'Doe', '',
        new Date('2023-01-15'), new Date('2024-01-15'),
        null, null, 1, false, false, null
      );
      expect(member3['Directory Share Name']).toBe(true);
    });
    
    test('should coerce Directory Share Email to boolean', () => {
      const member1 = new ValidatedMember(
        'test@example.com', 'Active', 'John', 'Doe', '',
        new Date('2023-01-15'), new Date('2024-01-15'),
        null, null, false, 'true', false, null
      );
      expect(member1['Directory Share Email']).toBe(true);
      
      const member2 = new ValidatedMember(
        'test@example.com', 'Active', 'John', 'Doe', '',
        new Date('2023-01-15'), new Date('2024-01-15'),
        null, null, false, '', false, null
      );
      expect(member2['Directory Share Email']).toBe(false);
    });
    
    test('should coerce Directory Share Phone to boolean', () => {
      const member1 = new ValidatedMember(
        'test@example.com', 'Active', 'John', 'Doe', '',
        new Date('2023-01-15'), new Date('2024-01-15'),
        null, null, false, false, 'yes', null
      );
      expect(member1['Directory Share Phone']).toBe(true);
      
      const member2 = new ValidatedMember(
        'test@example.com', 'Active', 'John', 'Doe', '',
        new Date('2023-01-15'), new Date('2024-01-15'),
        null, null, false, false, null, null
      );
      expect(member2['Directory Share Phone']).toBe(false);
    });
    
    test('should throw error for missing email', () => {
      expect(() => new ValidatedMember(
        null, 'Active', 'John', 'Doe', '',
        new Date('2023-01-15'), new Date('2024-01-15'),
        null, null, false, false, false, null
      )).toThrow('email is required');
      
      expect(() => new ValidatedMember(
        '', 'Active', 'John', 'Doe', '',
        new Date('2023-01-15'), new Date('2024-01-15'),
        null, null, false, false, false, null
      )).toThrow('email is required');
      
      expect(() => new ValidatedMember(
        '   ', 'Active', 'John', 'Doe', '',
        new Date('2023-01-15'), new Date('2024-01-15'),
        null, null, false, false, false, null
      )).toThrow('email is required');
    });
    
    test('should throw error for invalid email format', () => {
      expect(() => new ValidatedMember(
        'not-an-email', 'Active', 'John', 'Doe', '',
        new Date('2023-01-15'), new Date('2024-01-15'),
        null, null, false, false, false, null
      )).toThrow('email must be valid format');
      
      expect(() => new ValidatedMember(
        'missing-at-sign.com', 'Active', 'John', 'Doe', '',
        new Date('2023-01-15'), new Date('2024-01-15'),
        null, null, false, false, false, null
      )).toThrow('email must be valid format');
      
      expect(() => new ValidatedMember(
        '@no-local-part.com', 'Active', 'John', 'Doe', '',
        new Date('2023-01-15'), new Date('2024-01-15'),
        null, null, false, false, false, null
      )).toThrow('email must be valid format');
    });
    
    test('should throw error for missing status', () => {
      expect(() => new ValidatedMember(
        'test@example.com', null, 'John', 'Doe', '',
        new Date('2023-01-15'), new Date('2024-01-15'),
        null, null, false, false, false, null
      )).toThrow('status is required');
      
      expect(() => new ValidatedMember(
        'test@example.com', '', 'John', 'Doe', '',
        new Date('2023-01-15'), new Date('2024-01-15'),
        null, null, false, false, false, null
      )).toThrow('status is required');
    });
    
    test('should throw error for missing first name', () => {
      expect(() => new ValidatedMember(
        'test@example.com', 'Active', null, 'Doe', '',
        new Date('2023-01-15'), new Date('2024-01-15'),
        null, null, false, false, false, null
      )).toThrow('first name is required');
      
      expect(() => new ValidatedMember(
        'test@example.com', 'Active', '', 'Doe', '',
        new Date('2023-01-15'), new Date('2024-01-15'),
        null, null, false, false, false, null
      )).toThrow('first name is required');
    });
    
    test('should throw error for missing last name', () => {
      expect(() => new ValidatedMember(
        'test@example.com', 'Active', 'John', null, '',
        new Date('2023-01-15'), new Date('2024-01-15'),
        null, null, false, false, false, null
      )).toThrow('last name is required');
      
      expect(() => new ValidatedMember(
        'test@example.com', 'Active', 'John', '', '',
        new Date('2023-01-15'), new Date('2024-01-15'),
        null, null, false, false, false, null
      )).toThrow('last name is required');
    });
    
    test('should throw error for invalid joined date', () => {
      expect(() => new ValidatedMember(
        'test@example.com', 'Active', 'John', 'Doe', '',
        'not-a-date', new Date('2024-01-15'),
        null, null, false, false, false, null
      )).toThrow('joined date must be valid Date');
      
      expect(() => new ValidatedMember(
        'test@example.com', 'Active', 'John', 'Doe', '',
        new Date('invalid'), new Date('2024-01-15'),
        null, null, false, false, false, null
      )).toThrow('joined date must be valid Date');
      
      expect(() => new ValidatedMember(
        'test@example.com', 'Active', 'John', 'Doe', '',
        null, new Date('2024-01-15'),
        null, null, false, false, false, null
      )).toThrow('joined date must be valid Date');
    });
    
    test('should throw error for invalid expires date', () => {
      expect(() => new ValidatedMember(
        'test@example.com', 'Active', 'John', 'Doe', '',
        new Date('2023-01-15'), 'not-a-date',
        null, null, false, false, false, null
      )).toThrow('expires date must be valid Date');
      
      expect(() => new ValidatedMember(
        'test@example.com', 'Active', 'John', 'Doe', '',
        new Date('2023-01-15'), new Date('invalid'),
        null, null, false, false, false, null
      )).toThrow('expires date must be valid Date');
      
      expect(() => new ValidatedMember(
        'test@example.com', 'Active', 'John', 'Doe', '',
        new Date('2023-01-15'), null,
        null, null, false, false, false, null
      )).toThrow('expires date must be valid Date');
    });
    
    test('should throw error when expires date is before joined date', () => {
      const joined = new Date('2024-01-15');
      const expires = new Date('2023-01-15'); // Earlier than joined
      
      expect(() => new ValidatedMember(
        'test@example.com', 'Active', 'John', 'Doe', '',
        joined, expires,
        null, null, false, false, false, null
      )).toThrow('expires date must be >= joined date');
    });
    
    test('should accept expires date equal to joined date', () => {
      const sameDate = new Date('2023-01-15');
      
      const member = new ValidatedMember(
        'test@example.com', 'Active', 'John', 'Doe', '',
        sameDate, sameDate,
        null, null, false, false, false, null
      );
      
      expect(member.Joined).toBe(sameDate);
      expect(member.Expires).toBe(sameDate);
    });
    
    test('should throw error for invalid renewed date if provided', () => {
      expect(() => new ValidatedMember(
        'test@example.com', 'Active', 'John', 'Doe', '',
        new Date('2023-01-15'), new Date('2024-01-15'),
        null, null, false, false, false, 'not-a-date'
      )).toThrow('renewed date must be valid Date if provided');
      
      expect(() => new ValidatedMember(
        'test@example.com', 'Active', 'John', 'Doe', '',
        new Date('2023-01-15'), new Date('2024-01-15'),
        null, null, false, false, false, new Date('invalid')
      )).toThrow('renewed date must be valid Date if provided');
    });
    
    test('should accept null/empty renewed date', () => {
      const member1 = new ValidatedMember(
        'test@example.com', 'Active', 'John', 'Doe', '',
        new Date('2023-01-15'), new Date('2024-01-15'),
        null, null, false, false, false, null
      );
      expect(member1['Renewed On']).toBe(null);
      
      const member2 = new ValidatedMember(
        'test@example.com', 'Active', 'John', 'Doe', '',
        new Date('2023-01-15'), new Date('2024-01-15'),
        null, null, false, false, false, undefined
      );
      expect(member2['Renewed On']).toBe(null);
      
      const member3 = new ValidatedMember(
        'test@example.com', 'Active', 'John', 'Doe', '',
        new Date('2023-01-15'), new Date('2024-01-15'),
        null, null, false, false, false, ''
      );
      expect(member3['Renewed On']).toBe(null);
    });
    
    test('should accept memberId string and store as Member ID', () => {
      const member = new ValidatedMember(
        'test@example.com', 'Active', 'John', 'Doe', '',
        new Date('2023-01-15'), new Date('2024-01-15'),
        null, null, false, false, false, null, 'SC3-A7K3M'
      );
      
      expect(member['Member ID']).toBe('SC3-A7K3M');
    });
    
    test('should accept null memberId and store null', () => {
      const member = new ValidatedMember(
        'test@example.com', 'Active', 'John', 'Doe', '',
        new Date('2023-01-15'), new Date('2024-01-15'),
        null, null, false, false, false, null, null
      );
      
      expect(member['Member ID']).toBe(null);
    });
    
    test('should accept undefined/omitted memberId and store null (backward compat)', () => {
      const member1 = new ValidatedMember(
        'test@example.com', 'Active', 'John', 'Doe', '',
        new Date('2023-01-15'), new Date('2024-01-15'),
        null, null, false, false, false, null, undefined
      );
      expect(member1['Member ID']).toBe(null);
      
      // Omitted parameter (relies on default)
      const member2 = new ValidatedMember(
        'test@example.com', 'Active', 'John', 'Doe', '',
        new Date('2023-01-15'), new Date('2024-01-15'),
        null, null, false, false, false, null
      );
      expect(member2['Member ID']).toBe(null);
    });
    
    test('should convert empty string memberId to null', () => {
      const member = new ValidatedMember(
        'test@example.com', 'Active', 'John', 'Doe', '',
        new Date('2023-01-15'), new Date('2024-01-15'),
        null, null, false, false, false, null, ''
      );
      
      expect(member['Member ID']).toBe(null);
    });
    
    test('should convert whitespace-only memberId to null', () => {
      const member = new ValidatedMember(
        'test@example.com', 'Active', 'John', 'Doe', '',
        new Date('2023-01-15'), new Date('2024-01-15'),
        null, null, false, false, false, null, '   '
      );
      
      expect(member['Member ID']).toBe(null);
    });
    
    test('should trim whitespace from memberId', () => {
      const member = new ValidatedMember(
        'test@example.com', 'Active', 'John', 'Doe', '',
        new Date('2023-01-15'), new Date('2024-01-15'),
        null, null, false, false, false, null, '  SC3-A7K3M  '
      );
      
      expect(member['Member ID']).toBe('SC3-A7K3M');
    });
    
  });
  
  describe('fromRow() Static Factory', () => {
    
    const headers = [
      'Status', 'Email', 'First', 'Last', 'Phone',
      'Joined', 'Expires', 'Period', 'Migrated',
      'Directory Share Name', 'Directory Share Email', 'Directory Share Phone',
      'Renewed On', 'Member ID'
    ];
    
    beforeEach(() => {
      // Mock AppLogger (flat class pattern)
      global.AppLogger = /** @type {any} */ ({
        error: jest.fn(),
        warn: jest.fn(),
        info: jest.fn(),
        debug: jest.fn()
      });

    // Mock GAS built-in Logger
    global.Logger = /** @type {any} */ ({
      log: jest.fn(),
      clear: jest.fn(),
      getLog: jest.fn(() => '')
    });
      
      // Mock Common.Logger (backward compat)
      global.Common = global.Common || {};
      global.Common.Logger = global.AppLogger;
    });
    
    test('should create ValidatedMember from valid row', () => {
      const row = [
        'Active',
        'test@example.com',
        'John',
        'Doe',
        '555-1234',
        new Date('2023-01-15'),
        new Date('2024-01-15'),
        12,
        null,
        true,
        false,
        true,
        new Date('2023-12-01'),
        'SC3-A7K3M'
      ];
      
      const member = ValidatedMember.fromRow(row, headers, 2, null);
      
      expect(member).not.toBeNull();
      expect(member.Email).toBe('test@example.com');
      expect(member.Status).toBe('Active');
      expect(member.First).toBe('John');
      expect(member.Last).toBe('Doe');
      expect(member['Member ID']).toBe('SC3-A7K3M');
    });
    
    test('should return null for row with missing required field', () => {
      const row = [
        'Active',
        '', // Missing email
        'John',
        'Doe',
        '555-1234',
        new Date('2023-01-15'),
        new Date('2024-01-15'),
        12,
        null,
        true,
        false,
        true,
        null,
        null
      ];
      
      const member = ValidatedMember.fromRow(row, headers, 2, null);
      
      expect(member).toBeNull();
      expect(Common.Logger.error).toHaveBeenCalledWith(
        'ValidatedMember',
        expect.stringContaining('Row 2:')
      );
    });
    
    test('should populate errorCollector on validation failure', () => {
      const row = [
        'Active',
        'not-an-email', // Invalid email format
        'John',
        'Doe',
        '555-1234',
        new Date('2023-01-15'),
        new Date('2024-01-15'),
        12,
        null,
        true,
        false,
        true,
        null,
        null
      ];
      
      const errorCollector = { errors: [], rowNumbers: [] };
      const member = ValidatedMember.fromRow(row, headers, 5, errorCollector);
      
      expect(member).toBeNull();
      expect(errorCollector.errors.length).toBe(1);
      expect(errorCollector.errors[0]).toContain('Row 5:');
      expect(errorCollector.errors[0]).toContain('email must be valid format');
      expect(errorCollector.rowNumbers).toContain(5);
    });
    
    test('should handle missing optional fields gracefully', () => {
      const row = [
        'Active',
        'test@example.com',
        'John',
        'Doe',
        '', // Empty phone
        new Date('2023-01-15'),
        new Date('2024-01-15'),
        null, // No period
        null, // No migrated
        false,
        false,
        false,
        null, // No renewed date
        null  // No member ID
      ];
      
      const member = ValidatedMember.fromRow(row, headers, 2, null);
      
      expect(member).not.toBeNull();
      expect(member.Phone).toBe('');
      expect(member.Period).toBe(null);
      expect(member['Renewed On']).toBe(null);
      expect(member['Member ID']).toBe(null);
    });
    
    test('should handle Date object in Period column (cell formatting corruption)', () => {
      // When the Period column has Date formatting in Google Sheets,
      // getValues() returns a Date object. fromRow should handle this gracefully.
      const row = [
        'Active',
        'test@example.com',
        'John',
        'Doe',
        '555-1234',
        new Date('2023-01-15'),
        new Date('2024-01-15'),
        new Date('1899-12-31'), // Period as Date (serial number 1 corrupted by cell format)
        null,   // Migrated
        true,   // Directory Share Name
        false,  // Directory Share Email
        true,   // Directory Share Phone
        null,   // Renewed On
        null    // Member ID
      ];
      
      const member = ValidatedMember.fromRow(row, headers, 2, null);
      
      expect(member).not.toBeNull();
      // Period should be null, NOT a huge number from Number(Date)
      expect(member.Period).toBe(null);
    });
    
    test('should handle fromRow without Member ID column (backward compat)', () => {
      // Old headers without Member ID
      const oldHeaders = [
        'Status', 'Email', 'First', 'Last', 'Phone',
        'Joined', 'Expires', 'Period', 'Migrated',
        'Directory Share Name', 'Directory Share Email', 'Directory Share Phone',
        'Renewed On'
      ];
      
      const row = [
        'Active',
        'test@example.com',
        'John',
        'Doe',
        '555-1234',
        new Date('2023-01-15'),
        new Date('2024-01-15'),
        12,
        null,
        true,
        false,
        true,
        new Date('2023-12-01')
      ];
      
      const member = ValidatedMember.fromRow(row, oldHeaders, 2, null);
      
      expect(member).not.toBeNull();
      expect(member.Email).toBe('test@example.com');
      expect(member['Member ID']).toBe(null); // Should be null when not in headers
    });
    
  });
  
  describe('validateRows() Batch Validation', () => {
    
    const headers = [
      'Status', 'Email', 'First', 'Last', 'Phone',
      'Joined', 'Expires', 'Period', 'Migrated',
      'Directory Share Name', 'Directory Share Email', 'Directory Share Phone',
      'Renewed On', 'Member ID'
    ];
    
    beforeEach(() => {
      // Mock Logger (flat class pattern)
      global.AppLogger = /** @type {any} */ ({
        error: jest.fn(),
        warn: jest.fn(),
        info: jest.fn(),
        debug: jest.fn()
      });

    // Mock GAS built-in Logger
    global.Logger = /** @type {any} */ ({
      log: jest.fn(),
      clear: jest.fn(),
      getLog: jest.fn(() => '')
    });
      
      // Mock Common.Logger (backward compat)
      global.Common = global.Common || {};
      global.Common.Logger = global.AppLogger;
      
      // Mock MailApp
      global.MailApp = /** @type {any} */ ({
        sendEmail: jest.fn()
      });
    });
    
    test('should process all valid rows', () => {
      const rows = [
        ['Active', 'test1@example.com', 'John', 'Doe', '555-1111', new Date('2023-01-15'), new Date('2024-01-15'), 12, null, true, false, true, null, 'SC3-A1B2C'],
        ['Active', 'test2@example.com', 'Jane', 'Smith', '555-2222', new Date('2023-02-20'), new Date('2024-02-20'), 12, null, false, true, false, null, 'SC3-D3E4F'],
        ['Expired', 'test3@example.com', 'Bob', 'Jones', '', new Date('2022-01-10'), new Date('2023-01-10'), 12, null, true, true, true, null, null]
      ];
      
      const members = ValidatedMember.validateRows(rows, headers, 'test-context');
      
      expect(members.length).toBe(3);
      expect(members[0].Email).toBe('test1@example.com');
      expect(members[1].Email).toBe('test2@example.com');
      expect(members[2].Email).toBe('test3@example.com');
      expect(MailApp.sendEmail).not.toHaveBeenCalled();
    });
    
    test('should skip invalid rows and continue processing', () => {
      const rows = [
        ['Active', 'test1@example.com', 'John', 'Doe', '555-1111', new Date('2023-01-15'), new Date('2024-01-15'), 12, null, true, false, true, null, null],
        ['Active', 'not-an-email', 'Jane', 'Smith', '555-2222', new Date('2023-02-20'), new Date('2024-02-20'), 12, null, false, true, false, null, null], // Invalid
        ['Active', 'test3@example.com', 'Bob', 'Jones', '', new Date('2022-01-10'), new Date('2023-01-10'), 12, null, true, true, true, null, null]
      ];
      
      const members = ValidatedMember.validateRows(rows, headers, 'test-context');
      
      expect(members.length).toBe(2);
      expect(members[0].Email).toBe('test1@example.com');
      expect(members[1].Email).toBe('test3@example.com');
    });
    
    test('should send consolidated email on validation errors', () => {
      const rows = [
        ['Active', 'test1@example.com', 'John', 'Doe', '555-1111', new Date('2023-01-15'), new Date('2024-01-15'), 12, null, true, false, true, null, null],
        ['Active', 'not-an-email', 'Jane', 'Smith', '555-2222', new Date('2023-02-20'), new Date('2024-02-20'), 12, null, false, true, false, null, null], // Invalid email
        ['Active', 'test3@example.com', '', 'Jones', '', new Date('2022-01-10'), new Date('2023-01-10'), 12, null, true, true, true, null, null] // Missing first name
      ];
      
      const members = ValidatedMember.validateRows(rows, headers, 'test-batch-context');
      
      expect(members.length).toBe(1);
      expect(MailApp.sendEmail).toHaveBeenCalledTimes(1);
      
      const emailCall = (/** @type {any} */ (MailApp.sendEmail)).mock.calls[0][0];
      expect(emailCall.to).toBe('membership-automation@sc3.club');
      expect(emailCall.subject).toContain('2 Member Validation Errors');
      expect(emailCall.body).toContain('test-batch-context');
      expect(emailCall.body).toContain('Total rows processed: 3');
      expect(emailCall.body).toContain('Rows skipped due to errors: 2');
      expect(emailCall.body).toContain('Row 3:'); // Row 2 is first error (row index 1 + 2)
      expect(emailCall.body).toContain('Row 4:'); // Row 3 is second error
    });
    
    test('should not send email when all rows are valid', () => {
      const rows = [
        ['Active', 'test1@example.com', 'John', 'Doe', '555-1111', new Date('2023-01-15'), new Date('2024-01-15'), 12, null, true, false, true, null, null]
      ];
      
      const members = ValidatedMember.validateRows(rows, headers, 'test-context');
      
      expect(members.length).toBe(1);
      expect(MailApp.sendEmail).not.toHaveBeenCalled();
    });
    
    test('should handle empty rows array', () => {
      const members = ValidatedMember.validateRows([], headers, 'test-context');
      
      expect(members.length).toBe(0);
      expect(MailApp.sendEmail).not.toHaveBeenCalled();
    });
    
    test('should log warning when sending email', () => {
      const rows = [
        ['Active', 'invalid', 'John', 'Doe', '', new Date('2023-01-15'), new Date('2024-01-15'), 12, null, false, false, false, null, null]
      ];
      
      ValidatedMember.validateRows(rows, headers, 'test-email-context');
      
      expect(Common.Logger.warn).toHaveBeenCalledWith(
        'ValidatedMember',
        expect.stringContaining('Sent validation error alert email')
      );
    });
    
    test('should handle email send failure gracefully', () => {
      (/** @type {any} */ (MailApp.sendEmail)).mockImplementation(() => {
        throw new Error('Email service unavailable');
      });
      
      const rows = [
        ['Active', 'invalid', 'John', 'Doe', '', new Date('2023-01-15'), new Date('2024-01-15'), 12, null, false, false, false, null, null]
      ];
      
      const members = ValidatedMember.validateRows(rows, headers, 'test-context');
      
      expect(members.length).toBe(0);
      expect(Common.Logger.error).toHaveBeenCalledWith(
        'ValidatedMember',
        expect.stringContaining('Failed to send validation error alert')
      );
    });
    
  });
  
  describe('toArray() Method', () => {
    
    test('should convert member to array in correct column order', () => {
      const joined = new Date('2023-01-15');
      const expires = new Date('2024-01-15');
      const renewedOn = new Date('2023-12-01');
      
      const member = new ValidatedMember(
        'test@example.com',
        'Active',
        'John',
        'Doe',
        '555-1234',
        joined,
        expires,
        12,
        null,
        true,
        false,
        true,
        renewedOn,
        'SC3-A7K3M'
      );
      
      const array = member.toArray();
      
      expect(array).toEqual([
        'Active',
        'test@example.com',
        'John',
        'Doe',
        '555-1234',
        joined,
        expires,
        12,
        null,
        true,
        false,
        true,
        renewedOn,
        'SC3-A7K3M'
      ]);
      expect(array.length).toBe(14);
    });
    
    test('should handle null optional fields in array', () => {
      const member = new ValidatedMember(
        'test@example.com',
        'Active',
        'John',
        'Doe',
        '',
        new Date('2023-01-15'),
        new Date('2024-01-15'),
        null,
        null,
        false,
        false,
        false,
        null,
        null
      );
      
      const array = member.toArray();
      
      expect(array[4]).toBe(''); // Phone
      expect(array[7]).toBe(null); // Period
      expect(array[8]).toBe(null); // Migrated
      expect(array[12]).toBe(null); // Renewed On
      expect(array[13]).toBe(null); // Member ID
    });
    
  });
  
  describe('Round-trip Consistency', () => {
    
    test('should maintain data integrity through fromRow -> toArray cycle', () => {
      const headers = ValidatedMember.HEADERS;
      const originalRow = [
        'Active',
        'test@example.com',
        'John',
        'Doe',
        '555-1234',
        new Date('2023-01-15'),
        new Date('2024-01-15'),
        12,
        new Date('2023-06-01'),
        true,
        false,
        true,
        new Date('2023-12-01'),
        'SC3-A7K3M'
      ];
      
      const member = ValidatedMember.fromRow(originalRow, headers, 2, null);
      const reconstructedRow = member.toArray();
      
      // Compare each field
      expect(reconstructedRow[0]).toBe(originalRow[0]); // Status
      expect(reconstructedRow[1]).toBe(originalRow[1]); // Email
      expect(reconstructedRow[2]).toBe(originalRow[2]); // First
      expect(reconstructedRow[3]).toBe(originalRow[3]); // Last
      expect(reconstructedRow[4]).toBe(originalRow[4]); // Phone
      expect(reconstructedRow[5]).toBe(originalRow[5]); // Joined
      expect(reconstructedRow[6]).toBe(originalRow[6]); // Expires
      expect(reconstructedRow[7]).toBe(originalRow[7]); // Period
      expect(reconstructedRow[8]).toBe(originalRow[8]); // Migrated
      expect(reconstructedRow[9]).toBe(originalRow[9]); // Directory Share Name
      expect(reconstructedRow[10]).toBe(originalRow[10]); // Directory Share Email
      expect(reconstructedRow[11]).toBe(originalRow[11]); // Directory Share Phone
      expect(reconstructedRow[12]).toBe(originalRow[12]); // Renewed On
      expect(reconstructedRow[13]).toBe(originalRow[13]); // Member ID
    });
    
  });
  
  describe('HEADERS Constant', () => {
    
    test('should define all required headers in correct order', () => {
      expect(ValidatedMember.HEADERS).toEqual([
        'Status',
        'Email',
        'First',
        'Last',
        'Phone',
        'Joined',
        'Expires',
        'Period',
        'Migrated',
        'Directory Share Name',
        'Directory Share Email',
        'Directory Share Phone',
        'Renewed On',
        'Member ID'
      ]);
    });
    
    test('should have 14 headers matching toArray() output length', () => {
      const member = new ValidatedMember(
        'test@example.com',
        'Active',
        'John',
        'Doe',
        '',
        new Date('2023-01-15'),
        new Date('2024-01-15'),
        null,
        null,
        false,
        false,
        false,
        null,
        null
      );
      
      const array = member.toArray();
      expect(array.length).toBe(ValidatedMember.HEADERS.length);
      expect(ValidatedMember.HEADERS.length).toBe(14);
    });
  
  });
  
  // ========================================================================
  // Column-Order Independence (MANDATORY per gas-best-practices.md)
  // ========================================================================
  
  describe('Column-Order Independence', () => {
    
    test('should work correctly when sheet columns are in different order than HEADERS', () => {
      // Arrange: Headers in REVERSED order
      const shuffledHeaders = [...ValidatedMember.HEADERS].reverse();
      const testObj = {
        Status: 'Active',
        Email: 'test@example.com',
        First: 'John',
        Last: 'Doe',
        Phone: '555-1234',
        Joined: new Date('2023-01-15'),
        Expires: new Date('2024-01-15'),
        Period: 12,
        Migrated: null,
        'Directory Share Name': true,
        'Directory Share Email': false,
        'Directory Share Phone': true,
        'Renewed On': new Date('2023-12-01'),
        'Member ID': 'SC3-A7K3M'
      };
      const rowData = shuffledHeaders.map(h => testObj[h]);
      
      // Act
      const member = ValidatedMember.fromRow(rowData, shuffledHeaders, 2);
      
      // Assert
      expect(member).not.toBeNull();
      expect(member.Email).toBe('test@example.com');
      expect(member.Status).toBe('Active');
      expect(member.First).toBe('John');
      expect(member.Last).toBe('Doe');
      expect(member['Member ID']).toBe('SC3-A7K3M');
    });
    
    test('should work with arbitrary column order', () => {
      const randomHeaders = [
        'Member ID', 'Email', 'Last', 'First', 'Status',
        'Expires', 'Joined', 'Phone', 'Period', 'Migrated',
        'Directory Share Phone', 'Directory Share Email', 'Directory Share Name',
        'Renewed On'
      ];
      const testObj = {
        Status: 'Active',
        Email: 'random@example.com',
        First: 'Random',
        Last: 'Order',
        Phone: '555-9999',
        Joined: new Date('2023-03-10'),
        Expires: new Date('2024-03-10'),
        Period: 12,
        Migrated: null,
        'Directory Share Name': false,
        'Directory Share Email': true,
        'Directory Share Phone': false,
        'Renewed On': null,
        'Member ID': 'SC3-B8C9D'
      };
      const rowData = randomHeaders.map(h => testObj[h]);
      
      const member = ValidatedMember.fromRow(rowData, randomHeaders, 3);
      
      expect(member).not.toBeNull();
      expect(member.Email).toBe('random@example.com');
      expect(member.First).toBe('Random');
      expect(member.Last).toBe('Order');
      expect(member['Member ID']).toBe('SC3-B8C9D');
    });
    
    test('should work with shuffled headers including Member ID', () => {
      const shuffledHeaders = [
        'First', 'Member ID', 'Status', 'Last', 'Email',
        'Period', 'Phone', 'Joined', 'Expires', 'Migrated',
        'Renewed On', 'Directory Share Name', 'Directory Share Email', 'Directory Share Phone'
      ];
      const testObj = {
        Status: 'Active',
        Email: 'shuffled@example.com',
        First: 'Shuffled',
        Last: 'Test',
        Phone: '',
        Joined: new Date('2023-05-20'),
        Expires: new Date('2024-05-20'),
        Period: null,
        Migrated: null,
        'Directory Share Name': true,
        'Directory Share Email': true,
        'Directory Share Phone': true,
        'Renewed On': null,
        'Member ID': 'SC3-E1F2G'
      };
      const rowData = shuffledHeaders.map(h => testObj[h]);
      
      const member = ValidatedMember.fromRow(rowData, shuffledHeaders, 4);
      
      expect(member).not.toBeNull();
      expect(member.Email).toBe('shuffled@example.com');
      expect(member['Member ID']).toBe('SC3-E1F2G');
      
      // Verify all fields are correct despite shuffled input
      expect(member.Status).toBe('Active');
      expect(member.First).toBe('Shuffled');
      expect(member.Last).toBe('Test');
      expect(member.Joined).toEqual(new Date('2023-05-20'));
    });
    
  });
  
});
