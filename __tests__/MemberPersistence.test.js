/**
 * @fileoverview Tests for MemberPersistence helper
 * 
 * Tests selective cell writing and value comparison logic.
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
        setValue: jest.fn()
      };
      
      mockSheet = {
        getRange: jest.fn().mockReturnValue(mockRange)
      };
    });
    
    test('should write only changed cells', () => {
      const originalRows = [
        ['Active', 'test1@example.com', 'John', 'Doe', '555-1111', new Date('2023-01-15'), new Date('2024-01-15'), 12, true, false, true, null],
        ['Active', 'test2@example.com', 'Jane', 'Smith', '555-2222', new Date('2023-02-20'), new Date('2024-02-20'), 12, false, true, false, null]
      ];
      
      // Create members with one field changed
      const member1 = new ValidatedMember(
        'test1@example.com', 'Active', 'John', 'Doe', '555-9999', // Phone changed
        new Date('2023-01-15'), new Date('2024-01-15'), 12,
        true, false, true, null
      );
      
      const member2 = new ValidatedMember(
        'test2@example.com', 'Expired', // Status changed
        'Jane', 'Smith', '555-2222',
        new Date('2023-02-20'), new Date('2024-02-20'), 12,
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
        ['Active', 'test1@example.com', 'John', 'Doe', '555-1111', new Date('2023-01-15'), new Date('2024-01-15'), 12, true, false, true, null]
      ];
      
      const member1 = new ValidatedMember(
        'test1@example.com', 'Active', 'John', 'Doe', '555-1111',
        new Date('2023-01-15'), new Date('2024-01-15'), 12,
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
        ['Active', 'test1@example.com', 'John', 'Doe', '555-1111', originalDate, new Date('2024-01-15'), 12, true, false, true, null]
      ];
      
      const member1 = new ValidatedMember(
        'test1@example.com', 'Active', 'John', 'Doe', '555-1111',
        newDate, // Joined date changed
        new Date('2024-01-15'), 12,
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
        ['Active', 'test1@example.com', 'John', 'Doe', '555-1111', sameDate, new Date('2024-01-15'), 12, true, false, true, null]
      ];
      
      const member1 = new ValidatedMember(
        'test1@example.com', 'Active', 'John', 'Doe', '555-1111',
        sameDate, // Same Date object
        new Date('2024-01-15'), 12,
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
        ['Active', 'test1@example.com', 'John', 'Doe', '555-1111', new Date('2023-01-15'), new Date('2024-01-15'), 12, true, false, true, null]
      ];
      
      const member1 = new ValidatedMember(
        'test1@example.com', 'Active', 'John', 'Doe', '555-1111',
        new Date('2023-01-15'), new Date('2024-01-15'), 12,
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
      expect(mockSheet.getRange).toHaveBeenCalledWith(2, 9); // Directory Share Name
      expect(mockSheet.getRange).toHaveBeenCalledWith(2, 10); // Directory Share Email
    });
    
    test('should handle null to value changes', () => {
      const originalRows = [
        ['Active', 'test1@example.com', 'John', 'Doe', '555-1111', new Date('2023-01-15'), new Date('2024-01-15'), null, true, false, true, null]
      ];
      
      const member1 = new ValidatedMember(
        'test1@example.com', 'Active', 'John', 'Doe', '555-1111',
        new Date('2023-01-15'), new Date('2024-01-15'), 12, // Period changed from null to 12
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
        ['Active', 'test1@example.com', 'John', 'Doe', '555-1111', new Date('2023-01-15'), new Date('2024-01-15'), 12, true, false, true, null]
      ];
      
      const member1 = new ValidatedMember(
        'test1@example.com', 'Active', 'John', 'Doe', '555-1111',
        new Date('2023-01-15'), new Date('2024-01-15'), 12,
        true, false, true, null
      );
      
      const member2 = new ValidatedMember(
        'test2@example.com', 'Active', 'Jane', 'Smith', '555-2222',
        new Date('2023-02-20'), new Date('2024-02-20'), 12,
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
        ['Active', 'test1@example.com', 'John', 'Doe', '555-1111', new Date('2023-01-15'), new Date('2024-01-15'), 12, true, false, true, null],
        ['Active', 'test2@example.com', 'Jane', 'Smith', '555-2222', new Date('2023-02-20'), new Date('2024-02-20'), 12, false, true, false, null],
        ['Expired', 'test3@example.com', 'Bob', 'Jones', '555-3333', new Date('2022-01-10'), new Date('2023-01-10'), 12, true, true, true, null]
      ];
      
      // Modify different fields in each row
      const member1 = new ValidatedMember(
        'test1@example.com', 'Expired', 'John', 'Doe', '555-1111', // Status changed
        new Date('2023-01-15'), new Date('2024-01-15'), 12,
        true, false, true, null
      );
      
      const member2 = new ValidatedMember(
        'test2@example.com', 'Active', 'Jane', 'Smith', '555-9999', // Phone changed
        new Date('2023-02-20'), new Date('2024-02-20'), 12,
        false, true, false, null
      );
      
      const member3 = new ValidatedMember(
        'test3@example.com', 'Expired', 'Bob', 'Jones', '555-3333',
        new Date('2022-01-10'), new Date('2023-01-10'), 12,
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
    
  });
  
});
