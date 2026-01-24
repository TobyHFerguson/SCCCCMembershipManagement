// @ts-check
/**
 * Test suite for SheetAccess
 * Tests the abstraction layer for spreadsheet operations
 * 
 * Table of Contents:
 * 1. getData - Get data as array of row objects
 * 2. getDataAsArrays - Get data as 2D arrays
 * 3. getDataWithFormulas - Get data with formulas preserved
 * 4. setData - Write data to sheet
 * 5. appendRows - Append rows to end of sheet
 * 6. updateRows - Update specific rows
 * 7. convertLinks - Convert rich text links to formulas
 * 8. clearCache - Clear cached data
 * 9. getSheet - Get raw Sheet object
 * 10. getFiddler - Get Fiddler instance (backward compatibility)
 */

// Mock SpreadsheetManager before requiring SheetAccess
const mockFiddler = {
  getData: jest.fn(),
  setData: jest.fn().mockReturnThis(),
  dumpValues: jest.fn(),
  needFormulas: jest.fn().mockReturnThis(),
  getFormulaData: jest.fn()
};

const mockSheet = {
  getDataRange: jest.fn(),
  getLastRow: jest.fn(),
  getRange: jest.fn()
};

const mockRange = {
  getValues: jest.fn(),
  setValues: jest.fn()
};

// Create mock SpreadsheetManager as global
global.SpreadsheetManager = {
  getFiddler: jest.fn(),
  getSheet: jest.fn(),
  getDataWithFormulas: jest.fn(),
  convertLinks: jest.fn(),
  clearFiddlerCache: jest.fn()
};

const { SheetAccess } = require('../src/common/data/SheetAccess.js');

