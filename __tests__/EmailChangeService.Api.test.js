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
  global.AppLogger = {
    log: jest.fn()
  };

    // Mock GAS built-in Logger
    global.Logger = {
      log: jest.fn(),
      clear: jest.fn(),
      getLog: jest.fn(() => '')
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

  // Mock SpreadsheetManager (flat class pattern)
  global.SpreadsheetManager = {
    getFiddler: jest.fn()
  };

  // Mock SheetAccess (abstraction layer)
  global.SheetAccess = {
    getData: jest.fn(),
    setData: jest.fn(),
    getDataAsArrays: jest.fn(),
    getDataWithFormulas: jest.fn(),
    appendRows: jest.fn(),
    updateRows: jest.fn(),
    convertLinks: jest.fn(),
    clearCache: jest.fn(),
    getSheet: jest.fn(),
    getFiddler: jest.fn()
  };

  // Mock ApiClient (flat class pattern)
  global.ApiClient = {
    registerHandler: jest.fn(),
    handleRequest: jest.fn(),
    clearHandlers: jest.fn()
  };

  // Mock ApiClientManager (flat class pattern)
  global.ApiClientManager = require('../src/common/api/ApiClient').ClientManager;

  // Mock SpreadsheetManager - backward compat via Common namespace
  global.Common = {
    Data: {
      Storage: {
        SpreadsheetManager: global.SpreadsheetManager
      }
    },
    Api: {
      Client: global.ApiClient,
      ClientManager: global.ApiClientManager
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
  delete global.SheetAccess;
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
      
      expect(ApiClient.registerHandler).toHaveBeenCalledWith(
        'emailChange.sendVerificationCode',
        expect.any(Function),
        expect.objectContaining({ requiresAuth: true })
      );
    });

    test('registers verifyAndGetGroups handler', () => {
      EmailChangeService.initApi();
      
      expect(ApiClient.registerHandler).toHaveBeenCalledWith(
        'emailChange.verifyAndGetGroups',
        expect.any(Function),
        expect.objectContaining({ requiresAuth: true })
      );
    });

    test('registers changeEmail handler', () => {
      EmailChangeService.initApi();
      
      expect(ApiClient.registerHandler).toHaveBeenCalledWith(
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
    beforeEach(() => {
      const mockData = [
        { Email: 'old@example.com', First: 'John' }
      ];
      SheetAccess.getData.mockReturnValue(mockData);
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
      expect(SheetAccess.getData).toHaveBeenCalled();
      expect(SheetAccess.setData).toHaveBeenCalled();
    });

    test('logs email change', () => {
      EmailChangeService.Api.handleChangeEmail({
        _authenticatedEmail: 'old@example.com',
        newEmail: 'new@example.com',
        groups: []
      });

      // Verify setData was called for EmailChange sheet
      const setDataCalls = SheetAccess.setData.mock.calls;
      const emailChangeCall = setDataCalls.find(call => call[0] === 'EmailChange');
      expect(emailChangeCall).toBeDefined();
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
      const mockData = [
        { Email: 'old@example.com', First: 'John' },
        { Email: 'other@example.com', First: 'Jane' }
      ];
      SheetAccess.getData.mockReturnValue(mockData);

      EmailChangeService.Api.changeEmailInSpreadsheets('old@example.com', 'new@example.com');

      // Should be called for ActiveMembers and ExpirySchedule
      expect(SheetAccess.getData).toHaveBeenCalledWith('ActiveMembers');
      expect(SheetAccess.getData).toHaveBeenCalledWith('ExpirySchedule');
      expect(SheetAccess.setData).toHaveBeenCalledTimes(2);
      
      // Verify the data was transformed correctly
      expect(SheetAccess.setData).toHaveBeenCalledWith(
        'ActiveMembers',
        expect.arrayContaining([
          expect.objectContaining({ Email: 'new@example.com', First: 'John' })
        ])
      );
    });

    test('handles errors gracefully', () => {
      SheetAccess.getData.mockImplementation(() => {
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
      const existingData = [];
      SheetAccess.getData.mockReturnValue(existingData);

      EmailChangeService.Api.logEmailChange('old@example.com', 'new@example.com');

      expect(SheetAccess.getData).toHaveBeenCalledWith('EmailChange');
      expect(SheetAccess.setData).toHaveBeenCalled();
      
      // Verify setData was called with data that includes the new entry
      const setDataCall = SheetAccess.setData.mock.calls[0];
      expect(setDataCall[0]).toBe('EmailChange');
      expect(setDataCall[1]).toHaveLength(1);
      expect(setDataCall[1][0]).toMatchObject({
        from: 'old@example.com',
        to: 'new@example.com'
      });
      expect(setDataCall[1][0].date).toBeDefined();
    });

    test('handles errors gracefully', () => {
      SheetAccess.getData.mockImplementation(() => {
        throw new Error('Sheet not found');
      });

      // Should not throw
      expect(() => {
        EmailChangeService.Api.logEmailChange('old@example.com', 'new@example.com');
      }).not.toThrow();
    });
  });
});
