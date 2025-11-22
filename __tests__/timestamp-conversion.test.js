/**
 * @jest-environment node
 */

if (typeof require !== 'undefined') {
  var MembershipManagement = require('../src/services/MembershipManagement/utils');
}

describe('Timestamp conversion utilities', () => {
  describe('isoToSpreadsheetDate', () => {
    it('converts ISO string to Date object', () => {
      const isoString = '2025-11-21T10:30:00.000Z';
      const result = MembershipManagement.Utils.isoToSpreadsheetDate(isoString);
      
      expect(result).toBeInstanceOf(Date);
      if (result instanceof Date) {
        expect(result.toISOString()).toBe(isoString);
      }
    });

    it('returns empty string for empty input', () => {
      expect(MembershipManagement.Utils.isoToSpreadsheetDate('')).toBe('');
      expect(MembershipManagement.Utils.isoToSpreadsheetDate(null)).toBe('');
      expect(MembershipManagement.Utils.isoToSpreadsheetDate(undefined)).toBe('');
    });

    it('handles different ISO formats', () => {
      const isoString = '2025-11-21T18:45:30.500Z';
      const result = MembershipManagement.Utils.isoToSpreadsheetDate(isoString);
      
      expect(result).toBeInstanceOf(Date);
      if (result instanceof Date) {
        expect(result.toISOString()).toBe(isoString);
      }
    });
  });

  describe('spreadsheetDateToIso', () => {
    it('converts Date object to ISO string', () => {
      const date = new Date('2025-11-21T10:30:00.000Z');
      const result = MembershipManagement.Utils.spreadsheetDateToIso(date);
      
      expect(result).toBe('2025-11-21T10:30:00.000Z');
    });

    it('returns empty string for empty input', () => {
      expect(MembershipManagement.Utils.spreadsheetDateToIso('')).toBe('');
      expect(MembershipManagement.Utils.spreadsheetDateToIso(null)).toBe('');
      expect(MembershipManagement.Utils.spreadsheetDateToIso(undefined)).toBe('');
    });

    it('handles string date representations', () => {
      const dateString = '2025-11-21T10:30:00.000Z';
      const result = MembershipManagement.Utils.spreadsheetDateToIso(dateString);
      
      expect(result).toBe('2025-11-21T10:30:00.000Z');
    });

    it('returns empty string for invalid date strings', () => {
      const result = MembershipManagement.Utils.spreadsheetDateToIso('not a date');
      expect(result).toBe('');
    });
  });

  describe('Round-trip conversion', () => {
    it('preserves timestamp through round-trip conversion', () => {
      const originalIso = '2025-11-21T10:30:00.000Z';
      
      // ISO -> Date -> ISO
      const date = MembershipManagement.Utils.isoToSpreadsheetDate(originalIso);
      const backToIso = MembershipManagement.Utils.spreadsheetDateToIso(date);
      
      expect(backToIso).toBe(originalIso);
    });

    it('preserves empty strings through round-trip', () => {
      const date = MembershipManagement.Utils.isoToSpreadsheetDate('');
      const backToIso = MembershipManagement.Utils.spreadsheetDateToIso(date);
      
      expect(date).toBe('');
      expect(backToIso).toBe('');
    });
  });

  describe('Integration with attempt logic', () => {
    it('converted dates work with attempt time calculations', () => {
      const isoString = '2025-11-21T10:30:00.000Z';
      const date = MembershipManagement.Utils.isoToSpreadsheetDate(isoString);
      
      // Simulate reading from spreadsheet and checking if attempt time has passed
      const now = new Date('2025-11-21T10:31:00.000Z');
      expect(date < now).toBe(true);
      
      const futureIso = '2025-11-21T10:35:00.000Z';
      const futureDate = MembershipManagement.Utils.isoToSpreadsheetDate(futureIso);
      expect(futureDate > now).toBe(true);
    });
  });
});
