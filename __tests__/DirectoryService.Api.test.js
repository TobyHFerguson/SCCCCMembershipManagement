// @ts-check
/**
 * Test suite for DirectoryService.Api
 * Tests the GAS layer for directory API
 * 
 * Table of Contents:
 * 1. handleGetEntries - Get directory entries endpoint
 * 2. handleGetStats - Get directory statistics endpoint
 * 3. initApi - API handler registration
 */

// Mock the GAS globals
global.Logger = { log: jest.fn() };

// Mock Common.Data.Access
const mockMembers = [
  {
    Status: 'Active',
    Email: 'john@example.com',
    First: 'John',
    Last: 'Doe',
    Phone: '(123) 456-7890',
    'Directory Share Name': true,
    'Directory Share Email': true,
    'Directory Share Phone': true
  },
  {
    Status: 'Active',
    Email: 'jane@example.com',
    First: 'Jane',
    Last: 'Smith',
    Phone: '(555) 123-4567',
    'Directory Share Name': true,
    'Directory Share Email': false,
    'Directory Share Phone': false
  },
  {
    Status: 'Active',
    Email: 'private@example.com',
    First: 'Private',
    Last: 'Person',
    Phone: '(555) 555-5555',
    'Directory Share Name': false,
    'Directory Share Email': false,
    'Directory Share Phone': false
  },
  {
    Status: 'Expired',
    Email: 'expired@example.com',
    First: 'Expired',
    Last: 'Member',
    Phone: '(000) 000-0000',
    'Directory Share Name': true,
    'Directory Share Email': true,
    'Directory Share Phone': true
  }
];

// Mock ApiClient (flat class pattern)
global.ApiClient = {
  registerHandler: jest.fn(),
  handleRequest: jest.fn(),
  clearHandlers: jest.fn()
};

// Mock ApiClientManager (flat class pattern)
global.ApiClientManager = {
  successResponse: jest.fn((data) => ({ 
    success: true, 
    data: data 
  })),
  errorResponse: jest.fn((error, errorCode) => ({ 
    success: false, 
    error: error, 
    errorCode: errorCode 
  }))
};

// Mock DataAccess (flat class pattern)
global.DataAccess = {
  getMembers: jest.fn(() => mockMembers)
};

// Mock Common namespace (backward compatibility)
global.Common = {
  Data: {
    Access: global.DataAccess
  },
  Api: {
    Client: global.ApiClient,
    ClientManager: global.ApiClientManager
  }
};

// Load the modules after mocks are set up
const { Manager } = require('../src/services/DirectoryService/Manager');
const { Api, initApi } = require('../src/services/DirectoryService/Api');

// Make Manager available in the namespace
global.DirectoryService = { Manager, Api };

