// @ts-check

if (typeof require !== 'undefined') {
  var { Utils } = require('../src/common/utils/Utils');
}

describe('Common.Utils.extractSpreadsheetId', () => {
  const validId = '1ABC-xyz_123456789';

  describe('should extract ID from various Google Sheets URL formats', () => {
    it('should extract from edit URL', () => {
      const url = `https://docs.google.com/spreadsheets/d/${validId}/edit`;
      expect(Utils.extractSpreadsheetId(url)).toBe(validId);
    });

    it('should extract from edit URL with #gid parameter', () => {
      const url = `https://docs.google.com/spreadsheets/d/${validId}/edit#gid=0`;
      expect(Utils.extractSpreadsheetId(url)).toBe(validId);
    });

    it('should extract from edit URL with usp parameter', () => {
      const url = `https://docs.google.com/spreadsheets/d/${validId}/edit?usp=sharing`;
      expect(Utils.extractSpreadsheetId(url)).toBe(validId);
    });

    it('should extract from edit URL with both query and fragment', () => {
      const url = `https://docs.google.com/spreadsheets/d/${validId}/edit?usp=sharing#gid=123`;
      expect(Utils.extractSpreadsheetId(url)).toBe(validId);
    });

    it('should extract from copy URL', () => {
      const url = `https://docs.google.com/spreadsheets/d/${validId}/copy`;
      expect(Utils.extractSpreadsheetId(url)).toBe(validId);
    });

    it('should extract from view URL', () => {
      const url = `https://docs.google.com/spreadsheets/d/${validId}/view`;
      expect(Utils.extractSpreadsheetId(url)).toBe(validId);
    });

    it('should extract from URL with trailing slash', () => {
      const url = `https://docs.google.com/spreadsheets/d/${validId}/`;
      expect(Utils.extractSpreadsheetId(url)).toBe(validId);
    });

    it('should extract from URL without trailing component', () => {
      const url = `https://docs.google.com/spreadsheets/d/${validId}`;
      expect(Utils.extractSpreadsheetId(url)).toBe(validId);
    });
  });

  describe('should return the input unchanged if it is already an ID', () => {
    it('should return plain ID as-is', () => {
      expect(Utils.extractSpreadsheetId(validId)).toBe(validId);
    });

    it('should handle ID with hyphens', () => {
      const idWithHyphen = '1ABC-xyz_123-456';
      expect(Utils.extractSpreadsheetId(idWithHyphen)).toBe(idWithHyphen);
    });

    it('should handle ID with underscores', () => {
      const idWithUnderscore = '1ABC_xyz_123_456';
      expect(Utils.extractSpreadsheetId(idWithUnderscore)).toBe(idWithUnderscore);
    });
  });

  describe('should handle edge cases', () => {
    it('should handle null', () => {
      expect(Utils.extractSpreadsheetId(null)).toBeNull();
    });

    it('should handle undefined', () => {
      expect(Utils.extractSpreadsheetId(undefined)).toBeUndefined();
    });

    it('should handle empty string', () => {
      expect(Utils.extractSpreadsheetId('')).toBe('');
    });

    it('should handle whitespace-only string', () => {
      expect(Utils.extractSpreadsheetId('   ')).toBe('   ');
    });

    it('should handle invalid URL format', () => {
      const invalidUrl = 'https://example.com/some/path';
      expect(Utils.extractSpreadsheetId(invalidUrl)).toBe(invalidUrl);
    });

    it('should handle URL with trimmed whitespace', () => {
      const url = `  https://docs.google.com/spreadsheets/d/${validId}/edit  `;
      expect(Utils.extractSpreadsheetId(url)).toBe(validId);
    });
  });

  describe('should handle other Google Docs URLs', () => {
    it('should extract from Google Forms URL', () => {
      const formId = '1FormID123abc';
      const url = `https://docs.google.com/forms/d/${formId}/edit`;
      expect(Utils.extractSpreadsheetId(url)).toBe(formId);
    });

    it('should extract from Google Docs document URL', () => {
      const docId = '1DocID123abc';
      const url = `https://docs.google.com/document/d/${docId}/edit`;
      expect(Utils.extractSpreadsheetId(url)).toBe(docId);
    });

    it('should extract from Google Slides URL', () => {
      const slideId = '1SlideID123abc';
      const url = `https://docs.google.com/presentation/d/${slideId}/edit`;
      expect(Utils.extractSpreadsheetId(url)).toBe(slideId);
    });
  });
});
