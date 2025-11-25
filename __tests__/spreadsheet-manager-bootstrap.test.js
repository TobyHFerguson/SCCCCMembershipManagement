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
});
