// @ts-check
/**
 * Test suite for GroupManagementService.Api
 * Tests the GAS layer API handlers for group subscription management
 * 
 * Table of Contents:
 * 1. handleGetSubscriptions - Get user's subscriptions
 * 2. handleUpdateSubscriptions - Update user's subscriptions
 * 3. handleGetDeliveryOptions - Get delivery options
 * 4. _executeAction - Execute subscription actions
 */

// Mock GAS globals before requiring the module
beforeEach(() => {
  // Reset GroupManagementService namespace
  global.GroupManagementService = {};
  
  // Mock Logger (flat class pattern)
  global.AppLogger = {
    log: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  };

    // Mock GAS built-in Logger
    global.Logger = {
      log: jest.fn(),
      clear: jest.fn(),
      getLog: jest.fn(() => '')
    };

  // Mock GroupSubscription
  global.GroupSubscription = {
    deliveryOptions: {
      'UNSUBSCRIBE': ['Unsubscribed', 'Not subscribed to the group'],
      'ALL_MAIL': ['Each message', 'Receive an email for every message'],
      'DAILY': ['Abridged', 'Receive abridged, bundled emails'],
      'DIGEST': ['Digest', 'Receive bundled emails'],
      'NONE': ['None', 'Do not receive emails']
    },
    getMember: jest.fn(),
    subscribeMember: jest.fn(),
    updateMember: jest.fn(),
    removeMember: jest.fn()
  };

  // Mock DataAccess (flat class pattern)
  global.DataAccess = {
    getPublicGroups: jest.fn()
  };

  // Mock ServiceLogger (flat class pattern)
  global.ServiceLogger = jest.fn().mockImplementation(() => ({
    logOperation: jest.fn().mockReturnValue({
      Timestamp: new Date(),
      Type: 'Test.Operation',
      Outcome: 'success',
      Note: 'Test note',
      Error: '',
      JSON: ''
    })
  }));

  // Mock Common namespace (backward compat for Logger)
  global.Common = {
    Data: {
      Access: global.DataAccess,
      Storage: {
        SpreadsheetManager: {
          getFiddler: jest.fn()
        }
      }
    },
    Api: {
      ClientManager: require('../src/common/api/ApiClient').ClientManager
    },
    Logger: global.Logger,
    Logging: {
      ServiceLogger: global.ServiceLogger  // backward compat alias
    }
  };
  
  // Mock Audit namespace
  global.Audit = {
    Persistence: {
      persistAuditEntries: jest.fn()
    }
  };

  // Load Manager first (dependency)
  require('../src/services/GroupManagementService/Manager');
  
  // Load Api
  require('../src/services/GroupManagementService/Api');
});

afterEach(() => {
  jest.resetModules();
  delete global.GroupManagementService;
  delete global.Logger;
  delete global.GroupSubscription;
  delete global.Common;
});

// Test data factories
const TestData = {
  createGroup: (overrides = {}) => ({
    Name: 'Test Group',
    Email: 'test@sc3.club',
    ...overrides
  }),

  createMember: (overrides = {}) => ({
    email: 'user@test.com',
    delivery_settings: 'ALL_MAIL',
    ...overrides
  }),

  createUpdate: (overrides = {}) => ({
    groupEmail: 'test@sc3.club',
    deliveryValue: 'ALL_MAIL',
    ...overrides
  })
};

