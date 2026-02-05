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
});
