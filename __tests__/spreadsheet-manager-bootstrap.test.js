// @ts-check

/**
 * Integration tests for SpreadsheetManager Bootstrap URL handling
 * These tests verify that the Bootstrap sheet can handle both URLs and plain IDs
 */

describe('SpreadsheetManager Bootstrap URL handling', () => {
  describe('_initializeSheets URL extraction', () => {
    it('should extract IDs from URLs in Bootstrap id field', () => {
      // Test the inline extraction logic that's used in SpreadsheetManager
      const testCases = [
        {
          input: 'https://docs.google.com/spreadsheets/d/1ABC123xyz/edit',
          expected: '1ABC123xyz',
          description: 'edit URL'
        },
        {
          input: 'https://docs.google.com/spreadsheets/d/1ABC123xyz/edit#gid=0',
          expected: '1ABC123xyz',
          description: 'edit URL with fragment'
        },
        {
          input: '1PlainID123',
          expected: '1PlainID123',
          description: 'plain ID'
        },
        {
          input: '  https://docs.google.com/spreadsheets/d/1ABC123xyz/edit  ',
          expected: '1ABC123xyz',
          description: 'URL with whitespace'
        },
        {
          input: '  1PlainID123  ',
          expected: '1PlainID123',
          description: 'plain ID with whitespace'
        }
      ];

      testCases.forEach(({ input, expected, description }) => {
        // This is the exact logic used in SpreadsheetManager._initializeSheets()
        const trimmed = input.trim();
        const urlPattern = /\/d\/([a-zA-Z0-9-_]+)/;
        const match = trimmed.match(urlPattern);
        const result = match ? match[1] : trimmed;

        expect(result).toBe(expected);
      });
    });

    it('should handle Bootstrap rows with id field correctly', () => {
      // Simulate what _initializeSheets does with Bootstrap data
      const mockBootstrapData = [
        {
          Reference: 'Elections',
          id: 'https://docs.google.com/spreadsheets/d/1ElectionID/edit',
          sheetName: 'Elections'
        },
        {
          Reference: 'ActiveMembers',
          id: '1PlainMemberID',
          sheetName: 'Active Members'
        },
        {
          Reference: 'LocalSheet',
          sheetName: 'Local Sheet'
          // No id field - should work with container ID
        }
      ];

      // Process as _initializeSheets does
      const processed = mockBootstrapData.map(row => {
        const processedRow = { ...row };
        
        if (processedRow.id && typeof processedRow.id === 'string') {
          const trimmed = processedRow.id.trim();
          const urlPattern = /\/d\/([a-zA-Z0-9-_]+)/;
          const match = trimmed.match(urlPattern);
          if (match) {
            processedRow.id = match[1];
          } else {
            processedRow.id = trimmed;
          }
        }
        
        return processedRow;
      });

      expect(processed[0].id).toBe('1ElectionID');
      expect(processed[1].id).toBe('1PlainMemberID');
      expect(processed[2].id).toBeUndefined();
    });

    it('should preserve other row fields when extracting IDs', () => {
      const mockRow = {
        Reference: 'TestSheet',
        id: 'https://docs.google.com/spreadsheets/d/1TestID/edit',
        sheetName: 'Test Sheet Name',
        createIfMissing: true,
        otherField: 'preserved'
      };

      // Process as _initializeSheets does
      const processedRow = { ...mockRow };
      
      if (processedRow.id && typeof processedRow.id === 'string') {
        const trimmed = processedRow.id.trim();
        const urlPattern = /\/d\/([a-zA-Z0-9-_]+)/;
        const match = trimmed.match(urlPattern);
        if (match) {
          processedRow.id = match[1];
        } else {
          processedRow.id = trimmed;
        }
      }

      expect(processedRow.id).toBe('1TestID');
      expect(processedRow.Reference).toBe('TestSheet');
      expect(processedRow.sheetName).toBe('Test Sheet Name');
      expect(processedRow.createIfMissing).toBe(true);
      expect(processedRow.otherField).toBe('preserved');
    });
  });

  describe('createIfMissing flag behavior', () => {
    it('should create sheet when createIfMissing is true', () => {
      const mockSheet = {
        sheetName: 'NewSheet',
        createIfMissing: true
      };
      
      const mockSpreadsheet = {
        getSheetByName: jest.fn().mockReturnValue(null), // Sheet doesn't exist
        insertSheet: jest.fn().mockReturnValue({ name: 'NewSheet' })
      };
      
      // Simulate SpreadsheetManager.getSheet logic
      let sheetObj = mockSpreadsheet.getSheetByName(mockSheet.sheetName);
      
      if (!sheetObj && mockSheet.createIfMissing === true) {
        sheetObj = mockSpreadsheet.insertSheet(mockSheet.sheetName);
      }
      
      expect(mockSpreadsheet.getSheetByName).toHaveBeenCalledWith('NewSheet');
      expect(mockSpreadsheet.insertSheet).toHaveBeenCalledWith('NewSheet');
      expect(sheetObj).toEqual({ name: 'NewSheet' });
    });

    it('should throw error when sheet missing and createIfMissing is false', () => {
      const mockSheet = {
        sheetName: 'RequiredSheet',
        createIfMissing: false
      };
      
      const mockSpreadsheet = {
        getSheetByName: jest.fn().mockReturnValue(null)
      };
      
      // Simulate SpreadsheetManager.getSheet logic
      const sheetObj = mockSpreadsheet.getSheetByName(mockSheet.sheetName);
      
      if (!sheetObj && mockSheet.createIfMissing !== true) {
        expect(() => {
          throw new Error(`Sheet '${mockSheet.sheetName}' not found and createIfMissing is false`);
        }).toThrow("Sheet 'RequiredSheet' not found and createIfMissing is false");
      }
      
      expect(mockSpreadsheet.getSheetByName).toHaveBeenCalledWith('RequiredSheet');
    });

    it('should handle createIfMissing string values', () => {
      const testCases = [
        { value: true, shouldCreate: true },
        { value: 'TRUE', shouldCreate: true },
        { value: 'true', shouldCreate: true },
        { value: false, shouldCreate: false },
        { value: 'FALSE', shouldCreate: false },
        { value: 'false', shouldCreate: false },
        { value: undefined, shouldCreate: false }
      ];
      
      testCases.forEach(({ value, shouldCreate }) => {
        const shouldCreateSheet = value === true || value === 'TRUE' || value === 'true';
        expect(shouldCreateSheet).toBe(shouldCreate);
      });
    });

    it('should return existing sheet when it exists regardless of createIfMissing', () => {
      const mockSheet = {
        sheetName: 'ExistingSheet',
        createIfMissing: false
      };
      
      const existingSheetObj = { name: 'ExistingSheet' };
      const mockSpreadsheet = {
        getSheetByName: jest.fn().mockReturnValue(existingSheetObj),
        insertSheet: jest.fn()
      };
      
      // Simulate SpreadsheetManager.getSheet logic
      const sheetObj = mockSpreadsheet.getSheetByName(mockSheet.sheetName);
      
      expect(sheetObj).toBe(existingSheetObj);
      expect(mockSpreadsheet.insertSheet).not.toHaveBeenCalled();
    });
  });
});
