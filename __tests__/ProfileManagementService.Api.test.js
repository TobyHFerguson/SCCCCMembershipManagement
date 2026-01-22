// @ts-check
/**
 * Test suite for ProfileManagementService.Api
 * Tests the GAS layer API handlers for profile management
 * 
 * Table of Contents:
 * 1. handleGetProfile - Get user's profile
 * 2. handleGetEditableFields - Get editable fields
 * 3. handleUpdateProfile - Update user's profile
 */

// Mock GAS globals before requiring the module
beforeEach(() => {
  // Reset ProfileManagementService namespace
  global.ProfileManagementService = {};
  
  // Mock AppLogger (flat class pattern - our custom logger)
  global.AppLogger = {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    configure: jest.fn()
  };
  
  // Mock GAS built-in Logger
  global.Logger = {
    log: jest.fn()
  };

  // Mock Utilities and Session for date formatting
  global.Utilities = {
    formatDate: jest.fn((date, timezone, format) => {
      // Return a formatted string that matches the expected format
      if (!date) return '';
      const d = new Date(date);
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
    })
  };
  
  global.Session = {
    getScriptTimeZone: jest.fn(() => 'America/Los_Angeles')
  };

  // Mock Common namespace (backward compat for Logger)
  global.Common = {
    Data: {
      Access: {
        getMember: jest.fn(),
        updateMember: jest.fn()
      },
      Storage: {
        SpreadsheetManager: {
          getFiddler: jest.fn()
        }
      }
    },
    Api: {
      Client: {
        registerHandler: jest.fn()
      },
      ClientManager: require('../src/common/api/ApiClient').ClientManager
    },
    Logger: global.AppLogger,
    Logging: {
      ServiceLogger: jest.fn().mockImplementation(() => ({
        logOperation: jest.fn().mockReturnValue({
          Timestamp: new Date(),
          Type: 'Test.Operation',
          Outcome: 'success',
          Note: 'Test note',
          Error: '',
          JSON: ''
        })
      }))
    }
  };
  
  // Mock Audit namespace
  global.Audit = {
    Persistence: {
      persistAuditEntries: jest.fn()
    }
  };

  // Load Manager first (dependency)
  require('../src/services/ProfileManagementService/Manager');
  
  // Load Api
  require('../src/services/ProfileManagementService/Api');
});

afterEach(() => {
  jest.resetModules();
  delete global.ProfileManagementService;
  delete global.Logger;
  delete global.Common;
  delete global.Utilities;
  delete global.Session;
});

// Test data factories
const TestData = {
  createProfile: (overrides = {}) => ({
    Status: 'Active',
    Email: 'test@example.com',
    First: 'John',
    Last: 'Doe',
    Phone: '(123) 456-7890',
    Joined: new Date('2023-01-01'),
    Expires: new Date('2024-01-01'),
    Period: 12,
    'Directory Share Name': true,
    'Directory Share Phone': false,
    'Directory Share Email': true,
    ...overrides
  }),

  createValidUpdate: (overrides = {}) => ({
    First: 'Jane',
    Last: 'Smith',
    Phone: '(555) 123-4567',
    'Directory Share Name': false,
    'Directory Share Phone': true,
    'Directory Share Email': false,
    ...overrides
  })
};

