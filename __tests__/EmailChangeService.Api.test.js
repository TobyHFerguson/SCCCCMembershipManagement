// @ts-check
/**
 * Test suite for EmailChangeService.Api
 * Tests the GAS layer API handlers for email change operations
 * 
 * Table of Contents:
 * 1. initApi - API handler registration
 * 2. handleSendVerificationCode - Send verification code
 * 3. handleVerifyAndGetGroups - Verify code and get groups
 * 4. handleChangeEmail - Execute email change
 * 5. GAS Helper Functions - Storage, email, spreadsheet operations
 */

// Mock GAS globals before requiring the module
beforeEach(() => {
  // Reset EmailChangeService namespace
  global.EmailChangeService = {};
  
  // Mock Logger
  global.Logger = {
    log: jest.fn()
  };

  // Mock PropertiesService
  global.PropertiesService = {
    getScriptProperties: jest.fn(() => ({
      setProperty: jest.fn(),
      getProperty: jest.fn(),
      deleteProperty: jest.fn()
    }))
  };

  // Mock MailApp
  global.MailApp = {
    sendEmail: jest.fn()
  };

  // Mock GroupSubscription
  global.GroupSubscription = {
    listGroupsFor: jest.fn(),
    changeMembersEmail: jest.fn()
  };

  // Mock Common.Data.Storage.SpreadsheetManager
  global.Common = {
    Data: {
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
    }
  };

  // Load Manager first (dependency)
  require('../src/services/EmailChangeService/Manager');
  
  // Load Api
  require('../src/services/EmailChangeService/Api');
});

afterEach(() => {
  jest.resetModules();
  delete global.EmailChangeService;
  delete global.Logger;
  delete global.PropertiesService;
  delete global.MailApp;
  delete global.GroupSubscription;
  delete global.Common;
});

// Test data factories
const TestData = {
  createVerificationData: (overrides = {}) => ({
    newEmail: 'new@example.com',
    code: '123456',
    expiry: Date.now() + 15 * 60 * 1000,
    type: 'emailUpdate',
    oldEmail: 'old@example.com',
    ...overrides
  }),

  createGroupMembershipInfo: (overrides = {}) => ({
    groupEmail: 'group@example.com',
    oldEmail: 'old@example.com',
    newEmail: 'new@example.com',
    status: 'Pending',
    ...overrides
  }),

  createMockFiddler: (data = []) => ({
    getData: jest.fn(() => data),
    setData: jest.fn().mockReturnThis(),
    dumpValues: jest.fn(),
    mapRows: jest.fn((fn) => {
      data.forEach((row, index) => {
        data[index] = fn(row);
      });
    })
  })
};

