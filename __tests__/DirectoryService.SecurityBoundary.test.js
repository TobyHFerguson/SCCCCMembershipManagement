// @ts-check
/**
 * Test suite for DirectoryService Security Boundary
 * Tests the getDirectoryEntries function which is the critical security
 * boundary ensuring only public data reaches the client.
 * 
 * Architecture: DirectoryService.getDirectoryEntries is a GAS-layer function
 * that filters member data and returns ONLY the four allowed fields.
 */

// Mock GAS globals before imports
global.SpreadsheetApp = {
  getActiveSpreadsheet: jest.fn(() => ({ getId: () => 'mock-id' }))
};
global.ScriptApp = {
  getService: jest.fn(() => ({ getUrl: () => 'mock-url' }))
};

// Mock Common.Data.Access
const mockMembers = [];

// Mock DataAccess (flat class pattern)
global.DataAccess = {
  getMembers: jest.fn(() => mockMembers)
};

// Mock Common namespace (backward compatibility)
global.Common = {
  Data: {
    Access: global.DataAccess
  }
};

const { getDirectoryEntries } = require('../src/services/DirectoryService/DirectoryApp');

describe('DirectoryService.getDirectoryEntries - Security Boundary', () => {
  beforeEach(() => {
    // Clear mock data before each test
    mockMembers.length = 0;
    jest.clearAllMocks();
  });

  describe('Active member filtering', () => {
    it('should only return Active members', () => {
      mockMembers.push(
        { First: 'Active', Last: 'User', Status: 'Active', 'Directory Share Name': true, Email: 'active@test.com', Phone: '123' },
        { First: 'Inactive', Last: 'User', Status: 'Inactive', 'Directory Share Name': true, Email: 'inactive@test.com', Phone: '456' },
        { First: 'Expired', Last: 'User', Status: 'Expired', 'Directory Share Name': true, Email: 'expired@test.com', Phone: '789' }
      );

      const result = getDirectoryEntries();

      expect(result).toHaveLength(1);
      expect(result[0].First).toBe('Active');
    });
  });

  describe('Directory Share Name filtering', () => {
    it('should only return members with Directory Share Name = true', () => {
      mockMembers.push(
        { First: 'Sharing', Last: 'User', Status: 'Active', 'Directory Share Name': true, Email: 'sharing@test.com', Phone: '123' },
        { First: 'NotSharing', Last: 'User', Status: 'Active', 'Directory Share Name': false, Email: 'not@test.com', Phone: '456' },
        { First: 'NoValue', Last: 'User', Status: 'Active', 'Directory Share Name': '', Email: 'no@test.com', Phone: '789' }
      );

      const result = getDirectoryEntries();

      expect(result).toHaveLength(1);
      expect(result[0].First).toBe('Sharing');
    });

    it('should handle string "TRUE" for Directory Share Name', () => {
      mockMembers.push(
        { First: 'StringTrue', Last: 'User', Status: 'Active', 'Directory Share Name': 'TRUE', Email: 'test@test.com', Phone: '123' }
      );

      const result = getDirectoryEntries();

      expect(result).toHaveLength(1);
      expect(result[0].First).toBe('StringTrue');
    });

    it('should handle string "true" for Directory Share Name', () => {
      mockMembers.push(
        { First: 'StringLowerTrue', Last: 'User', Status: 'Active', 'Directory Share Name': 'true', Email: 'test@test.com', Phone: '123' }
      );

      const result = getDirectoryEntries();

      expect(result).toHaveLength(1);
      expect(result[0].First).toBe('StringLowerTrue');
    });
  });

  describe('Email privacy settings', () => {
    it('should include email when Directory Share Email = true', () => {
      mockMembers.push({
        First: 'John',
        Last: 'Doe',
        Status: 'Active',
        'Directory Share Name': true,
        'Directory Share Email': true,
        Email: 'john@test.com',
        Phone: '1234567890'
      });

      const result = getDirectoryEntries();

      expect(result[0].email).toBe('john@test.com');
    });

    it('should exclude email when Directory Share Email = false', () => {
      mockMembers.push({
        First: 'Jane',
        Last: 'Doe',
        Status: 'Active',
        'Directory Share Name': true,
        'Directory Share Email': false,
        Email: 'jane@test.com',
        Phone: '1234567890'
      });

      const result = getDirectoryEntries();

      expect(result[0].email).toBe('');
    });

    it('should exclude email when Directory Share Email is empty string', () => {
      mockMembers.push({
        First: 'Bob',
        Last: 'Smith',
        Status: 'Active',
        'Directory Share Name': true,
        'Directory Share Email': '',
        Email: 'bob@test.com',
        Phone: '1234567890'
      });

      const result = getDirectoryEntries();

      expect(result[0].email).toBe('');
    });

    it('should handle string "TRUE" for Directory Share Email', () => {
      mockMembers.push({
        First: 'Alice',
        Last: 'Jones',
        Status: 'Active',
        'Directory Share Name': true,
        'Directory Share Email': 'TRUE',
        Email: 'alice@test.com',
        Phone: '1234567890'
      });

      const result = getDirectoryEntries();

      expect(result[0].email).toBe('alice@test.com');
    });
  });

  describe('Phone privacy settings', () => {
    it('should include phone when Directory Share Phone = true', () => {
      mockMembers.push({
        First: 'John',
        Last: 'Doe',
        Status: 'Active',
        'Directory Share Name': true,
        'Directory Share Phone': true,
        Email: 'john@test.com',
        Phone: '1234567890'
      });

      const result = getDirectoryEntries();

      expect(result[0].phone).toBe('1234567890');
    });

    it('should exclude phone when Directory Share Phone = false', () => {
      mockMembers.push({
        First: 'Jane',
        Last: 'Doe',
        Status: 'Active',
        'Directory Share Name': true,
        'Directory Share Phone': false,
        Email: 'jane@test.com',
        Phone: '1234567890'
      });

      const result = getDirectoryEntries();

      expect(result[0].phone).toBe('');
    });

    it('should handle string "TRUE" for Directory Share Phone', () => {
      mockMembers.push({
        First: 'Alice',
        Last: 'Jones',
        Status: 'Active',
        'Directory Share Name': true,
        'Directory Share Phone': 'TRUE',
        Email: 'alice@test.com',
        Phone: '1234567890'
      });

      const result = getDirectoryEntries();

      expect(result[0].phone).toBe('1234567890');
    });
  });

  describe('SECURITY: Only four fields returned', () => {
    it('should return ONLY First, Last, email, phone fields', () => {
      mockMembers.push({
        First: 'John',
        Last: 'Doe',
        Status: 'Active',
        'Directory Share Name': true,
        'Directory Share Email': true,
        'Directory Share Phone': true,
        Email: 'john@test.com',
        Phone: '1234567890',
        // These should NOT appear in output
        SSN: '123-45-6789',
        CreditCard: '4111111111111111',
        HomeAddress: '123 Private St',
        Notes: 'Sensitive information'
      });

      const result = getDirectoryEntries();

      expect(result[0]).toEqual({
        First: 'John',
        Last: 'Doe',
        email: 'john@test.com',
        phone: '1234567890'
      });

      // Verify no other fields leaked
      expect(result[0]).not.toHaveProperty('SSN');
      expect(result[0]).not.toHaveProperty('CreditCard');
      expect(result[0]).not.toHaveProperty('HomeAddress');
      expect(result[0]).not.toHaveProperty('Notes');
      expect(result[0]).not.toHaveProperty('Status');
      expect(result[0]).not.toHaveProperty('Directory Share Name');
    });
  });

  describe('Edge cases and data quality', () => {
    it('should handle missing First name', () => {
      mockMembers.push({
        Last: 'Doe',
        Status: 'Active',
        'Directory Share Name': true,
        Email: 'john@test.com',
        Phone: '1234567890'
      });

      const result = getDirectoryEntries();

      expect(result[0].First).toBe('');
    });

    it('should handle missing Last name', () => {
      mockMembers.push({
        First: 'John',
        Status: 'Active',
        'Directory Share Name': true,
        Email: 'john@test.com',
        Phone: '1234567890'
      });

      const result = getDirectoryEntries();

      expect(result[0].Last).toBe('');
    });

    it('should handle missing Email when sharing is enabled', () => {
      mockMembers.push({
        First: 'John',
        Last: 'Doe',
        Status: 'Active',
        'Directory Share Name': true,
        'Directory Share Email': true,
        Phone: '1234567890'
      });

      const result = getDirectoryEntries();

      expect(result[0].email).toBe('');
    });

    it('should handle missing Phone when sharing is enabled', () => {
      mockMembers.push({
        First: 'John',
        Last: 'Doe',
        Status: 'Active',
        'Directory Share Name': true,
        'Directory Share Phone': true,
        Email: 'john@test.com'
      });

      const result = getDirectoryEntries();

      expect(result[0].phone).toBe('');
    });

    it('should return empty array when no members exist', () => {
      const result = getDirectoryEntries();

      expect(result).toEqual([]);
    });

    it('should return empty array when no members meet criteria', () => {
      mockMembers.push(
        { First: 'Inactive', Last: 'User', Status: 'Inactive', 'Directory Share Name': true },
        { First: 'NotSharing', Last: 'User', Status: 'Active', 'Directory Share Name': false }
      );

      const result = getDirectoryEntries();

      expect(result).toEqual([]);
    });
  });

  describe('Complex scenarios', () => {
    it('should handle mixed privacy settings correctly', () => {
      mockMembers.push(
        {
          First: 'Public',
          Last: 'Person',
          Status: 'Active',
          'Directory Share Name': true,
          'Directory Share Email': true,
          'Directory Share Phone': true,
          Email: 'public@test.com',
          Phone: '1111111111'
        },
        {
          First: 'Semi',
          Last: 'Private',
          Status: 'Active',
          'Directory Share Name': true,
          'Directory Share Email': true,
          'Directory Share Phone': false,
          Email: 'semi@test.com',
          Phone: '2222222222'
        },
        {
          First: 'Very',
          Last: 'Private',
          Status: 'Active',
          'Directory Share Name': true,
          'Directory Share Email': false,
          'Directory Share Phone': false,
          Email: 'private@test.com',
          Phone: '3333333333'
        }
      );

      const result = getDirectoryEntries();

      expect(result).toHaveLength(3);
      
      expect(result[0]).toEqual({
        First: 'Public',
        Last: 'Person',
        email: 'public@test.com',
        phone: '1111111111'
      });
      
      expect(result[1]).toEqual({
        First: 'Semi',
        Last: 'Private',
        email: 'semi@test.com',
        phone: ''
      });
      
      expect(result[2]).toEqual({
        First: 'Very',
        Last: 'Private',
        email: '',
        phone: ''
      });
    });
  });
});
