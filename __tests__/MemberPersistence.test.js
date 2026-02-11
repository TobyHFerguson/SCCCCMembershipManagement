/**
 * @fileoverview Tests for MemberPersistence helper
 * 
 * Table of Contents:
 * 1. valuesEqual() — Value comparison logic for Dates, nulls, primitives
 * 2. writeChangedCells() — Bulk selective cell writing for member arrays
 * 3. writeSingleMemberChanges() — Single-member partial-update cell writing
 */

// Mock GAS environment
jest.mock('../src/common/config/Properties.js', () => ({}));
jest.mock('../src/common/utils/Logger.js', () => ({}));

// Load dependencies and assign to global
// ValidatedMember must be loaded first as MemberPersistence depends on it
const { ValidatedMember } = require('../src/common/data/ValidatedMember.js');
const { MemberPersistence } = require('../src/common/data/MemberPersistence.js');
global.ValidatedMember = ValidatedMember;
global.MemberPersistence = MemberPersistence;

describe('MemberPersistence', () => {
  
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
    
    // Mock Common.Logger (backward compat)
    global.Common = global.Common || {};
    global.Common.Logger = global.AppLogger;
  });
  
  describe('valuesEqual()', () => {
    
    test('should compare primitive values correctly', () => {
      expect(MemberPersistence.valuesEqual('test', 'test')).toBe(true);
      expect(MemberPersistence.valuesEqual('test', 'other')).toBe(false);
      expect(MemberPersistence.valuesEqual(123, 123)).toBe(true);
      expect(MemberPersistence.valuesEqual(123, 456)).toBe(false);
      expect(MemberPersistence.valuesEqual(true, true)).toBe(true);
      expect(MemberPersistence.valuesEqual(true, false)).toBe(false);
    });
    
    test('should compare Date objects by timestamp', () => {
      const date1 = new Date('2023-01-15T10:00:00Z');
      const date2 = new Date('2023-01-15T10:00:00Z');
      const date3 = new Date('2023-01-15T11:00:00Z');
      
      expect(MemberPersistence.valuesEqual(date1, date2)).toBe(true);
      expect(MemberPersistence.valuesEqual(date1, date3)).toBe(false);
    });
    
    test('should handle Date vs non-Date comparison', () => {
      const date = new Date('2023-01-15');
      const string = '2023-01-15';
      const number = date.getTime();
      
      expect(MemberPersistence.valuesEqual(date, string)).toBe(false);
      expect(MemberPersistence.valuesEqual(date, number)).toBe(false);
      expect(MemberPersistence.valuesEqual(string, date)).toBe(false);
    });
    
    test('should handle null and undefined as equal', () => {
      expect(MemberPersistence.valuesEqual(null, null)).toBe(true);
      expect(MemberPersistence.valuesEqual(undefined, undefined)).toBe(true);
      expect(MemberPersistence.valuesEqual(null, undefined)).toBe(true);
      expect(MemberPersistence.valuesEqual(undefined, null)).toBe(true);
    });
    
    test('should handle null/undefined vs other values', () => {
      expect(MemberPersistence.valuesEqual(null, '')).toBe(false);
      expect(MemberPersistence.valuesEqual(null, 0)).toBe(false);
      expect(MemberPersistence.valuesEqual(undefined, '')).toBe(false);
      expect(MemberPersistence.valuesEqual('', null)).toBe(false);
    });
    
  });
  
  describe('writeChangedCells()', () => {
    
    let mockSheet;
    let mockRange;
    
    beforeEach(() => {
      mockRange = {
        setValue: jest.fn(),
        setNumberFormat: jest.fn()
      };
      
      mockSheet = {
        getRange: jest.fn().mockReturnValue(mockRange)
      };
    });
    
    test('should write only changed cells', () => {
      const originalRows = [
        ['Active', 'test1@example.com', 'John', 'Doe', '555-1111', new Date('2023-01-15'), new Date('2024-01-15'), 12, null, true, false, true, null],
        ['Active', 'test2@example.com', 'Jane', 'Smith', '555-2222', new Date('2023-02-20'), new Date('2024-02-20'), 12, null, false, true, false, null]
      ];
      
      // Create members with one field changed
      const member1 = new ValidatedMember(
        'test1@example.com', 'Active', 'John', 'Doe', '555-9999', // Phone changed
        new Date('2023-01-15'), new Date('2024-01-15'), 12,
        null,  // Migrated
        true, false, true, null
      );
      
      const member2 = new ValidatedMember(
        'test2@example.com', 'Expired', // Status changed
        'Jane', 'Smith', '555-2222',
        new Date('2023-02-20'), new Date('2024-02-20'), 12,
        null,  // Migrated
        false, true, false, null
      );
      
      const headers = ValidatedMember.HEADERS;
      const changeCount = MemberPersistence.writeChangedCells(
        mockSheet,
        originalRows,
        [member1, member2],
        headers
      );
      
      expect(changeCount).toBe(2);
      expect(mockSheet.getRange).toHaveBeenCalledTimes(2);
      
      // Check that changed cells were written
      // Row 1 (index 0), Phone column (index 4): getRange(2, 5) in 1-based indexing
      expect(mockSheet.getRange).toHaveBeenCalledWith(2, 5);
      expect(mockRange.setValue).toHaveBeenCalledWith('555-9999');
      
      // Row 2 (index 1), Status column (index 0): getRange(3, 1) in 1-based indexing
      expect(mockSheet.getRange).toHaveBeenCalledWith(3, 1);
      expect(mockRange.setValue).toHaveBeenCalledWith('Expired');
    });
    
    test('should return 0 when no cells changed', () => {
      const originalRows = [
        ['Active', 'test1@example.com', 'John', 'Doe', '555-1111', new Date('2023-01-15'), new Date('2024-01-15'), 12, null, true, false, true, null]
      ];
      
      const member1 = new ValidatedMember(
        'test1@example.com', 'Active', 'John', 'Doe', '555-1111',
        new Date('2023-01-15'), new Date('2024-01-15'), 12,
        null,  // Migrated
        true, false, true, null
      );
      
      const headers = ValidatedMember.HEADERS;
      const changeCount = MemberPersistence.writeChangedCells(
        mockSheet,
        originalRows,
        [member1],
        headers
      );
      
      expect(changeCount).toBe(0);
      expect(mockSheet.getRange).not.toHaveBeenCalled();
    });
    
    test('should handle Date changes correctly', () => {
      const originalDate = new Date('2023-01-15');
      const newDate = new Date('2024-01-15');
      
      const originalRows = [
        ['Active', 'test1@example.com', 'John', 'Doe', '555-1111', originalDate, new Date('2024-01-15'), 12, null, true, false, true, null]
      ];
      
      const member1 = new ValidatedMember(
        'test1@example.com', 'Active', 'John', 'Doe', '555-1111',
        newDate, // Joined date changed
        new Date('2024-01-15'), 12,
        null,  // Migrated
        true, false, true, null
      );
      
      const headers = ValidatedMember.HEADERS;
      const changeCount = MemberPersistence.writeChangedCells(
        mockSheet,
        originalRows,
        [member1],
        headers
      );
      
      expect(changeCount).toBe(1);
      expect(mockSheet.getRange).toHaveBeenCalledWith(2, 6); // Row 2, column 6 (Joined)
      expect(mockRange.setValue).toHaveBeenCalledWith(newDate);
    });
    
    test('should detect same Date objects as unchanged', () => {
      const sameDate = new Date('2023-01-15T00:00:00Z');
      
      const originalRows = [
        ['Active', 'test1@example.com', 'John', 'Doe', '555-1111', sameDate, new Date('2024-01-15'), 12, null, true, false, true, null]
      ];
      
      const member1 = new ValidatedMember(
        'test1@example.com', 'Active', 'John', 'Doe', '555-1111',
        sameDate, // Same Date object
        new Date('2024-01-15'), 12,
        null,  // Migrated
        true, false, true, null
      );
      
      const headers = ValidatedMember.HEADERS;
      const changeCount = MemberPersistence.writeChangedCells(
        mockSheet,
        originalRows,
        [member1],
        headers
      );
      
      expect(changeCount).toBe(0);
    });
    
    test('should handle boolean changes', () => {
      const originalRows = [
        ['Active', 'test1@example.com', 'John', 'Doe', '555-1111', new Date('2023-01-15'), new Date('2024-01-15'), 12, null, true, false, true, null]
      ];
      
      const member1 = new ValidatedMember(
        'test1@example.com', 'Active', 'John', 'Doe', '555-1111',
        new Date('2023-01-15'), new Date('2024-01-15'), 12,
        null,  // Migrated
        false, // Directory Share Name changed from true to false
        true,  // Directory Share Email changed from false to true
        true,
        null
      );
      
      const headers = ValidatedMember.HEADERS;
      const changeCount = MemberPersistence.writeChangedCells(
        mockSheet,
        originalRows,
        [member1],
        headers
      );
      
      expect(changeCount).toBe(2);
      expect(mockSheet.getRange).toHaveBeenCalledWith(2, 10); // Directory Share Name
      expect(mockSheet.getRange).toHaveBeenCalledWith(2, 11); // Directory Share Email
    });
    
    test('should handle null to value changes', () => {
      const originalRows = [
        ['Active', 'test1@example.com', 'John', 'Doe', '555-1111', new Date('2023-01-15'), new Date('2024-01-15'), null, null, true, false, true, null]
      ];
      
      const member1 = new ValidatedMember(
        'test1@example.com', 'Active', 'John', 'Doe', '555-1111',
        new Date('2023-01-15'), new Date('2024-01-15'), 12, // Period changed from null to 12
        null,  // Migrated
        true, false, true,
        new Date('2023-12-01') // Renewed On changed from null to date
      );
      
      const headers = ValidatedMember.HEADERS;
      const changeCount = MemberPersistence.writeChangedCells(
        mockSheet,
        originalRows,
        [member1],
        headers
      );
      
      expect(changeCount).toBe(2);
    });
    
    test('should throw error on row count mismatch', () => {
      const originalRows = [
        ['Active', 'test1@example.com', 'John', 'Doe', '555-1111', new Date('2023-01-15'), new Date('2024-01-15'), 12, null, true, false, true, null]
      ];
      
      const member1 = new ValidatedMember(
        'test1@example.com', 'Active', 'John', 'Doe', '555-1111',
        new Date('2023-01-15'), new Date('2024-01-15'), 12,
        null,  // Migrated
        true, false, true, null
      );
      
      const member2 = new ValidatedMember(
        'test2@example.com', 'Active', 'Jane', 'Smith', '555-2222',
        new Date('2023-02-20'), new Date('2024-02-20'), 12,
        null,  // Migrated
        false, true, false, null
      );
      
      const headers = ValidatedMember.HEADERS;
      
      expect(() => {
        MemberPersistence.writeChangedCells(
          mockSheet,
          originalRows,
          [member1, member2], // 2 members but only 1 original row
          headers
        );
      }).toThrow('row count mismatch');
      
      expect(Common.Logger.error).toHaveBeenCalledWith(
        'MemberPersistence',
        expect.stringContaining('Row count mismatch')
      );
    });
    
    test('should handle multiple row updates efficiently', () => {
      const originalRows = [
        ['Active', 'test1@example.com', 'John', 'Doe', '555-1111', new Date('2023-01-15'), new Date('2024-01-15'), 12, null, true, false, true, null],
        ['Active', 'test2@example.com', 'Jane', 'Smith', '555-2222', new Date('2023-02-20'), new Date('2024-02-20'), 12, null, false, true, false, null],
        ['Expired', 'test3@example.com', 'Bob', 'Jones', '555-3333', new Date('2022-01-10'), new Date('2023-01-10'), 12, null, true, true, true, null]
      ];
      
      // Modify different fields in each row
      const member1 = new ValidatedMember(
        'test1@example.com', 'Expired', 'John', 'Doe', '555-1111', // Status changed
        new Date('2023-01-15'), new Date('2024-01-15'), 12,
        null,  // Migrated
        true, false, true, null
      );
      
      const member2 = new ValidatedMember(
        'test2@example.com', 'Active', 'Jane', 'Smith', '555-9999', // Phone changed
        new Date('2023-02-20'), new Date('2024-02-20'), 12,
        null,  // Migrated
        false, true, false, null
      );
      
      const member3 = new ValidatedMember(
        'test3@example.com', 'Expired', 'Bob', 'Jones', '555-3333',
        new Date('2022-01-10'), new Date('2023-01-10'), 12,
        null,  // Migrated
        false, true, true, null // Directory Share Name changed
      );
      
      const headers = ValidatedMember.HEADERS;
      const changeCount = MemberPersistence.writeChangedCells(
        mockSheet,
        originalRows,
        [member1, member2, member3],
        headers
      );
      
      expect(changeCount).toBe(3);
      expect(mockSheet.getRange).toHaveBeenCalledTimes(3);
    });
    
    test('should work correctly when sheet columns are in different order than HEADERS', () => {
      // Sheet has columns in a different order than ValidatedMember.HEADERS
      const sheetHeaders = [
        'Email', 'Status', 'First', 'Last', 'Phone', 'Joined', 'Expires',
        'Renewed On', 'Period', 'Migrated', 'Directory Share Name',
        'Directory Share Email', 'Directory Share Phone'
      ];
      
      // Original row data matches sheet column order (Email first, then Status, etc.)
      const originalRows = [
        ['test1@example.com', 'Active', 'John', 'Doe', '555-1111', new Date('2023-01-15'), new Date('2024-01-15'), null, 12, null, true, false, true]
      ];
      
      // Create member with Phone changed
      const member1 = new ValidatedMember(
        'test1@example.com', 'Active', 'John', 'Doe', '555-9999', // Phone changed
        new Date('2023-01-15'), new Date('2024-01-15'), 12,
        null,  // Migrated
        true, false, true, null
      );
      
      const changeCount = MemberPersistence.writeChangedCells(
        mockSheet,
        originalRows,
        [member1],
        sheetHeaders  // Using sheet headers in different order
      );
      
      // Should only detect Phone change at column 5 (1-based), not at wrong column
      expect(changeCount).toBe(1);
      expect(mockSheet.getRange).toHaveBeenCalledTimes(1);
      // Phone is at index 4 in sheetHeaders → column 5 (1-based)
      expect(mockSheet.getRange).toHaveBeenCalledWith(2, 5);
      expect(mockRange.setValue).toHaveBeenCalledWith('555-9999');
    });
    
    test('should reset cell number format when overwriting Date with number (Period corruption fix)', () => {
      // Simulate corrupted sheet data where Period column has a Date 
      // (from previous column-order bug writing Expires into Period)
      const corruptedDate = new Date('1899-12-31'); // Serial number 1 displayed as date
      
      const originalRows = [
        ['Active', 'test1@example.com', 'John', 'Doe', '555-1111', new Date('2023-01-15'), new Date('2024-01-15'), corruptedDate, null, true, false, true, null]
      ];
      
      // After renewal, Period is correctly set to integer
      const member1 = new ValidatedMember(
        'test1@example.com', 'Active', 'John', 'Doe', '555-1111',
        new Date('2023-01-15'), new Date('2024-01-15'), 1,
        null, true, false, true, null
      );
      // Constructor converts Date period to null, override for this test scenario
      // (simulating member.Period being set by getPeriod_ after construction)
      member1.Period = 1;
      
      const headers = ValidatedMember.HEADERS;
      const changeCount = MemberPersistence.writeChangedCells(
        mockSheet,
        originalRows,
        [member1],
        headers
      );
      
      // Period changed from Date to number
      expect(changeCount).toBe(1);
      expect(mockRange.setValue).toHaveBeenCalledWith(1);
      // Should reset number format to prevent Sheets from displaying as date
      expect(mockRange.setNumberFormat).toHaveBeenCalledWith('0');
    });
    
    test('should NOT reset format when overwriting Date with Date', () => {
      const oldDate = new Date('2023-01-15');
      const newDate = new Date('2023-06-15');
      
      const originalRows = [
        ['Active', 'test1@example.com', 'John', 'Doe', '555-1111', oldDate, new Date('2024-01-15'), 12, null, true, false, true, null]
      ];
      
      const member1 = new ValidatedMember(
        'test1@example.com', 'Active', 'John', 'Doe', '555-1111',
        newDate, // Joined changed (still before Expires)
        new Date('2024-01-15'), 12,
        null, true, false, true, null
      );
      
      const headers = ValidatedMember.HEADERS;
      MemberPersistence.writeChangedCells(
        mockSheet,
        originalRows,
        [member1],
        headers
      );
      
      expect(mockRange.setValue).toHaveBeenCalledWith(newDate);
      // Should NOT reset format when both values are Dates
      expect(mockRange.setNumberFormat).not.toHaveBeenCalled();
    });
    
    test('should NOT reset format when overwriting non-Date with non-Date', () => {
      const originalRows = [
        ['Active', 'test1@example.com', 'John', 'Doe', '555-1111', new Date('2023-01-15'), new Date('2024-01-15'), 12, null, true, false, true, null]
      ];
      
      const member1 = new ValidatedMember(
        'test1@example.com', 'Expired', 'John', 'Doe', '555-1111', // Status changed
        new Date('2023-01-15'), new Date('2024-01-15'), 12,
        null, true, false, true, null
      );
      
      const headers = ValidatedMember.HEADERS;
      MemberPersistence.writeChangedCells(
        mockSheet,
        originalRows,
        [member1],
        headers
      );
      
      expect(mockRange.setValue).toHaveBeenCalledWith('Expired');
      // Should NOT reset format for string-to-string change
      expect(mockRange.setNumberFormat).not.toHaveBeenCalled();
    });
    
  });
  
  // ==================== writeSingleMemberChanges Tests ====================
  
  describe('writeSingleMemberChanges()', () => {
    
    let mockSheet;
    let mockRange;
    
    beforeEach(() => {
      mockRange = {
        setValue: jest.fn(),
        setNumberFormat: jest.fn()
      };
      
      mockSheet = {
        getRange: jest.fn().mockReturnValue(mockRange)
      };
    });
    
    test('should write only changed cells for a full member object', () => {
      const headers = ValidatedMember.HEADERS;
      const originalRow = ['Active', 'test@example.com', 'John', 'Doe', '555-1111', new Date('2023-01-15'), new Date('2024-01-15'), 12, null, true, false, true, null];
      
      const member = new ValidatedMember(
        'test@example.com', 'Active', 'Jane', 'Doe', '555-1111', // First changed
        new Date('2023-01-15'), new Date('2024-01-15'), 12,
        null, true, true, true, null // Directory Share Email changed
      );
      
      const changeCount = MemberPersistence.writeSingleMemberChanges(
        mockSheet, originalRow, member, headers, 5 // sheetRow = 5
      );
      
      expect(changeCount).toBe(2);
      // First is at index 2 → column 3
      expect(mockSheet.getRange).toHaveBeenCalledWith(5, 3);
      expect(mockRange.setValue).toHaveBeenCalledWith('Jane');
      // Directory Share Email is at index 10 → column 11
      expect(mockSheet.getRange).toHaveBeenCalledWith(5, 11);
      expect(mockRange.setValue).toHaveBeenCalledWith(true);
    });
    
    test('should support partial objects (only update present keys)', () => {
      const headers = ValidatedMember.HEADERS;
      const originalRow = ['Active', 'test@example.com', 'John', 'Doe', '555-1111', new Date('2023-01-15'), new Date('2024-01-15'), 12, null, true, false, true, null];
      
      // Partial object — only First and Phone
      const partialUpdate = { First: 'Jane', Phone: '555-9999' };
      
      const changeCount = MemberPersistence.writeSingleMemberChanges(
        mockSheet, originalRow, partialUpdate, headers, 2
      );
      
      expect(changeCount).toBe(2);
      // First at index 2 → column 3
      expect(mockSheet.getRange).toHaveBeenCalledWith(2, 3);
      expect(mockRange.setValue).toHaveBeenCalledWith('Jane');
      // Phone at index 4 → column 5
      expect(mockSheet.getRange).toHaveBeenCalledWith(2, 5);
      expect(mockRange.setValue).toHaveBeenCalledWith('555-9999');
      // Should NOT touch any other columns
      expect(mockSheet.getRange).toHaveBeenCalledTimes(2);
    });
    
    test('should skip keys not present in partial object', () => {
      const headers = ValidatedMember.HEADERS;
      const originalRow = ['Active', 'test@example.com', 'John', 'Doe', '555-1111', new Date('2023-01-15'), new Date('2024-01-15'), 12, null, true, false, true, null];
      
      // Partial object with unchanged value
      const partialUpdate = { First: 'John' }; // Same as original
      
      const changeCount = MemberPersistence.writeSingleMemberChanges(
        mockSheet, originalRow, partialUpdate, headers, 2
      );
      
      expect(changeCount).toBe(0);
      expect(mockSheet.getRange).not.toHaveBeenCalled();
    });
    
    test('should return 0 when no cells changed', () => {
      const headers = ValidatedMember.HEADERS;
      const originalRow = ['Active', 'test@example.com', 'John', 'Doe', '555-1111', new Date('2023-01-15'), new Date('2024-01-15'), 12, null, true, false, true, null];
      
      const member = new ValidatedMember(
        'test@example.com', 'Active', 'John', 'Doe', '555-1111',
        new Date('2023-01-15'), new Date('2024-01-15'), 12,
        null, true, false, true, null
      );
      
      const changeCount = MemberPersistence.writeSingleMemberChanges(
        mockSheet, originalRow, member, headers, 2
      );
      
      expect(changeCount).toBe(0);
      expect(mockSheet.getRange).not.toHaveBeenCalled();
    });
    
    test('should reset cell number format when overwriting Date with number', () => {
      const headers = ValidatedMember.HEADERS;
      const corruptedDate = new Date('1899-12-31');
      const originalRow = ['Active', 'test@example.com', 'John', 'Doe', '555-1111', new Date('2023-01-15'), new Date('2024-01-15'), corruptedDate, null, true, false, true, null];
      
      // Period was a Date, now it's a number
      const partialUpdate = { Period: 1 };
      
      const changeCount = MemberPersistence.writeSingleMemberChanges(
        mockSheet, originalRow, partialUpdate, headers, 2
      );
      
      expect(changeCount).toBe(1);
      expect(mockRange.setValue).toHaveBeenCalledWith(1);
      expect(mockRange.setNumberFormat).toHaveBeenCalledWith('0');
    });
    
    test('should NOT reset format when overwriting Date with Date', () => {
      const headers = ValidatedMember.HEADERS;
      const oldDate = new Date('2023-01-15');
      const newDate = new Date('2023-06-15');
      const originalRow = ['Active', 'test@example.com', 'John', 'Doe', '555-1111', oldDate, new Date('2024-01-15'), 12, null, true, false, true, null];
      
      const partialUpdate = { Joined: newDate };
      
      MemberPersistence.writeSingleMemberChanges(
        mockSheet, originalRow, partialUpdate, headers, 2
      );
      
      expect(mockRange.setValue).toHaveBeenCalledWith(newDate);
      expect(mockRange.setNumberFormat).not.toHaveBeenCalled();
    });
    
    test('should be column-order independent', () => {
      // Headers in reversed order
      const reversedHeaders = [...ValidatedMember.HEADERS].reverse();
      // Build original row matching reversed headers
      const defaults = {
        Email: 'test@example.com', Status: 'Active', First: 'John', Last: 'Doe',
        Phone: '555-1111', Joined: new Date('2023-01-15'), Expires: new Date('2024-01-15'),
        Period: 12, Migrated: null, 'Directory Share Name': true,
        'Directory Share Email': false, 'Directory Share Phone': true, 'Renewed On': null
      };
      const originalRow = reversedHeaders.map(h => defaults[h]);
      
      const partialUpdate = { First: 'Jane' };
      
      const changeCount = MemberPersistence.writeSingleMemberChanges(
        mockSheet, originalRow, partialUpdate, reversedHeaders, 3
      );
      
      expect(changeCount).toBe(1);
      // First should be written at its reversed position
      const firstCol = reversedHeaders.indexOf('First');
      expect(mockSheet.getRange).toHaveBeenCalledWith(3, firstCol + 1);
      expect(mockRange.setValue).toHaveBeenCalledWith('Jane');
    });
    
    test('should handle null to value changes', () => {
      const headers = ValidatedMember.HEADERS;
      const originalRow = ['Active', 'test@example.com', 'John', 'Doe', '555-1111', new Date('2023-01-15'), new Date('2024-01-15'), null, null, true, false, true, null];
      
      const partialUpdate = { Period: 12, 'Renewed On': new Date('2024-06-01') };
      
      const changeCount = MemberPersistence.writeSingleMemberChanges(
        mockSheet, originalRow, partialUpdate, headers, 2
      );
      
      expect(changeCount).toBe(2);
    });
    
    test('should handle boolean changes', () => {
      const headers = ValidatedMember.HEADERS;
      const originalRow = ['Active', 'test@example.com', 'John', 'Doe', '555-1111', new Date('2023-01-15'), new Date('2024-01-15'), 12, null, true, false, true, null];
      
      const partialUpdate = { 'Directory Share Name': false, 'Directory Share Email': true };
      
      const changeCount = MemberPersistence.writeSingleMemberChanges(
        mockSheet, originalRow, partialUpdate, headers, 2
      );
      
      expect(changeCount).toBe(2);
    });
    
  });
  
});