describe('GroupManagementService.Api', () => {

  // ==================== handleGetSubscriptions Tests ====================
  
  describe('handleGetSubscriptions', () => {
    test('returns subscriptions for authenticated user', () => {
      const groups = [
        TestData.createGroup({ Name: 'Group 1', Email: 'g1@sc3.club' }),
        TestData.createGroup({ Name: 'Group 2', Email: 'g2@sc3.club' })
      ];
      
      (/** @type {any} */ (DataAccess.getPublicGroups)).mockReturnValue(groups);
      (/** @type {any} */ (GroupSubscription.getMember))
        .mockReturnValueOnce(TestData.createMember({ delivery_settings: 'ALL_MAIL' }))
        .mockReturnValueOnce(null);

      const result = GroupManagementService.Api.handleGetSubscriptions({
        _authenticatedEmail: 'user@test.com'
      });

      expect(result.success).toBe(true);
      expect(result.data.subscriptions).toHaveLength(2);
      expect(result.data.subscriptions[0].deliveryValue).toBe('ALL_MAIL');
      expect(result.data.subscriptions[1].deliveryValue).toBe('UNSUBSCRIBE');
      expect(result.data.deliveryOptions).toBeDefined();
    });

    test('returns error when email not available', () => {
      const result = GroupManagementService.Api.handleGetSubscriptions({});

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('NO_EMAIL');
    });

    test('handles getMember errors gracefully', () => {
      const groups = [TestData.createGroup()];
      
      (/** @type {any} */ (DataAccess.getPublicGroups)).mockReturnValue(groups);
      (/** @type {any} */ (GroupSubscription.getMember)).mockImplementation(() => {
        throw new Error('API error');
      });

      const result = GroupManagementService.Api.handleGetSubscriptions({
        _authenticatedEmail: 'user@test.com'
      });

      // Should still succeed but with null member (unsubscribed)
      expect(result.success).toBe(true);
      expect(result.data.subscriptions[0].deliveryValue).toBe('UNSUBSCRIBE');
    });

    test('handles getPublicGroups error', () => {
      (/** @type {any} */ (DataAccess.getPublicGroups)).mockImplementation(() => {
        throw new Error('Database error');
      });

      const result = GroupManagementService.Api.handleGetSubscriptions({
        _authenticatedEmail: 'user@test.com'
      });

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('GET_SUBSCRIPTIONS_ERROR');
    });
  });

  // ==================== handleUpdateSubscriptions Tests ====================
  
  describe('handleUpdateSubscriptions', () => {
    test('successfully updates subscriptions', () => {
      const updates = [
        TestData.createUpdate({ groupEmail: 'g1@sc3.club', deliveryValue: 'DIGEST' })
      ];
      
      (/** @type {any} */ (GroupSubscription.getMember)).mockReturnValue(
        TestData.createMember({ delivery_settings: 'ALL_MAIL' })
      );
      (/** @type {any} */ (GroupSubscription.updateMember)).mockReturnValue({});

      const result = GroupManagementService.Api.handleUpdateSubscriptions({
        _authenticatedEmail: 'user@test.com',
        updates: updates
      });

      expect(result.success).toBe(true);
      expect(result.data.details.successCount).toBe(1);
      expect(result.data.details.failedCount).toBe(0);
    });

    test('returns error when email not available', () => {
      const result = GroupManagementService.Api.handleUpdateSubscriptions({
        updates: [TestData.createUpdate()]
      });

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('NO_EMAIL');
    });

    test('returns error for invalid updates', () => {
      const result = GroupManagementService.Api.handleUpdateSubscriptions({
        _authenticatedEmail: 'user@test.com',
        updates: [{ groupEmail: 'g1@sc3.club', deliveryValue: 'INVALID' }]
      });

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('UNKNOWN_DELIVERY_VALUE');
    });

    test('returns error for empty updates', () => {
      const result = GroupManagementService.Api.handleUpdateSubscriptions({
        _authenticatedEmail: 'user@test.com',
        updates: []
      });

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('EMPTY_UPDATES');
    });

    test('handles subscribe action', () => {
      const updates = [
        TestData.createUpdate({ groupEmail: 'g1@sc3.club', deliveryValue: 'ALL_MAIL' })
      ];
      
      (/** @type {any} */ (GroupSubscription.getMember)).mockReturnValue(null); // Not subscribed
      (/** @type {any} */ (GroupSubscription.subscribeMember)).mockReturnValue({});

      const result = GroupManagementService.Api.handleUpdateSubscriptions({
        _authenticatedEmail: 'user@test.com',
        updates: updates
      });

      expect(result.success).toBe(true);
      expect(GroupSubscription.subscribeMember).toHaveBeenCalled();
    });

    test('handles unsubscribe action', () => {
      const updates = [
        TestData.createUpdate({ groupEmail: 'g1@sc3.club', deliveryValue: 'UNSUBSCRIBE' })
      ];
      
      (/** @type {any} */ (GroupSubscription.getMember)).mockReturnValue(TestData.createMember());
      (/** @type {any} */ (GroupSubscription.removeMember)).mockReturnValue(true);

      const result = GroupManagementService.Api.handleUpdateSubscriptions({
        _authenticatedEmail: 'user@test.com',
        updates: updates
      });

      expect(result.success).toBe(true);
      expect(GroupSubscription.removeMember).toHaveBeenCalled();
    });

    test('handles partial failure', () => {
      const updates = [
        TestData.createUpdate({ groupEmail: 'g1@sc3.club', deliveryValue: 'ALL_MAIL' }),
        TestData.createUpdate({ groupEmail: 'g2@sc3.club', deliveryValue: 'DIGEST' })
      ];
      
      (/** @type {any} */ (GroupSubscription.getMember)).mockReturnValue(null);
      (/** @type {any} */ (GroupSubscription.subscribeMember))
        .mockImplementationOnce(() => ({})) // First succeeds
        .mockImplementationOnce(() => { throw new Error('Failed'); }); // Second fails

      const result = GroupManagementService.Api.handleUpdateSubscriptions({
        _authenticatedEmail: 'user@test.com',
        updates: updates
      });

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('UPDATE_FAILED');
    });

    test('skips no-op updates', () => {
      const updates = [
        TestData.createUpdate({ groupEmail: 'g1@sc3.club', deliveryValue: 'ALL_MAIL' })
      ];
      
      // Already has same settings
      (/** @type {any} */ (GroupSubscription.getMember)).mockReturnValue(
        TestData.createMember({ delivery_settings: 'ALL_MAIL' })
      );

      const result = GroupManagementService.Api.handleUpdateSubscriptions({
        _authenticatedEmail: 'user@test.com',
        updates: updates
      });

      expect(result.success).toBe(true);
      expect(GroupSubscription.updateMember).not.toHaveBeenCalled();
      expect(GroupSubscription.subscribeMember).not.toHaveBeenCalled();
    });
  });

  // ==================== handleGetDeliveryOptions Tests ====================
  
  describe('handleGetDeliveryOptions', () => {
    test('returns delivery options', () => {
      const result = GroupManagementService.Api.handleGetDeliveryOptions();

      expect(result.success).toBe(true);
      expect(result.data.deliveryOptions).toBeDefined();
      expect(Array.isArray(result.data.deliveryOptions)).toBe(true);
    });

    test('includes all standard options', () => {
      const result = GroupManagementService.Api.handleGetDeliveryOptions();

      const values = result.data.deliveryOptions.map(o => o.value);
      expect(values).toContain('ALL_MAIL');
      expect(values).toContain('UNSUBSCRIBE');
    });
  });

  // ==================== _executeAction Tests ====================
  
  describe('_executeAction', () => {
    test('executes unsubscribe action', () => {
      (/** @type {any} */ (GroupSubscription.removeMember)).mockReturnValue(true);

      GroupManagementService.Api._executeAction({
        action: 'unsubscribe',
        groupEmail: 'g1@sc3.club',
        userEmail: 'user@test.com'
      });

      expect(GroupSubscription.removeMember).toHaveBeenCalledWith('g1@sc3.club', 'user@test.com');
    });

    test('executes subscribe action', () => {
      (/** @type {any} */ (GroupSubscription.subscribeMember)).mockReturnValue({});

      GroupManagementService.Api._executeAction({
        action: 'subscribe',
        groupEmail: 'g1@sc3.club',
        userEmail: 'user@test.com',
        deliveryValue: 'ALL_MAIL'
      });

      expect(GroupSubscription.subscribeMember).toHaveBeenCalledWith(
        { email: 'user@test.com', delivery_settings: 'ALL_MAIL' },
        'g1@sc3.club'
      );
    });

    test('executes update action', () => {
      const member = TestData.createMember({ delivery_settings: 'ALL_MAIL' });
      (/** @type {any} */ (GroupSubscription.getMember)).mockReturnValue(member);
      (/** @type {any} */ (GroupSubscription.updateMember)).mockReturnValue({});

      GroupManagementService.Api._executeAction({
        action: 'update',
        groupEmail: 'g1@sc3.club',
        userEmail: 'user@test.com',
        deliveryValue: 'DIGEST'
      });

      expect(GroupSubscription.updateMember).toHaveBeenCalledWith(
        expect.objectContaining({ delivery_settings: 'DIGEST' }),
        'g1@sc3.club'
      );
    });

    test('update falls back to subscribe if member not found', () => {
      (/** @type {any} */ (GroupSubscription.getMember)).mockReturnValue(null);
      (/** @type {any} */ (GroupSubscription.subscribeMember)).mockReturnValue({});

      GroupManagementService.Api._executeAction({
        action: 'update',
        groupEmail: 'g1@sc3.club',
        userEmail: 'user@test.com',
        deliveryValue: 'DIGEST'
      });

      expect(GroupSubscription.subscribeMember).toHaveBeenCalledWith(
        { email: 'user@test.com', delivery_settings: 'DIGEST' },
        'g1@sc3.club'
      );
    });

    test('throws for unknown action', () => {
      expect(() => {
        GroupManagementService.Api._executeAction({
          action: 'invalid',
          groupEmail: 'g1@sc3.club',
          userEmail: 'user@test.com'
        });
      }).toThrow('Unknown action');
    });
  });
});
