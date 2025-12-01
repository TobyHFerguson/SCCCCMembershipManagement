// @ts-check
/**
 * Test suite for DirectoryService.Manager
 * Tests the pure business logic for directory management
 * 
 * Table of Contents:
 * 1. filterActiveMembers - Filter to active members only
 * 2. filterPublicMembers - Filter to members sharing name
 * 3. transformToDirectoryEntry - Transform single member to entry
 * 4. transformToDirectoryEntries - Transform array of members
 * 5. getDirectoryEntries - Main directory extraction
 * 6. filterBySearchTerm - Search filtering
 * 7. sortByName - Sorting entries
 * 8. processDirectory - Full processing pipeline
 * 9. validateSearchTerm - Search term validation
 * 10. getDirectoryStats - Directory statistics
 */

const { Manager } = require('../src/services/DirectoryService/Manager');

// Test data factories
const TestData = {
  createMember: (overrides = {}) => ({
    Status: 'Active',
    Email: 'test@example.com',
    First: 'John',
    Last: 'Doe',
    Phone: '(123) 456-7890',
    'Directory Share Name': true,
    'Directory Share Email': true,
    'Directory Share Phone': true,
    ...overrides
  }),

  createPublicMember: (overrides = {}) => TestData.createMember({
    'Directory Share Name': true,
    ...overrides
  }),

  createPrivateMember: (overrides = {}) => TestData.createMember({
    'Directory Share Name': false,
    'Directory Share Email': false,
    'Directory Share Phone': false,
    ...overrides
  }),

  createInactiveMember: (overrides = {}) => TestData.createMember({
    Status: 'Expired',
    ...overrides
  })
};

