// @ts-check
/**
 * Test suite for SheetAccess
 * Tests the abstraction layer for spreadsheet operations using native SpreadsheetApp
 * 
 * Table of Contents:
 * 1. getData - Get data as array of row objects
 * 2. getDataAsArrays - Get data as 2D arrays
 * 3. setData - Write data to sheet
 * 4. getSheet - Get raw Sheet object
 * 5. *ById Methods - For dynamic/external spreadsheets not in Bootstrap
 *    - getSheetById
 *    - getDataAsArraysById
 *    - getDataById
 *    - setDataById
 *    - getSpreadsheetById
 * 6. Typed Accessors - Returns validated, strongly-typed data
 *    - getActiveMembers
 */

// Create mock sheet with all required methods
const createMockSheet = (values = [[]]) => {
  const mockRange = {
    getValues: jest.fn(() => values),
    setValues: jest.fn(),
    clearContent: jest.fn()
  };
  
  const sheet = {
    getDataRange: jest.fn(() => mockRange),
    getLastRow: jest.fn(() => values.length),
    getLastColumn: jest.fn(() => values.length > 0 ? values[0].length : 0),
    getRange: jest.fn((row, col, numRows, numCols) => mockRange)
  };
  
  return { sheet, mockRange };
};

// Create mock SpreadsheetManager as global
global.SpreadsheetManager = {
  getSheet: jest.fn()
};

// Mock MailApp for ValidatedMember tests
global.MailApp = {
  sendEmail: jest.fn()
};

// Mock AppLogger for ValidatedMember tests
global.AppLogger = {
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  debug: jest.fn()
};

// Load ValidatedMember and make it global
const { ValidatedMember } = require('../src/common/data/ValidatedMember.js');
global.ValidatedMember = ValidatedMember;

const { SheetAccess } = require('../src/common/data/SheetAccess.js');