describe('DirectoryService.Api', () => {
  
  beforeEach(() => {
    jest.clearAllMocks();
    (/** @type {any} */ (DataAccess.getMembers)).mockReturnValue(mockMembers);
  });

  // ==================== handleGetEntries Tests ====================
  
  describe('handleGetEntries', () => {
    test('returns entries for authenticated user', () => {
      const params = { _authenticatedEmail: 'user@example.com' };
      
      const result = Api.handleGetEntries(params);
      
      expect(ApiClientManager.successResponse).toHaveBeenCalled();
      expect(result.success).toBe(true);
      expect(result.data.entries).toBeDefined();
      expect(result.data.count).toBeDefined();
    });

    test('returns only public active members', () => {
      const params = { _authenticatedEmail: 'user@example.com' };
      
      const result = Api.handleGetEntries(params);
      
      // Should have John and Jane (active and public), not Private (not public) or Expired
      expect(result.data.entries.length).toBe(2);
      expect(result.data.entries.map(e => e.First)).toContain('John');
      expect(result.data.entries.map(e => e.First)).toContain('Jane');
      expect(result.data.entries.map(e => e.First)).not.toContain('Private');
      expect(result.data.entries.map(e => e.First)).not.toContain('Expired');
    });

    test('applies search filter', () => {
      const params = { 
        _authenticatedEmail: 'user@example.com',
        searchTerm: 'john'
      };
      
      const result = Api.handleGetEntries(params);
      
      expect(result.data.entries.length).toBe(1);
      expect(result.data.entries[0].First).toBe('John');
    });

    test('returns entries sorted by last name', () => {
      const params = { _authenticatedEmail: 'user@example.com' };
      
      const result = Api.handleGetEntries(params);
      
      // Doe comes before Smith
      expect(result.data.entries[0].Last).toBe('Doe');
      expect(result.data.entries[1].Last).toBe('Smith');
    });

    test('applies sharing preferences', () => {
      const params = { _authenticatedEmail: 'user@example.com' };
      
      const result = Api.handleGetEntries(params);
      
      // John shares email and phone
      const john = result.data.entries.find(e => e.First === 'John');
      expect(john.email).toBe('john@example.com');
      expect(john.phone).toBe('(123) 456-7890');
      
      // Jane doesn't share email or phone
      const jane = result.data.entries.find(e => e.First === 'Jane');
      expect(jane.email).toBe('');
      expect(jane.phone).toBe('');
    });

    test('rejects request without email', () => {
      const params = {};
      
      const result = Api.handleGetEntries(params);
      
      expect(ApiClientManager.errorResponse).toHaveBeenCalledWith(
        'User email not available',
        'NO_EMAIL'
      );
      expect(result.success).toBe(false);
    });

    test('rejects invalid search term type', () => {
      const params = { 
        _authenticatedEmail: 'user@example.com',
        searchTerm: 123
      };
      
      const result = Api.handleGetEntries(params);
      
      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('INVALID_SEARCH_TERM');
    });

    test('rejects overly long search term', () => {
      const params = { 
        _authenticatedEmail: 'user@example.com',
        searchTerm: 'a'.repeat(101)
      };
      
      const result = Api.handleGetEntries(params);
      
      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('SEARCH_TERM_TOO_LONG');
    });

    test('handles empty search term', () => {
      const params = { 
        _authenticatedEmail: 'user@example.com',
        searchTerm: ''
      };
      
      const result = Api.handleGetEntries(params);
      
      // Empty search returns all public active members
      expect(result.success).toBe(true);
      expect(result.data.entries.length).toBe(2);
    });

    test('handles null search term', () => {
      const params = { 
        _authenticatedEmail: 'user@example.com',
        searchTerm: null
      };
      
      const result = Api.handleGetEntries(params);
      
      expect(result.success).toBe(true);
      expect(result.data.entries.length).toBe(2);
    });

    test('handles data access error', () => {
      (/** @type {any} */ (DataAccess.getMembers)).mockImplementation(() => {
        throw new Error('Database error');
      });
      
      const params = { _authenticatedEmail: 'user@example.com' };
      
      const result = Api.handleGetEntries(params);
      
      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('GET_ENTRIES_ERROR');
      expect(Logger.log).toHaveBeenCalled();
    });

    test('returns empty array when no matching members', () => {
      const params = { 
        _authenticatedEmail: 'user@example.com',
        searchTerm: 'xyz'
      };
      
      const result = Api.handleGetEntries(params);
      
      expect(result.success).toBe(true);
      expect(result.data.entries).toEqual([]);
      expect(result.data.count).toBe(0);
    });

    test('returns count matching entries length', () => {
      const params = { _authenticatedEmail: 'user@example.com' };
      
      const result = Api.handleGetEntries(params);
      
      expect(result.data.count).toBe(result.data.entries.length);
    });
  });

  // ==================== handleGetStats Tests ====================
  
  describe('handleGetStats', () => {
    test('returns statistics for authenticated user', () => {
      const params = { _authenticatedEmail: 'user@example.com' };
      
      const result = Api.handleGetStats(params);
      
      expect(ApiClientManager.successResponse).toHaveBeenCalled();
      expect(result.success).toBe(true);
      expect(result.data.stats).toBeDefined();
    });

    test('returns correct statistics', () => {
      const params = { _authenticatedEmail: 'user@example.com' };
      
      const result = Api.handleGetStats(params);
      
      expect(result.data.stats.total).toBe(4);  // All members
      expect(result.data.stats.active).toBe(3); // Active members
      expect(result.data.stats.public).toBe(2); // Active + public members
    });

    test('rejects request without email', () => {
      const params = {};
      
      const result = Api.handleGetStats(params);
      
      expect(ApiClientManager.errorResponse).toHaveBeenCalledWith(
        'User email not available',
        'NO_EMAIL'
      );
      expect(result.success).toBe(false);
    });

    test('handles data access error', () => {
      (/** @type {any} */ (DataAccess.getMembers)).mockImplementation(() => {
        throw new Error('Database error');
      });
      
      const params = { _authenticatedEmail: 'user@example.com' };
      
      const result = Api.handleGetStats(params);
      
      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('GET_STATS_ERROR');
      expect(Logger.log).toHaveBeenCalled();
    });

    test('handles empty members list', () => {
      (/** @type {any} */ (DataAccess.getMembers)).mockReturnValue([]);
      
      const params = { _authenticatedEmail: 'user@example.com' };
      
      const result = Api.handleGetStats(params);
      
      expect(result.success).toBe(true);
      expect(result.data.stats).toEqual({ total: 0, active: 0, public: 0 });
    });
  });

  // ==================== initApi Tests ====================
  
  describe('initApi', () => {
    test('registers directory.getEntries handler', () => {
      initApi();
      
      expect(ApiClient.registerHandler).toHaveBeenCalledWith(
        'directory.getEntries',
        expect.any(Function),
        expect.objectContaining({
          requiresAuth: true,
          description: expect.any(String)
        })
      );
    });

    test('registers directory.getStats handler', () => {
      initApi();
      
      expect(ApiClient.registerHandler).toHaveBeenCalledWith(
        'directory.getStats',
        expect.any(Function),
        expect.objectContaining({
          requiresAuth: true,
          description: expect.any(String)
        })
      );
    });

    test('registers two handlers', () => {
      initApi();
      
      expect(ApiClient.registerHandler).toHaveBeenCalledTimes(2);
    });
  });
});