describe('SheetAccess', () => {
  const SpreadsheetManager = global.SpreadsheetManager;
  
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getData', () => {
    it('should get data from Fiddler as array of row objects', () => {
      const mockData = [
        { First: 'John', Last: 'Doe', Email: 'john@example.com' },
        { First: 'Jane', Last: 'Smith', Email: 'jane@example.com' }
      ];
      
      SpreadsheetManager.getFiddler.mockReturnValue(mockFiddler);
      mockFiddler.getData.mockReturnValue(mockData);

      const result = SheetAccess.getData('ActiveMembers');

      expect(SpreadsheetManager.getFiddler).toHaveBeenCalledWith('ActiveMembers');
      expect(mockFiddler.getData).toHaveBeenCalled();
      expect(result).toEqual(mockData);
    });

    it('should return empty array when sheet has no data', () => {
      SpreadsheetManager.getFiddler.mockReturnValue(mockFiddler);
      mockFiddler.getData.mockReturnValue([]);

      const result = SheetAccess.getData('EmptySheet');

      expect(result).toEqual([]);
    });
  });

  describe('getDataAsArrays', () => {
    it('should get data as 2D array with headers', () => {
      const mockData = [
        ['First', 'Last', 'Email'],
        ['John', 'Doe', 'john@example.com'],
        ['Jane', 'Smith', 'jane@example.com']
      ];
      
      mockSheet.getDataRange.mockReturnValue(mockRange);
      mockRange.getValues.mockReturnValue(mockData);
      SpreadsheetManager.getSheet.mockReturnValue(mockSheet);

      const result = SheetAccess.getDataAsArrays('ActiveMembers');

      expect(SpreadsheetManager.getSheet).toHaveBeenCalledWith('ActiveMembers');
      expect(mockSheet.getDataRange).toHaveBeenCalled();
      expect(mockRange.getValues).toHaveBeenCalled();
      expect(result).toEqual(mockData);
    });

    it('should return empty 2D array when sheet is empty', () => {
      mockSheet.getDataRange.mockReturnValue(mockRange);
      mockRange.getValues.mockReturnValue([]);
      SpreadsheetManager.getSheet.mockReturnValue(mockSheet);

      const result = SheetAccess.getDataAsArrays('EmptySheet');

      expect(result).toEqual([]);
    });
  });

  describe('getDataWithFormulas', () => {
    it('should get data with formulas merged in', () => {
      const mockData = [
        { Name: 'John', Link: 'https://example.com' }
      ];
      
      SpreadsheetManager.getFiddler.mockReturnValue(mockFiddler);
      SpreadsheetManager.getDataWithFormulas.mockReturnValue(mockData);

      const result = SheetAccess.getDataWithFormulas('ActionSpecs');

      expect(SpreadsheetManager.getFiddler).toHaveBeenCalledWith('ActionSpecs');
      expect(SpreadsheetManager.getDataWithFormulas).toHaveBeenCalledWith(mockFiddler);
      expect(result).toEqual(mockData);
    });
  });

  describe('setData', () => {
    it('should write data to sheet and clear cache', () => {
      const mockData = [
        { First: 'John', Last: 'Doe' }
      ];
      
      SpreadsheetManager.getFiddler.mockReturnValue(mockFiddler);

      SheetAccess.setData('ActiveMembers', mockData);

      expect(SpreadsheetManager.getFiddler).toHaveBeenCalledWith('ActiveMembers');
      expect(mockFiddler.setData).toHaveBeenCalledWith(mockData);
      expect(mockFiddler.dumpValues).toHaveBeenCalled();
      expect(SpreadsheetManager.clearFiddlerCache).toHaveBeenCalledWith('ActiveMembers');
    });

    it('should handle empty data array', () => {
      SpreadsheetManager.getFiddler.mockReturnValue(mockFiddler);

      SheetAccess.setData('ActiveMembers', []);

      expect(mockFiddler.setData).toHaveBeenCalledWith([]);
      expect(mockFiddler.dumpValues).toHaveBeenCalled();
      expect(SpreadsheetManager.clearFiddlerCache).toHaveBeenCalledWith('ActiveMembers');
    });
  });

  describe('appendRows', () => {
    it('should append rows to end of sheet', () => {
      const mockRows = [
        ['John', 'Doe', 'john@example.com'],
        ['Jane', 'Smith', 'jane@example.com']
      ];
      
      mockSheet.getLastRow.mockReturnValue(10);
      mockSheet.getRange.mockReturnValue(mockRange);
      SpreadsheetManager.getSheet.mockReturnValue(mockSheet);

      SheetAccess.appendRows('ActiveMembers', mockRows);

      expect(SpreadsheetManager.getSheet).toHaveBeenCalledWith('ActiveMembers');
      expect(mockSheet.getLastRow).toHaveBeenCalled();
      expect(mockSheet.getRange).toHaveBeenCalledWith(11, 1, 2, 3); // lastRow+1, col 1, 2 rows, 3 cols
      expect(mockRange.setValues).toHaveBeenCalledWith(mockRows);
    });

    it('should handle empty rows array', () => {
      SpreadsheetManager.getSheet.mockReturnValue(mockSheet);

      SheetAccess.appendRows('ActiveMembers', []);

      expect(mockSheet.getLastRow).not.toHaveBeenCalled();
    });

    it('should handle null rows', () => {
      SpreadsheetManager.getSheet.mockReturnValue(mockSheet);

      SheetAccess.appendRows('ActiveMembers', null);

      expect(mockSheet.getLastRow).not.toHaveBeenCalled();
    });
  });

  describe('updateRows', () => {
    it('should update specific rows in sheet', () => {
      const mockRows = [
        ['John', 'Doe', 'john@example.com']
      ];
      
      mockSheet.getRange.mockReturnValue(mockRange);
      SpreadsheetManager.getSheet.mockReturnValue(mockSheet);

      SheetAccess.updateRows('ActiveMembers', mockRows, 5);

      expect(SpreadsheetManager.getSheet).toHaveBeenCalledWith('ActiveMembers');
      expect(mockSheet.getRange).toHaveBeenCalledWith(5, 1, 1, 3); // row 5, col 1, 1 row, 3 cols
      expect(mockRange.setValues).toHaveBeenCalledWith(mockRows);
    });

    it('should handle multiple rows', () => {
      const mockRows = [
        ['John', 'Doe', 'john@example.com'],
        ['Jane', 'Smith', 'jane@example.com']
      ];
      
      mockSheet.getRange.mockReturnValue(mockRange);
      SpreadsheetManager.getSheet.mockReturnValue(mockSheet);

      SheetAccess.updateRows('ActiveMembers', mockRows, 10);

      expect(mockSheet.getRange).toHaveBeenCalledWith(10, 1, 2, 3); // row 10, col 1, 2 rows, 3 cols
      expect(mockRange.setValues).toHaveBeenCalledWith(mockRows);
    });

    it('should handle empty rows array', () => {
      SpreadsheetManager.getSheet.mockReturnValue(mockSheet);

      SheetAccess.updateRows('ActiveMembers', [], 5);

      expect(mockSheet.getRange).not.toHaveBeenCalled();
    });

    it('should handle null rows', () => {
      SpreadsheetManager.getSheet.mockReturnValue(mockSheet);

      SheetAccess.updateRows('ActiveMembers', null, 5);

      expect(mockSheet.getRange).not.toHaveBeenCalled();
    });
  });

  describe('convertLinks', () => {
    it('should convert rich text links to hyperlink formulas', () => {
      SheetAccess.convertLinks('ActionSpecs');

      expect(SpreadsheetManager.convertLinks).toHaveBeenCalledWith('ActionSpecs');
    });
  });

  describe('clearCache', () => {
    it('should clear cache for specific sheet', () => {
      SheetAccess.clearCache('ActiveMembers');

      expect(SpreadsheetManager.clearFiddlerCache).toHaveBeenCalledWith('ActiveMembers');
    });

    it('should clear cache for all sheets when no sheet specified', () => {
      SheetAccess.clearCache();

      expect(SpreadsheetManager.clearFiddlerCache).toHaveBeenCalledWith(undefined);
    });
  });

  describe('getSheet', () => {
    it('should get raw Sheet object', () => {
      SpreadsheetManager.getSheet.mockReturnValue(mockSheet);

      const result = SheetAccess.getSheet('ActiveMembers');

      expect(SpreadsheetManager.getSheet).toHaveBeenCalledWith('ActiveMembers');
      expect(result).toBe(mockSheet);
    });
  });

  describe('getFiddler', () => {
    it('should get Fiddler instance for backward compatibility', () => {
      SpreadsheetManager.getFiddler.mockReturnValue(mockFiddler);

      const result = SheetAccess.getFiddler('ActiveMembers');

      expect(SpreadsheetManager.getFiddler).toHaveBeenCalledWith('ActiveMembers');
      expect(result).toBe(mockFiddler);
    });
  });

  describe('Integration patterns', () => {
    it('should support convertLinks before getDataWithFormulas pattern', () => {
      const mockData = [
        { Body: '=HYPERLINK("https://example.com", "Link")' }
      ];
      
      SpreadsheetManager.getFiddler.mockReturnValue(mockFiddler);
      SpreadsheetManager.getDataWithFormulas.mockReturnValue(mockData);

      // Pattern: convertLinks then getDataWithFormulas
      SheetAccess.convertLinks('ActionSpecs');
      const result = SheetAccess.getDataWithFormulas('ActionSpecs');

      expect(SpreadsheetManager.convertLinks).toHaveBeenCalledWith('ActionSpecs');
      expect(SpreadsheetManager.getDataWithFormulas).toHaveBeenCalled();
      expect(result).toEqual(mockData);
    });

    it('should support read-modify-write pattern with cache clearing', () => {
      const originalData = [
        { Name: 'John', Count: 5 }
      ];
      const updatedData = [
        { Name: 'John', Count: 6 }
      ];
      
      SpreadsheetManager.getFiddler.mockReturnValue(mockFiddler);
      mockFiddler.getData.mockReturnValueOnce(originalData);

      // Read
      const data = SheetAccess.getData('TestSheet');
      expect(data).toEqual(originalData);

      // Modify
      data[0].Count = 6;

      // Write (clears cache automatically)
      SheetAccess.setData('TestSheet', data);
      expect(mockFiddler.setData).toHaveBeenCalledWith(data);
      expect(mockFiddler.dumpValues).toHaveBeenCalled();
      expect(SpreadsheetManager.clearFiddlerCache).toHaveBeenCalledWith('TestSheet');
    });
  });
});
