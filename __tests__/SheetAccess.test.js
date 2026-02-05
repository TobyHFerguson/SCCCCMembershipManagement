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
});