describe('ProfileManagementService.Api', () => {

  // ==================== initApi Tests ====================
  
  describe('initApi', () => {
    test('registers getProfile handler', () => {
      ProfileManagementService.initApi();
      
      expect(Common.Api.Client.registerHandler).toHaveBeenCalledWith(
        'profileManagement.getProfile',
        expect.any(Function),
        expect.objectContaining({ requiresAuth: true })
      );
    });

    test('registers updateProfile handler', () => {
      ProfileManagementService.initApi();
      
      expect(Common.Api.Client.registerHandler).toHaveBeenCalledWith(
        'profileManagement.updateProfile',
        expect.any(Function),
        expect.objectContaining({ requiresAuth: true })
      );
    });

    test('registers getEditableFields handler', () => {
      ProfileManagementService.initApi();
      
      expect(Common.Api.Client.registerHandler).toHaveBeenCalledWith(
        'profileManagement.getEditableFields',
        expect.any(Function),
        expect.objectContaining({ requiresAuth: true })
      );
    });
  });

  // ==================== handleGetProfile Tests ====================
  
  describe('handleGetProfile', () => {
    test('returns profile for authenticated user', () => {
      const profile = TestData.createProfile();
      Common.Data.Access.getMember.mockReturnValue(profile);

      const result = ProfileManagementService.Api.handleGetProfile({
        _authenticatedEmail: 'test@example.com'
      });

      expect(result.success).toBe(true);
      expect(result.data.profile).toBeDefined();
      expect(result.data.profile.First).toBe('John');
      expect(result.data.profile.Last).toBe('Doe');
      expect(result.data.profile.Email).toBe('test@example.com');
    });

    test('includes membership fields and formatted dates', () => {
      const profile = TestData.createProfile();
      Common.Data.Access.getMember.mockReturnValue(profile);

      const result = ProfileManagementService.Api.handleGetProfile({
        _authenticatedEmail: 'test@example.com'
      });

      expect(result.success).toBe(true);
      // Should include membership fields as read-only data
      expect(result.data.profile.Status).toBe('Active');
      expect(result.data.profile.Joined).toEqual(expect.any(Date));
      expect(result.data.profile.Expires).toEqual(expect.any(Date));
      expect(result.data.profile.Period).toBe(12); // Updated to match test data
      
      // Should include formatted date strings for display
      expect(result.data.profile.JoinedFormatted).toMatch(/\w+ \d{1,2}, \d{4}/);
      expect(result.data.profile.ExpiresFormatted).toMatch(/\w+ \d{1,2}, \d{4}/);
      // Renewed On might be null for some members
      if (result.data.profile['Renewed On']) {
        expect(result.data.profile.RenewedOnFormatted).toMatch(/\w+ \d{1,2}, \d{4}/);
      }
    });

    test('returns error when email not available', () => {
      const result = ProfileManagementService.Api.handleGetProfile({});

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('NO_EMAIL');
    });

    test('returns error when profile not found', () => {
      Common.Data.Access.getMember.mockReturnValue(null);

      const result = ProfileManagementService.Api.handleGetProfile({
        _authenticatedEmail: 'unknown@example.com'
      });

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('PROFILE_NOT_FOUND');
    });

    test('handles getMember error gracefully', () => {
      Common.Data.Access.getMember.mockImplementation(() => {
        throw new Error('Database error');
      });

      const result = ProfileManagementService.Api.handleGetProfile({
        _authenticatedEmail: 'test@example.com'
      });

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('GET_PROFILE_ERROR');
    });

    test('normalizes email to lowercase', () => {
      const profile = TestData.createProfile();
      Common.Data.Access.getMember.mockReturnValue(profile);

      ProfileManagementService.Api.handleGetProfile({
        _authenticatedEmail: 'TEST@EXAMPLE.COM'
      });

      expect(Common.Data.Access.getMember).toHaveBeenCalledWith('test@example.com');
    });
  });

  // ==================== handleGetEditableFields Tests ====================
  
  describe('handleGetEditableFields', () => {
    test('returns editable fields for authenticated user', () => {
      const profile = TestData.createProfile();
      Common.Data.Access.getMember.mockReturnValue(profile);

      const result = ProfileManagementService.Api.handleGetEditableFields({
        _authenticatedEmail: 'test@example.com'
      });

      expect(result.success).toBe(true);
      expect(result.data.profile).toBeDefined();
      expect(result.data.profile.First).toBe('John');
      expect(result.data.profile.Last).toBe('Doe');
      // Should not include Email (not editable)
      expect(result.data.profile.Email).toBeUndefined();
    });

    test('returns field schema', () => {
      const profile = TestData.createProfile();
      Common.Data.Access.getMember.mockReturnValue(profile);

      const result = ProfileManagementService.Api.handleGetEditableFields({
        _authenticatedEmail: 'test@example.com'
      });

      expect(result.success).toBe(true);
      expect(result.data.fieldSchema).toBeDefined();
      expect(result.data.fieldSchema.First).toBeDefined();
      expect(result.data.fieldSchema.Phone).toBeDefined();
    });

    test('returns error when email not available', () => {
      const result = ProfileManagementService.Api.handleGetEditableFields({});

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('NO_EMAIL');
    });

    test('returns error when profile not found', () => {
      Common.Data.Access.getMember.mockReturnValue(null);

      const result = ProfileManagementService.Api.handleGetEditableFields({
        _authenticatedEmail: 'unknown@example.com'
      });

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('PROFILE_NOT_FOUND');
    });
  });

  // ==================== handleUpdateProfile Tests ====================
  
  describe('handleUpdateProfile', () => {
    test('successfully updates profile', () => {
      const profile = TestData.createProfile();
      Common.Data.Access.getMember.mockReturnValue(profile);
      Common.Data.Access.updateMember.mockReturnValue(true);

      const result = ProfileManagementService.Api.handleUpdateProfile({
        _authenticatedEmail: 'test@example.com',
        updates: { First: 'Jane', Last: 'Smith' }
      });

      expect(result.success).toBe(true);
      expect(result.data.success).toBe(true);
      expect(result.data.message).toBe('Profile updated successfully');
      expect(result.data.profile.First).toBe('Jane');
      expect(result.data.profile.Last).toBe('Smith');
    });

    test('calls updateMember with merged profile', () => {
      const profile = TestData.createProfile();
      Common.Data.Access.getMember.mockReturnValue(profile);
      Common.Data.Access.updateMember.mockReturnValue(true);

      ProfileManagementService.Api.handleUpdateProfile({
        _authenticatedEmail: 'test@example.com',
        updates: { First: 'Jane' }
      });

      expect(Common.Data.Access.updateMember).toHaveBeenCalledWith(
        'test@example.com',
        expect.objectContaining({
          First: 'Jane',
          Last: 'Doe', // Preserved from original
          Email: 'test@example.com' // Preserved from original
        })
      );
    });

    test('returns error when email not available', () => {
      const result = ProfileManagementService.Api.handleUpdateProfile({
        updates: { First: 'Jane' }
      });

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('NO_EMAIL');
    });

    test('returns error when updates not provided', () => {
      const result = ProfileManagementService.Api.handleUpdateProfile({
        _authenticatedEmail: 'test@example.com'
      });

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('INVALID_UPDATES');
    });

    test('returns error when updates is not an object', () => {
      const result = ProfileManagementService.Api.handleUpdateProfile({
        _authenticatedEmail: 'test@example.com',
        updates: 'not an object'
      });

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('INVALID_UPDATES');
    });

    test('returns error when profile not found', () => {
      Common.Data.Access.getMember.mockReturnValue(null);

      const result = ProfileManagementService.Api.handleUpdateProfile({
        _authenticatedEmail: 'unknown@example.com',
        updates: { First: 'Jane' }
      });

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('PROFILE_NOT_FOUND');
    });

    test('returns error when updating forbidden field', () => {
      const profile = TestData.createProfile();
      Common.Data.Access.getMember.mockReturnValue(profile);

      const result = ProfileManagementService.Api.handleUpdateProfile({
        _authenticatedEmail: 'test@example.com',
        updates: { Email: 'new@example.com' }
      });

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('UPDATE_VALIDATION_FAILED');
    });

    test('returns error when validation fails', () => {
      const profile = TestData.createProfile();
      Common.Data.Access.getMember.mockReturnValue(profile);

      const result = ProfileManagementService.Api.handleUpdateProfile({
        _authenticatedEmail: 'test@example.com',
        updates: { First: '' } // Invalid - empty name
      });

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('UPDATE_VALIDATION_FAILED');
    });

    test('handles updateMember error gracefully', () => {
      const profile = TestData.createProfile();
      Common.Data.Access.getMember.mockReturnValue(profile);
      Common.Data.Access.updateMember.mockImplementation(() => {
        throw new Error('Database error');
      });

      const result = ProfileManagementService.Api.handleUpdateProfile({
        _authenticatedEmail: 'test@example.com',
        updates: { First: 'Jane' }
      });

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('UPDATE_PROFILE_ERROR');
    });

    test('logs successful update', () => {
      const profile = TestData.createProfile();
      Common.Data.Access.getMember.mockReturnValue(profile);
      Common.Data.Access.updateMember.mockReturnValue(true);

      ProfileManagementService.Api.handleUpdateProfile({
        _authenticatedEmail: 'test@example.com',
        updates: { First: 'Jane' }
      });

      // Verify AppLogger.info was called with successful completion message
      expect(AppLogger.info).toHaveBeenCalledWith(
        'ProfileManagementService',
        expect.stringContaining('handleUpdateProfile() completed successfully'),
        expect.any(Object)
      );
      
      // Verify audit entry was created
      expect(Common.Logging.ServiceLogger).toHaveBeenCalledWith('ProfileManagementService', 'test@example.com');
    });

    test('normalizes email to lowercase before lookup', () => {
      const profile = TestData.createProfile();
      Common.Data.Access.getMember.mockReturnValue(profile);
      Common.Data.Access.updateMember.mockReturnValue(true);

      ProfileManagementService.Api.handleUpdateProfile({
        _authenticatedEmail: 'TEST@EXAMPLE.COM',
        updates: { First: 'Jane' }
      });

      expect(Common.Data.Access.getMember).toHaveBeenCalledWith('test@example.com');
      expect(Common.Data.Access.updateMember).toHaveBeenCalledWith(
        'test@example.com',
        expect.any(Object)
      );
    });
  });
});