describe('EmailChangeService.Api', () => {

  // ==================== initApi Tests ====================
  
  describe('initApi', () => {
    test('registers sendVerificationCode handler', () => {
      EmailChangeService.initApi();
      
      expect(Common.Api.Client.registerHandler).toHaveBeenCalledWith(
        'emailChange.sendVerificationCode',
        expect.any(Function),
        expect.objectContaining({ requiresAuth: true })
      );
    });

    test('registers verifyAndGetGroups handler', () => {
      EmailChangeService.initApi();
      
      expect(Common.Api.Client.registerHandler).toHaveBeenCalledWith(
        'emailChange.verifyAndGetGroups',
        expect.any(Function),
        expect.objectContaining({ requiresAuth: true })
      );
    });

    test('registers changeEmail handler', () => {
      EmailChangeService.initApi();
      
      expect(Common.Api.Client.registerHandler).toHaveBeenCalledWith(
        'emailChange.changeEmail',
        expect.any(Function),
        expect.objectContaining({ requiresAuth: true })
      );
    });
  });

  // ==================== handleSendVerificationCode Tests ====================
  
  describe('handleSendVerificationCode', () => {
    test('sends verification code successfully', () => {
      MailApp.sendEmail.mockImplementation(() => {});

      const result = EmailChangeService.Api.handleSendVerificationCode({
        _authenticatedEmail: 'old@example.com',
        newEmail: 'new@example.com'
      });

      expect(result.success).toBe(true);
      expect(result.data.message).toContain('new@example.com');
      expect(MailApp.sendEmail).toHaveBeenCalled();
    });

    test('returns error when email not available', () => {
      const result = EmailChangeService.Api.handleSendVerificationCode({
        newEmail: 'new@example.com'
      });

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('NO_EMAIL');
    });

    test('returns error when new email missing', () => {
      const result = EmailChangeService.Api.handleSendVerificationCode({
        _authenticatedEmail: 'old@example.com'
      });

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('MISSING_NEW_EMAIL');
    });

    test('returns error when emails are the same', () => {
      const result = EmailChangeService.Api.handleSendVerificationCode({
        _authenticatedEmail: 'same@example.com',
        newEmail: 'same@example.com'
      });

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('EMAILS_SAME');
    });

    test('returns error when new email is invalid', () => {
      const result = EmailChangeService.Api.handleSendVerificationCode({
        _authenticatedEmail: 'old@example.com',
        newEmail: 'invalid-email'
      });

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('INVALID_NEW_EMAIL');
    });

    test('handles email send failure', () => {
      MailApp.sendEmail.mockImplementation(() => {
        throw new Error('SMTP error');
      });

      const result = EmailChangeService.Api.handleSendVerificationCode({
        _authenticatedEmail: 'old@example.com',
        newEmail: 'new@example.com'
      });

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('EMAIL_SEND_FAILED');
    });

    test('stores verification data in properties', () => {
      const mockSetProperty = jest.fn();
      PropertiesService.getScriptProperties.mockReturnValue({
        setProperty: mockSetProperty,
        getProperty: jest.fn(),
        deleteProperty: jest.fn()
      });

      EmailChangeService.Api.handleSendVerificationCode({
        _authenticatedEmail: 'old@example.com',
        newEmail: 'new@example.com'
      });

      expect(mockSetProperty).toHaveBeenCalled();
      const [key, value] = mockSetProperty.mock.calls[0];
      expect(key).toMatch(/^verification_\d{6}$/);
      
      const storedData = JSON.parse(value);
      expect(storedData.oldEmail).toBe('old@example.com');
      expect(storedData.newEmail).toBe('new@example.com');
      expect(storedData.type).toBe('emailUpdate');
    });

    test('normalizes email addresses', () => {
      MailApp.sendEmail.mockImplementation(() => {});

      EmailChangeService.Api.handleSendVerificationCode({
        _authenticatedEmail: 'OLD@EXAMPLE.COM',
        newEmail: 'NEW@EXAMPLE.COM'
      });

      expect(MailApp.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'new@example.com'
        })
      );
    });
  });

  // ==================== handleVerifyAndGetGroups Tests ====================
  
  describe('handleVerifyAndGetGroups', () => {
    test('verifies code and returns groups', () => {
      const storedData = TestData.createVerificationData();
      const mockGetProperty = jest.fn(() => JSON.stringify(storedData));
      const mockDeleteProperty = jest.fn();
      PropertiesService.getScriptProperties.mockReturnValue({
        setProperty: jest.fn(),
        getProperty: mockGetProperty,
        deleteProperty: mockDeleteProperty
      });

      GroupSubscription.listGroupsFor.mockReturnValue([
        { email: 'group1@example.com' },
        { email: 'group2@example.com' }
      ]);

      const result = EmailChangeService.Api.handleVerifyAndGetGroups({
        _authenticatedEmail: 'old@example.com',
        newEmail: 'new@example.com',
        verificationCode: '123456'
      });

      expect(result.success).toBe(true);
      expect(result.data.groups).toHaveLength(2);
      expect(result.data.count).toBe(2);
      expect(mockDeleteProperty).toHaveBeenCalled(); // Code invalidated
    });

    test('returns error when email not available', () => {
      const result = EmailChangeService.Api.handleVerifyAndGetGroups({
        newEmail: 'new@example.com',
        verificationCode: '123456'
      });

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('NO_EMAIL');
    });

    test('returns error when new email missing', () => {
      const result = EmailChangeService.Api.handleVerifyAndGetGroups({
        _authenticatedEmail: 'old@example.com',
        verificationCode: '123456'
      });

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('MISSING_NEW_EMAIL');
    });

    test('returns error when code missing', () => {
      const result = EmailChangeService.Api.handleVerifyAndGetGroups({
        _authenticatedEmail: 'old@example.com',
        newEmail: 'new@example.com'
      });

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('MISSING_CODE');
    });

    test('returns error when code not found', () => {
      PropertiesService.getScriptProperties.mockReturnValue({
        setProperty: jest.fn(),
        getProperty: jest.fn(() => null),
        deleteProperty: jest.fn()
      });

      const result = EmailChangeService.Api.handleVerifyAndGetGroups({
        _authenticatedEmail: 'old@example.com',
        newEmail: 'new@example.com',
        verificationCode: '999999'
      });

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('CODE_NOT_FOUND');
    });

    test('returns error when code expired', () => {
      const expiredData = TestData.createVerificationData({
        expiry: Date.now() - 1000 // Already expired
      });
      PropertiesService.getScriptProperties.mockReturnValue({
        setProperty: jest.fn(),
        getProperty: jest.fn(() => JSON.stringify(expiredData)),
        deleteProperty: jest.fn()
      });

      const result = EmailChangeService.Api.handleVerifyAndGetGroups({
        _authenticatedEmail: 'old@example.com',
        newEmail: 'new@example.com',
        verificationCode: '123456'
      });

      expect(result.success).toBe(false);
      // Expired data is treated as not found by getVerificationData
      expect(result.errorCode).toBe('CODE_NOT_FOUND');
    });

    test('returns error when code is wrong', () => {
      const storedData = TestData.createVerificationData({ code: '999999' });
      PropertiesService.getScriptProperties.mockReturnValue({
        setProperty: jest.fn(),
        getProperty: jest.fn(() => JSON.stringify(storedData)),
        deleteProperty: jest.fn()
      });

      const result = EmailChangeService.Api.handleVerifyAndGetGroups({
        _authenticatedEmail: 'old@example.com',
        newEmail: 'new@example.com',
        verificationCode: '123456'
      });

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('CODE_INVALID');
    });

    test('handles empty groups list', () => {
      const storedData = TestData.createVerificationData();
      PropertiesService.getScriptProperties.mockReturnValue({
        setProperty: jest.fn(),
        getProperty: jest.fn(() => JSON.stringify(storedData)),
        deleteProperty: jest.fn()
      });

      GroupSubscription.listGroupsFor.mockReturnValue([]);

      const result = EmailChangeService.Api.handleVerifyAndGetGroups({
        _authenticatedEmail: 'old@example.com',
        newEmail: 'new@example.com',
        verificationCode: '123456'
      });

      expect(result.success).toBe(true);
      expect(result.data.groups).toHaveLength(0);
      expect(result.data.count).toBe(0);
    });
  });

  // ==================== handleChangeEmail Tests ====================
  
  describe('handleChangeEmail', () => {
    let mockFiddler;

    beforeEach(() => {
      mockFiddler = TestData.createMockFiddler([
        { Email: 'old@example.com', First: 'John' }
      ]);
      Common.Data.Storage.SpreadsheetManager.getFiddler.mockReturnValue(mockFiddler);
    });

    test('changes email in groups successfully', () => {
      GroupSubscription.changeMembersEmail.mockImplementation(() => {});

      const groups = [
        TestData.createGroupMembershipInfo({ groupEmail: 'group1@example.com' }),
        TestData.createGroupMembershipInfo({ groupEmail: 'group2@example.com' })
      ];

      const result = EmailChangeService.Api.handleChangeEmail({
        _authenticatedEmail: 'old@example.com',
        newEmail: 'new@example.com',
        groups: groups
      });

      expect(result.success).toBe(true);
      expect(result.data.success).toBe(true);
      expect(result.data.successCount).toBe(2);
      expect(result.data.failedCount).toBe(0);
      expect(GroupSubscription.changeMembersEmail).toHaveBeenCalledTimes(2);
    });

    test('returns error when email not available', () => {
      const result = EmailChangeService.Api.handleChangeEmail({
        newEmail: 'new@example.com',
        groups: []
      });

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('NO_EMAIL');
    });

    test('returns error when new email missing', () => {
      const result = EmailChangeService.Api.handleChangeEmail({
        _authenticatedEmail: 'old@example.com',
        groups: []
      });

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('MISSING_NEW_EMAIL');
    });

    test('returns error when emails are the same', () => {
      const result = EmailChangeService.Api.handleChangeEmail({
        _authenticatedEmail: 'same@example.com',
        newEmail: 'same@example.com',
        groups: []
      });

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('EMAILS_SAME');
    });

    test('handles partial group update failure', () => {
      GroupSubscription.changeMembersEmail
        .mockImplementationOnce(() => {})  // First succeeds
        .mockImplementationOnce(() => { throw new Error('Access denied'); }); // Second fails

      const groups = [
        TestData.createGroupMembershipInfo({ groupEmail: 'group1@example.com' }),
        TestData.createGroupMembershipInfo({ groupEmail: 'group2@example.com' })
      ];

      const result = EmailChangeService.Api.handleChangeEmail({
        _authenticatedEmail: 'old@example.com',
        newEmail: 'new@example.com',
        groups: groups
      });

      expect(result.success).toBe(true); // API call succeeded
      expect(result.data.success).toBe(false); // But not all groups updated
      expect(result.data.successCount).toBe(1);
      expect(result.data.failedCount).toBe(1);
    });

    test('updates spreadsheets', () => {
      const result = EmailChangeService.Api.handleChangeEmail({
        _authenticatedEmail: 'old@example.com',
        newEmail: 'new@example.com',
        groups: []
      });

      expect(result.success).toBe(true);
      // Should be called for ActiveMembers, ExpirySchedule, and EmailChange log
      expect(Common.Data.Storage.SpreadsheetManager.getFiddler).toHaveBeenCalled();
    });

    test('logs email change', () => {
      const logData = [];
      const logFiddler = TestData.createMockFiddler(logData);
      
      Common.Data.Storage.SpreadsheetManager.getFiddler.mockImplementation((ref) => {
        if (ref === 'EmailChange') {
          return logFiddler;
        }
        return mockFiddler;
      });

      EmailChangeService.Api.handleChangeEmail({
        _authenticatedEmail: 'old@example.com',
        newEmail: 'new@example.com',
        groups: []
      });

      expect(logFiddler.setData).toHaveBeenCalled();
    });

    test('handles empty groups array', () => {
      const result = EmailChangeService.Api.handleChangeEmail({
        _authenticatedEmail: 'old@example.com',
        newEmail: 'new@example.com',
        groups: []
      });

      expect(result.success).toBe(true);
      expect(result.data.message).toBe('No groups to update');
    });

    test('handles missing groups parameter', () => {
      const result = EmailChangeService.Api.handleChangeEmail({
        _authenticatedEmail: 'old@example.com',
        newEmail: 'new@example.com'
      });

      expect(result.success).toBe(true);
      expect(result.data.message).toBe('No groups to update');
    });
  });

  // ==================== GAS Helper Functions Tests ====================
  
  describe('storeVerificationData', () => {
    test('stores data with correct key prefix', () => {
      const mockSetProperty = jest.fn();
      PropertiesService.getScriptProperties.mockReturnValue({
        setProperty: mockSetProperty,
        getProperty: jest.fn(),
        deleteProperty: jest.fn()
      });

      EmailChangeService.Api.storeVerificationData('123456', { test: 'data' });

      expect(mockSetProperty).toHaveBeenCalledWith(
        'verification_123456',
        JSON.stringify({ test: 'data' })
      );
    });
  });

  describe('getVerificationData', () => {
    test('returns parsed data', () => {
      const data = { code: '123456', expiry: Date.now() + 10000 };
      PropertiesService.getScriptProperties.mockReturnValue({
        setProperty: jest.fn(),
        getProperty: jest.fn(() => JSON.stringify(data)),
        deleteProperty: jest.fn()
      });

      const result = EmailChangeService.Api.getVerificationData('123456');
      expect(result).toEqual(data);
    });

    test('returns null for missing data', () => {
      PropertiesService.getScriptProperties.mockReturnValue({
        setProperty: jest.fn(),
        getProperty: jest.fn(() => null),
        deleteProperty: jest.fn()
      });

      const result = EmailChangeService.Api.getVerificationData('123456');
      expect(result).toBeNull();
    });

    test('returns null for expired data and deletes it', () => {
      const mockDeleteProperty = jest.fn();
      const expiredData = { code: '123456', expiry: Date.now() - 1000 };
      PropertiesService.getScriptProperties.mockReturnValue({
        setProperty: jest.fn(),
        getProperty: jest.fn(() => JSON.stringify(expiredData)),
        deleteProperty: mockDeleteProperty
      });

      const result = EmailChangeService.Api.getVerificationData('123456');
      expect(result).toBeNull();
      expect(mockDeleteProperty).toHaveBeenCalledWith('verification_123456');
    });

    test('handles JSON parse error', () => {
      PropertiesService.getScriptProperties.mockReturnValue({
        setProperty: jest.fn(),
        getProperty: jest.fn(() => 'invalid json'),
        deleteProperty: jest.fn()
      });

      const result = EmailChangeService.Api.getVerificationData('123456');
      expect(result).toBeNull();
    });
  });

  describe('deleteVerificationData', () => {
    test('deletes with correct key', () => {
      const mockDeleteProperty = jest.fn();
      PropertiesService.getScriptProperties.mockReturnValue({
        setProperty: jest.fn(),
        getProperty: jest.fn(),
        deleteProperty: mockDeleteProperty
      });

      EmailChangeService.Api.deleteVerificationData('123456');

      expect(mockDeleteProperty).toHaveBeenCalledWith('verification_123456');
    });
  });

  describe('sendVerificationEmail', () => {
    test('sends email with correct parameters', () => {
      const content = {
        subject: 'Test Subject',
        body: 'Test body'
      };

      const result = EmailChangeService.Api.sendVerificationEmail('test@example.com', content);

      expect(result).toBe(true);
      expect(MailApp.sendEmail).toHaveBeenCalledWith({
        to: 'test@example.com',
        subject: 'Test Subject',
        body: 'Test body'
      });
    });

    test('returns false on error', () => {
      MailApp.sendEmail.mockImplementation(() => {
        throw new Error('SMTP error');
      });

      const result = EmailChangeService.Api.sendVerificationEmail('test@example.com', {
        subject: 'Test',
        body: 'Test',
        htmlBody: '<p>Test</p>'
      });

      expect(result).toBe(false);
    });
  });

  describe('changeEmailInSpreadsheets', () => {
    test('updates email in all sheet refs', () => {
      const mockFiddler = {
        mapRows: jest.fn(),
        dumpValues: jest.fn()
      };
      Common.Data.Storage.SpreadsheetManager.getFiddler.mockReturnValue(mockFiddler);

      EmailChangeService.Api.changeEmailInSpreadsheets('old@example.com', 'new@example.com');

      // Should be called for ActiveMembers and ExpirySchedule
      expect(Common.Data.Storage.SpreadsheetManager.getFiddler).toHaveBeenCalledWith('ActiveMembers');
      expect(Common.Data.Storage.SpreadsheetManager.getFiddler).toHaveBeenCalledWith('ExpirySchedule');
      expect(mockFiddler.mapRows).toHaveBeenCalledTimes(2);
      expect(mockFiddler.dumpValues).toHaveBeenCalledTimes(2);
    });

    test('handles errors gracefully', () => {
      Common.Data.Storage.SpreadsheetManager.getFiddler.mockImplementation(() => {
        throw new Error('Sheet not found');
      });

      // Should not throw
      expect(() => {
        EmailChangeService.Api.changeEmailInSpreadsheets('old@example.com', 'new@example.com');
      }).not.toThrow();
    });
  });

  describe('logEmailChange', () => {
    test('appends log entry to EmailChange sheet', () => {
      const logFiddler = TestData.createMockFiddler([]);
      Common.Data.Storage.SpreadsheetManager.getFiddler.mockReturnValue(logFiddler);

      EmailChangeService.Api.logEmailChange('old@example.com', 'new@example.com');

      expect(Common.Data.Storage.SpreadsheetManager.getFiddler).toHaveBeenCalledWith('EmailChange');
      expect(logFiddler.setData).toHaveBeenCalled();
      expect(logFiddler.dumpValues).toHaveBeenCalled();
    });

    test('handles errors gracefully', () => {
      Common.Data.Storage.SpreadsheetManager.getFiddler.mockImplementation(() => {
        throw new Error('Sheet not found');
      });

      // Should not throw
      expect(() => {
        EmailChangeService.Api.logEmailChange('old@example.com', 'new@example.com');
      }).not.toThrow();
    });
  });
});