describe('DirectoryService.Manager', () => {

  // ==================== filterActiveMembers Tests ====================
  
  describe('filterActiveMembers', () => {
    test('filters to only active members', () => {
      const members = [
        TestData.createMember({ Status: 'Active', First: 'John' }),
        TestData.createMember({ Status: 'Expired', First: 'Jane' }),
        TestData.createMember({ Status: 'Active', First: 'Bob' })
      ];
      
      const result = Manager.filterActiveMembers(members);
      
      expect(result).toHaveLength(2);
      expect(result[0].First).toBe('John');
      expect(result[1].First).toBe('Bob');
    });

    test('returns empty array for empty input', () => {
      expect(Manager.filterActiveMembers([])).toEqual([]);
    });

    test('returns empty array for null input', () => {
      expect(Manager.filterActiveMembers(null)).toEqual([]);
    });

    test('returns empty array for undefined input', () => {
      expect(Manager.filterActiveMembers(undefined)).toEqual([]);
    });

    test('returns empty array for non-array input', () => {
      expect(Manager.filterActiveMembers('not an array')).toEqual([]);
    });

    test('handles null entries in array', () => {
      const members = [
        TestData.createMember({ Status: 'Active', First: 'John' }),
        null,
        TestData.createMember({ Status: 'Active', First: 'Jane' })
      ];
      
      const result = Manager.filterActiveMembers(members);
      
      expect(result).toHaveLength(2);
    });

    test('handles various inactive statuses', () => {
      const members = [
        TestData.createMember({ Status: 'Active' }),
        TestData.createMember({ Status: 'Expired' }),
        TestData.createMember({ Status: 'Suspended' }),
        TestData.createMember({ Status: 'Pending' })
      ];
      
      const result = Manager.filterActiveMembers(members);
      
      expect(result).toHaveLength(1);
      expect(result[0].Status).toBe('Active');
    });
  });

  // ==================== filterPublicMembers Tests ====================
  
  describe('filterPublicMembers', () => {
    test('filters to only members sharing name', () => {
      const members = [
        TestData.createMember({ 'Directory Share Name': true, First: 'John' }),
        TestData.createMember({ 'Directory Share Name': false, First: 'Jane' }),
        TestData.createMember({ 'Directory Share Name': true, First: 'Bob' })
      ];
      
      const result = Manager.filterPublicMembers(members);
      
      expect(result).toHaveLength(2);
      expect(result[0].First).toBe('John');
      expect(result[1].First).toBe('Bob');
    });

    test('returns empty array for empty input', () => {
      expect(Manager.filterPublicMembers([])).toEqual([]);
    });

    test('returns empty array for null input', () => {
      expect(Manager.filterPublicMembers(null)).toEqual([]);
    });

    test('handles undefined Directory Share Name as false', () => {
      const members = [
        TestData.createMember({ 'Directory Share Name': true }),
        { Status: 'Active', First: 'Jane', Last: 'Doe' } // No Directory Share Name
      ];
      
      const result = Manager.filterPublicMembers(members);
      
      expect(result).toHaveLength(1);
    });

    test('handles null entries in array', () => {
      const members = [
        TestData.createMember({ 'Directory Share Name': true }),
        null
      ];
      
      const result = Manager.filterPublicMembers(members);
      
      expect(result).toHaveLength(1);
    });
  });

  // ==================== transformToDirectoryEntry Tests ====================
  
  describe('transformToDirectoryEntry', () => {
    test('transforms member with all sharing enabled', () => {
      const member = TestData.createMember({
        First: 'John',
        Last: 'Doe',
        Email: 'john@example.com',
        Phone: '(123) 456-7890',
        'Directory Share Email': true,
        'Directory Share Phone': true
      });
      
      const result = Manager.transformToDirectoryEntry(member);
      
      expect(result).toEqual({
        First: 'John',
        Last: 'Doe',
        email: 'john@example.com',
        phone: '(123) 456-7890'
      });
    });

    test('hides email when not shared', () => {
      const member = TestData.createMember({
        Email: 'john@example.com',
        'Directory Share Email': false
      });
      
      const result = Manager.transformToDirectoryEntry(member);
      
      expect(result.email).toBe('');
    });

    test('hides phone when not shared', () => {
      const member = TestData.createMember({
        Phone: '(123) 456-7890',
        'Directory Share Phone': false
      });
      
      const result = Manager.transformToDirectoryEntry(member);
      
      expect(result.phone).toBe('');
    });

    test('returns null for null input', () => {
      expect(Manager.transformToDirectoryEntry(null)).toBeNull();
    });

    test('returns null for undefined input', () => {
      expect(Manager.transformToDirectoryEntry(undefined)).toBeNull();
    });

    test('handles missing First name', () => {
      const member = TestData.createMember({ First: undefined });
      
      const result = Manager.transformToDirectoryEntry(member);
      
      expect(result.First).toBe('');
    });

    test('handles missing Last name', () => {
      const member = TestData.createMember({ Last: undefined });
      
      const result = Manager.transformToDirectoryEntry(member);
      
      expect(result.Last).toBe('');
    });

    test('handles undefined sharing preferences as false', () => {
      const member = {
        First: 'John',
        Last: 'Doe',
        Email: 'john@example.com',
        Phone: '(123) 456-7890'
        // No sharing preferences set
      };
      
      const result = Manager.transformToDirectoryEntry(member);
      
      expect(result.email).toBe('');
      expect(result.phone).toBe('');
    });
  });

  // ==================== transformToDirectoryEntries Tests ====================
  
  describe('transformToDirectoryEntries', () => {
    test('transforms array of members', () => {
      const members = [
        TestData.createMember({ First: 'John', Last: 'Doe' }),
        TestData.createMember({ First: 'Jane', Last: 'Smith' })
      ];
      
      const result = Manager.transformToDirectoryEntries(members);
      
      expect(result).toHaveLength(2);
      expect(result[0].First).toBe('John');
      expect(result[1].First).toBe('Jane');
    });

    test('returns empty array for empty input', () => {
      expect(Manager.transformToDirectoryEntries([])).toEqual([]);
    });

    test('returns empty array for null input', () => {
      expect(Manager.transformToDirectoryEntries(null)).toEqual([]);
    });

    test('filters out null entries', () => {
      const members = [
        TestData.createMember({ First: 'John' }),
        null,
        TestData.createMember({ First: 'Jane' })
      ];
      
      const result = Manager.transformToDirectoryEntries(members);
      
      expect(result).toHaveLength(2);
    });
  });

  // ==================== getDirectoryEntries Tests ====================
  
  describe('getDirectoryEntries', () => {
    test('returns entries for active public members', () => {
      const members = [
        TestData.createMember({ 
          Status: 'Active', 
          'Directory Share Name': true,
          First: 'John' 
        }),
        TestData.createMember({ 
          Status: 'Active', 
          'Directory Share Name': false,
          First: 'Jane' 
        }),
        TestData.createMember({ 
          Status: 'Expired', 
          'Directory Share Name': true,
          First: 'Bob' 
        })
      ];
      
      const result = Manager.getDirectoryEntries(members);
      
      expect(result).toHaveLength(1);
      expect(result[0].First).toBe('John');
    });

    test('returns empty array for no public active members', () => {
      const members = [
        TestData.createPrivateMember({ Status: 'Active' }),
        TestData.createInactiveMember({ 'Directory Share Name': true })
      ];
      
      const result = Manager.getDirectoryEntries(members);
      
      expect(result).toEqual([]);
    });

    test('applies email/phone sharing preferences', () => {
      const members = [
        TestData.createMember({ 
          Status: 'Active', 
          'Directory Share Name': true,
          'Directory Share Email': true,
          'Directory Share Phone': false,
          Email: 'test@example.com',
          Phone: '(123) 456-7890'
        })
      ];
      
      const result = Manager.getDirectoryEntries(members);
      
      expect(result[0].email).toBe('test@example.com');
      expect(result[0].phone).toBe('');
    });
  });

  // ==================== filterBySearchTerm Tests ====================
  
  describe('filterBySearchTerm', () => {
    const entries = [
      { First: 'John', Last: 'Doe', email: '', phone: '' },
      { First: 'Jane', Last: 'Smith', email: '', phone: '' },
      { First: 'Bob', Last: 'Johnson', email: '', phone: '' }
    ];

    test('filters by first name', () => {
      const result = Manager.filterBySearchTerm(entries, 'john');
      
      expect(result).toHaveLength(2);
      expect(result.map(e => e.First)).toContain('John');
      expect(result.map(e => e.Last)).toContain('Johnson');
    });

    test('filters by last name', () => {
      const result = Manager.filterBySearchTerm(entries, 'smith');
      
      expect(result).toHaveLength(1);
      expect(result[0].First).toBe('Jane');
    });

    test('filters by full name', () => {
      const result = Manager.filterBySearchTerm(entries, 'jane smith');
      
      expect(result).toHaveLength(1);
      expect(result[0].First).toBe('Jane');
    });

    test('is case insensitive', () => {
      const result = Manager.filterBySearchTerm(entries, 'JOHN');
      
      expect(result.length).toBeGreaterThan(0);
    });

    test('returns all entries for empty search term', () => {
      expect(Manager.filterBySearchTerm(entries, '')).toEqual(entries);
    });

    test('returns all entries for null search term', () => {
      expect(Manager.filterBySearchTerm(entries, null)).toEqual(entries);
    });

    test('returns all entries for undefined search term', () => {
      expect(Manager.filterBySearchTerm(entries, undefined)).toEqual(entries);
    });

    test('returns all entries for whitespace-only search term', () => {
      expect(Manager.filterBySearchTerm(entries, '   ')).toEqual(entries);
    });

    test('returns empty array for no matches', () => {
      const result = Manager.filterBySearchTerm(entries, 'xyz');
      
      expect(result).toEqual([]);
    });

    test('returns empty array for null entries', () => {
      expect(Manager.filterBySearchTerm(null, 'john')).toEqual([]);
    });

    test('handles entries with missing names', () => {
      const entriesWithMissing = [
        { First: 'John', Last: '', email: '', phone: '' },
        { First: '', Last: 'Smith', email: '', phone: '' }
      ];
      
      const result = Manager.filterBySearchTerm(entriesWithMissing, 'smith');
      
      expect(result).toHaveLength(1);
    });
  });

  // ==================== sortByName Tests ====================
  
  describe('sortByName', () => {
    test('sorts by last name', () => {
      const entries = [
        { First: 'Jane', Last: 'Zebra', email: '', phone: '' },
        { First: 'John', Last: 'Apple', email: '', phone: '' },
        { First: 'Bob', Last: 'Middle', email: '', phone: '' }
      ];
      
      const result = Manager.sortByName(entries);
      
      expect(result[0].Last).toBe('Apple');
      expect(result[1].Last).toBe('Middle');
      expect(result[2].Last).toBe('Zebra');
    });

    test('sorts by first name when last names match', () => {
      const entries = [
        { First: 'Zebra', Last: 'Same', email: '', phone: '' },
        { First: 'Apple', Last: 'Same', email: '', phone: '' }
      ];
      
      const result = Manager.sortByName(entries);
      
      expect(result[0].First).toBe('Apple');
      expect(result[1].First).toBe('Zebra');
    });

    test('returns empty array for empty input', () => {
      expect(Manager.sortByName([])).toEqual([]);
    });

    test('returns empty array for null input', () => {
      expect(Manager.sortByName(null)).toEqual([]);
    });

    test('does not mutate original array', () => {
      const original = [
        { First: 'Zebra', Last: 'Last', email: '', phone: '' },
        { First: 'Apple', Last: 'First', email: '', phone: '' }
      ];
      const copy = [...original];
      
      Manager.sortByName(original);
      
      expect(original).toEqual(copy);
    });

    test('handles entries with missing names', () => {
      const entries = [
        { First: 'John', Last: '', email: '', phone: '' },
        { First: 'Jane', Last: 'Doe', email: '', phone: '' }
      ];
      
      const result = Manager.sortByName(entries);
      
      // Empty last name should sort before 'Doe'
      expect(result[0].First).toBe('John');
    });
  });

  // ==================== processDirectory Tests ====================
  
  describe('processDirectory', () => {
    test('returns sorted entries for valid members', () => {
      const members = [
        TestData.createMember({ First: 'Zebra', Last: 'Last' }),
        TestData.createMember({ First: 'Apple', Last: 'First' })
      ];
      
      const result = Manager.processDirectory(members);
      
      expect(result).toHaveLength(2);
      expect(result[0].Last).toBe('First');
      expect(result[1].Last).toBe('Last');
    });

    test('applies search filter', () => {
      const members = [
        TestData.createMember({ First: 'John', Last: 'Doe' }),
        TestData.createMember({ First: 'Jane', Last: 'Smith' })
      ];
      
      const result = Manager.processDirectory(members, { searchTerm: 'doe' });
      
      expect(result).toHaveLength(1);
      expect(result[0].First).toBe('John');
    });

    test('returns empty array for no matching members', () => {
      const members = [
        TestData.createPrivateMember(),
        TestData.createInactiveMember()
      ];
      
      const result = Manager.processDirectory(members);
      
      expect(result).toEqual([]);
    });

    test('handles empty options object', () => {
      const members = [TestData.createMember()];
      
      const result = Manager.processDirectory(members, {});
      
      expect(result).toHaveLength(1);
    });
  });

  // ==================== validateSearchTerm Tests ====================
  
  describe('validateSearchTerm', () => {
    test('accepts valid search term', () => {
      expect(Manager.validateSearchTerm('john')).toEqual({ valid: true });
    });

    test('accepts null search term', () => {
      expect(Manager.validateSearchTerm(null)).toEqual({ valid: true });
    });

    test('accepts undefined search term', () => {
      expect(Manager.validateSearchTerm(undefined)).toEqual({ valid: true });
    });

    test('accepts empty string', () => {
      expect(Manager.validateSearchTerm('')).toEqual({ valid: true });
    });

    test('rejects non-string search term', () => {
      const result = Manager.validateSearchTerm(123);
      
      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe('INVALID_SEARCH_TERM');
    });

    test('rejects overly long search term', () => {
      const longTerm = 'a'.repeat(101);
      const result = Manager.validateSearchTerm(longTerm);
      
      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe('SEARCH_TERM_TOO_LONG');
    });

    test('accepts search term at max length', () => {
      const maxTerm = 'a'.repeat(100);
      expect(Manager.validateSearchTerm(maxTerm)).toEqual({ valid: true });
    });
  });

  // ==================== getDirectoryStats Tests ====================
  
  describe('getDirectoryStats', () => {
    test('returns correct statistics', () => {
      const members = [
        TestData.createMember({ Status: 'Active', 'Directory Share Name': true }),
        TestData.createMember({ Status: 'Active', 'Directory Share Name': false }),
        TestData.createMember({ Status: 'Expired', 'Directory Share Name': true }),
        TestData.createMember({ Status: 'Expired', 'Directory Share Name': false })
      ];
      
      const result = Manager.getDirectoryStats(members);
      
      expect(result.total).toBe(4);
      expect(result.active).toBe(2);
      expect(result.public).toBe(1);
    });

    test('returns zeros for empty input', () => {
      expect(Manager.getDirectoryStats([])).toEqual({ 
        total: 0, 
        active: 0, 
        public: 0 
      });
    });

    test('returns zeros for null input', () => {
      expect(Manager.getDirectoryStats(null)).toEqual({ 
        total: 0, 
        active: 0, 
        public: 0 
      });
    });

    test('handles all active public members', () => {
      const members = [
        TestData.createMember({ Status: 'Active', 'Directory Share Name': true }),
        TestData.createMember({ Status: 'Active', 'Directory Share Name': true })
      ];
      
      const result = Manager.getDirectoryStats(members);
      
      expect(result.total).toBe(2);
      expect(result.active).toBe(2);
      expect(result.public).toBe(2);
    });
  });
});