describe('SheetAccess', () => {
  const SpreadsheetManager = global.SpreadsheetManager;
  
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getData', () => {
    it('should get data from sheet as array of row objects', () => {
      const values = [
        ['First', 'Last', 'Email'],
        ['John', 'Doe', 'john@example.com'],
        ['Jane', 'Smith', 'jane@example.com']
      ];
      
      const { sheet } = createMockSheet(values);
      SpreadsheetManager.getSheet.mockReturnValue(sheet);

      const result = SheetAccess.getData('ActiveMembers');

      expect(SpreadsheetManager.getSheet).toHaveBeenCalledWith('ActiveMembers');
      expect(result).toEqual([
        { First: 'John', Last: 'Doe', Email: 'john@example.com' },
        { First: 'Jane', Last: 'Smith', Email: 'jane@example.com' }
      ]);
    });

    it('should return empty array when sheet has only headers', () => {
      const values = [['First', 'Last', 'Email']];
      const { sheet } = createMockSheet(values);
      SpreadsheetManager.getSheet.mockReturnValue(sheet);

      const result = SheetAccess.getData('EmptySheet');

      expect(result).toEqual([]);
    });
  });

  describe('getDataAsArrays', () => {
    it('should get data as 2D array with headers', () => {
      const values = [
        ['First', 'Last', 'Email'],
        ['John', 'Doe', 'john@example.com'],
        ['Jane', 'Smith', 'jane@example.com']
      ];
      
      const { sheet } = createMockSheet(values);
      SpreadsheetManager.getSheet.mockReturnValue(sheet);

      const result = SheetAccess.getDataAsArrays('ActiveMembers');

      expect(SpreadsheetManager.getSheet).toHaveBeenCalledWith('ActiveMembers');
      expect(result).toEqual(values);
    });

    it('should return empty 2D array when sheet is empty', () => {
      const { sheet } = createMockSheet([]);
      SpreadsheetManager.getSheet.mockReturnValue(sheet);

      const result = SheetAccess.getDataAsArrays('EmptySheet');

      expect(result).toEqual([]);
    });
  });

  describe('setData', () => {
    it('should write data to sheet', () => {
      const mockData = [
        { First: 'John', Last: 'Doe' },
        { First: 'Jane', Last: 'Smith' }
      ];
      
      const values = [['First', 'Last']]; // Existing headers
      const { sheet, mockRange } = createMockSheet(values);
      SpreadsheetManager.getSheet.mockReturnValue(sheet);

      SheetAccess.setData('ActiveMembers', mockData);

      expect(SpreadsheetManager.getSheet).toHaveBeenCalledWith('ActiveMembers');
      expect(mockRange.setValues).toHaveBeenCalled();
    });

    it('should handle empty data array by clearing content', () => {
      const values = [['First', 'Last'], ['Old', 'Data']]; // Has existing data
      const { sheet, mockRange } = createMockSheet(values);
      SpreadsheetManager.getSheet.mockReturnValue(sheet);

      SheetAccess.setData('ActiveMembers', []);

      expect(mockRange.clearContent).toHaveBeenCalled();
    });
  });

  describe('getSheet', () => {
    it('should get raw Sheet object', () => {
      const { sheet } = createMockSheet();
      SpreadsheetManager.getSheet.mockReturnValue(sheet);

      const result = SheetAccess.getSheet('ActiveMembers');

      expect(SpreadsheetManager.getSheet).toHaveBeenCalledWith('ActiveMembers');
      expect(result).toBe(sheet);
    });
  });

  // ========================================================================
  // *ById Methods - For dynamic/external spreadsheets not in Bootstrap
  // ========================================================================

  describe('getSheetById', () => {
    it('should delegate to SpreadsheetManager.getSheetById', () => {
      const { sheet } = createMockSheet();
      SpreadsheetManager.getSheetById = jest.fn().mockReturnValue(sheet);

      const result = SheetAccess.getSheetById('spreadsheet-id-123', 'SheetName');

      expect(SpreadsheetManager.getSheetById).toHaveBeenCalledWith('spreadsheet-id-123', 'SheetName', false);
      expect(result).toBe(sheet);
    });

    it('should pass createIfMissing flag to SpreadsheetManager', () => {
      const { sheet } = createMockSheet();
      SpreadsheetManager.getSheetById = jest.fn().mockReturnValue(sheet);

      SheetAccess.getSheetById('spreadsheet-id-123', 'SheetName', true);

      expect(SpreadsheetManager.getSheetById).toHaveBeenCalledWith('spreadsheet-id-123', 'SheetName', true);
    });
  });

  describe('getDataAsArraysById', () => {
    it('should get data as 2D array from external spreadsheet', () => {
      const values = [
        ['First', 'Last', 'Email'],
        ['John', 'Doe', 'john@example.com']
      ];
      const { sheet } = createMockSheet(values);
      SpreadsheetManager.getSheetById = jest.fn().mockReturnValue(sheet);

      const result = SheetAccess.getDataAsArraysById('external-spreadsheet-id', 'Results');

      expect(SpreadsheetManager.getSheetById).toHaveBeenCalledWith('external-spreadsheet-id', 'Results', false);
      expect(result).toEqual(values);
    });
  });

  describe('getDataById', () => {
    it('should get data as array of objects from external spreadsheet', () => {
      const values = [
        ['First', 'Last', 'Email'],
        ['John', 'Doe', 'john@example.com'],
        ['Jane', 'Smith', 'jane@example.com']
      ];
      const { sheet } = createMockSheet(values);
      SpreadsheetManager.getSheetById = jest.fn().mockReturnValue(sheet);

      const result = SheetAccess.getDataById('external-spreadsheet-id', 'Results');

      expect(result).toEqual([
        { First: 'John', Last: 'Doe', Email: 'john@example.com' },
        { First: 'Jane', Last: 'Smith', Email: 'jane@example.com' }
      ]);
    });

    it('should return empty array for empty sheet', () => {
      const { sheet } = createMockSheet([]);
      SpreadsheetManager.getSheetById = jest.fn().mockReturnValue(sheet);

      const result = SheetAccess.getDataById('external-spreadsheet-id', 'Empty');

      expect(result).toEqual([]);
    });
  });

  describe('setDataById', () => {
    it('should write data to external spreadsheet', () => {
      const mockData = [
        { First: 'John', Last: 'Doe' }
      ];
      const values = [['First', 'Last']];
      const { sheet, mockRange } = createMockSheet(values);
      SpreadsheetManager.getSheetById = jest.fn().mockReturnValue(sheet);

      SheetAccess.setDataById('external-spreadsheet-id', 'Results', mockData);

      expect(SpreadsheetManager.getSheetById).toHaveBeenCalledWith('external-spreadsheet-id', 'Results', false);
      expect(mockRange.setValues).toHaveBeenCalled();
    });

    it('should pass createIfMissing flag', () => {
      const mockData = [{ First: 'John' }];
      const values = [['First']];
      const { sheet } = createMockSheet(values);
      SpreadsheetManager.getSheetById = jest.fn().mockReturnValue(sheet);

      SheetAccess.setDataById('external-spreadsheet-id', 'NewSheet', mockData, true);

      expect(SpreadsheetManager.getSheetById).toHaveBeenCalledWith('external-spreadsheet-id', 'NewSheet', true);
    });

    it('should clear content for empty data array', () => {
      const values = [['First', 'Last'], ['Old', 'Data']];
      const { sheet, mockRange } = createMockSheet(values);
      SpreadsheetManager.getSheetById = jest.fn().mockReturnValue(sheet);

      SheetAccess.setDataById('external-spreadsheet-id', 'Results', []);

      expect(mockRange.clearContent).toHaveBeenCalled();
    });
  });

  describe('getSpreadsheetById', () => {
    it('should open spreadsheet by ID using SpreadsheetApp', () => {
      const mockSpreadsheet = { getId: jest.fn(() => 'test-id') };
      global.SpreadsheetApp = {
        openById: jest.fn().mockReturnValue(mockSpreadsheet)
      };

      const result = SheetAccess.getSpreadsheetById('test-spreadsheet-id');

      expect(global.SpreadsheetApp.openById).toHaveBeenCalledWith('test-spreadsheet-id');
      expect(result).toBe(mockSpreadsheet);
    });
  });

  // ========================================================================
  // Typed Accessors - Returns validated, strongly-typed data
  // ========================================================================

  describe('getActiveMembers', () => {
    beforeEach(() => {
      // Reset mocks for each test
      jest.clearAllMocks();
    });

    it('should return validated members for valid data', () => {
      const joined = new Date('2023-01-15');
      const expires = new Date('2024-01-15');
      
      const values = [
        ['Status', 'Email', 'First', 'Last', 'Phone', 'Joined', 'Expires', 'Period', 'Directory Share Name', 'Directory Share Email', 'Directory Share Phone', 'Renewed On'],
        ['Active', 'john@example.com', 'John', 'Doe', '555-1234', joined, expires, 12, true, false, true, null],
        ['Active', 'jane@example.com', 'Jane', 'Smith', '555-5678', joined, expires, 12, false, true, false, null]
      ];
      
      const { sheet } = createMockSheet(values);
      SpreadsheetManager.getSheet.mockReturnValue(sheet);

      const result = SheetAccess.getActiveMembers();

      expect(SpreadsheetManager.getSheet).toHaveBeenCalledWith('ActiveMembers');
      expect(result).toHaveLength(2);
      expect(result[0].Email).toBe('john@example.com');
      expect(result[1].Email).toBe('jane@example.com');
      expect(result[0]).toBeInstanceOf(ValidatedMember);
      expect(result[1]).toBeInstanceOf(ValidatedMember);
    });

    it('should filter invalid rows and send alert email', () => {
      const joined = new Date('2023-01-15');
      const expires = new Date('2024-01-15');
      
      const values = [
        ['Status', 'Email', 'First', 'Last', 'Phone', 'Joined', 'Expires', 'Period', 'Directory Share Name', 'Directory Share Email', 'Directory Share Phone', 'Renewed On'],
        ['Active', 'john@example.com', 'John', 'Doe', '555-1234', joined, expires, 12, true, false, true, null],
        ['Active', 'invalid-email', 'Jane', 'Smith', '555-5678', joined, expires, 12, false, true, false, null], // Invalid email
        ['Active', 'bob@example.com', 'Bob', '', '555-9999', joined, expires, 12, false, false, false, null] // Missing last name
      ];
      
      const { sheet } = createMockSheet(values);
      SpreadsheetManager.getSheet.mockReturnValue(sheet);

      const result = SheetAccess.getActiveMembers();

      // Only valid member returned
      expect(result).toHaveLength(1);
      expect(result[0].Email).toBe('john@example.com');
      
      // Alert email should have been sent
      expect(global.MailApp.sendEmail).toHaveBeenCalledTimes(1);
      expect(global.MailApp.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'membership-automation@sc3.club',
          subject: expect.stringContaining('ALERT: 2 Member Validation Error')
        })
      );
    });

    it('should return empty array for empty sheet', () => {
      const values = [];
      const { sheet } = createMockSheet(values);
      SpreadsheetManager.getSheet.mockReturnValue(sheet);

      const result = SheetAccess.getActiveMembers();

      expect(result).toEqual([]);
    });

    it('should return empty array for sheet with only headers', () => {
      const values = [
        ['Status', 'Email', 'First', 'Last', 'Phone', 'Joined', 'Expires', 'Period', 'Directory Share Name', 'Directory Share Email', 'Directory Share Phone', 'Renewed On']
      ];
      const { sheet } = createMockSheet(values);
      SpreadsheetManager.getSheet.mockReturnValue(sheet);

      const result = SheetAccess.getActiveMembers();

      expect(result).toEqual([]);
      expect(global.MailApp.sendEmail).not.toHaveBeenCalled();
    });
  });
});
