// @ts-check
/**
 * Test suite for GroupManagementService.Manager
 * Tests the pure business logic for group subscription management
 * 
 * Table of Contents:
 * 1. validateEmail - Email validation
 * 2. validateDeliveryValue - Delivery value validation
 * 3. validateSubscriptionUpdate - Single update validation
 * 4. validateSubscriptionUpdates - Multiple updates validation
 * 5. buildSubscription - Build single subscription
 * 6. buildUserSubscriptions - Build all subscriptions for a user
 * 7. determineAction - Determine action for a single update
 * 8. calculateActions - Calculate all actions for updates
 * 9. getDeliveryOptionsArray - Convert delivery options to array
 * 10. formatUpdateResult - Format update result
 * 11. normalizeEmail - Email normalization
 * 12. getDeliveryOptions - Get default delivery options
 */

const { Manager, DEFAULT_DELIVERY_OPTIONS } = require('../src/services/GroupManagementService/Manager');

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

describe('GroupManagementService.Manager', () => {

  // ==================== validateEmail Tests ====================
  
  describe('validateEmail', () => {
    test('accepts valid email', () => {
      expect(Manager.validateEmail('user@example.com')).toEqual({ valid: true });
    });

    test('accepts email with subdomain', () => {
      expect(Manager.validateEmail('user@mail.example.com')).toEqual({ valid: true });
    });

    test('accepts email with plus sign', () => {
      expect(Manager.validateEmail('user+tag@example.com')).toEqual({ valid: true });
    });

    test('rejects null email', () => {
      const result = Manager.validateEmail(null);
      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe('INVALID_EMAIL');
    });

    test('rejects undefined email', () => {
      const result = Manager.validateEmail(undefined);
      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe('INVALID_EMAIL');
    });

    test('rejects empty string', () => {
      const result = Manager.validateEmail('');
      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe('INVALID_EMAIL');
    });

    test('rejects email without @', () => {
      const result = Manager.validateEmail('userexample.com');
      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe('INVALID_EMAIL_FORMAT');
    });

    test('rejects email without domain', () => {
      const result = Manager.validateEmail('user@');
      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe('INVALID_EMAIL_FORMAT');
    });

    test('rejects email with spaces', () => {
      const result = Manager.validateEmail('user @example.com');
      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe('INVALID_EMAIL_FORMAT');
    });
  });

  // ==================== validateDeliveryValue Tests ====================
  
  describe('validateDeliveryValue', () => {
    test('accepts ALL_MAIL', () => {
      expect(Manager.validateDeliveryValue('ALL_MAIL')).toEqual({ valid: true });
    });

    test('accepts DIGEST', () => {
      expect(Manager.validateDeliveryValue('DIGEST')).toEqual({ valid: true });
    });

    test('accepts DAILY', () => {
      expect(Manager.validateDeliveryValue('DAILY')).toEqual({ valid: true });
    });

    test('accepts NONE', () => {
      expect(Manager.validateDeliveryValue('NONE')).toEqual({ valid: true });
    });

    test('accepts UNSUBSCRIBE', () => {
      expect(Manager.validateDeliveryValue('UNSUBSCRIBE')).toEqual({ valid: true });
    });

    test('rejects null value', () => {
      const result = Manager.validateDeliveryValue(null);
      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe('INVALID_DELIVERY_VALUE');
    });

    test('rejects empty string', () => {
      const result = Manager.validateDeliveryValue('');
      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe('INVALID_DELIVERY_VALUE');
    });

    test('rejects unknown value', () => {
      const result = Manager.validateDeliveryValue('INVALID_VALUE');
      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe('UNKNOWN_DELIVERY_VALUE');
    });

    test('rejects lowercase value', () => {
      const result = Manager.validateDeliveryValue('all_mail');
      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe('UNKNOWN_DELIVERY_VALUE');
    });

    test('accepts custom delivery options', () => {
      const customOptions = { 'CUSTOM': ['Custom', 'Custom option'] };
      expect(Manager.validateDeliveryValue('CUSTOM', customOptions)).toEqual({ valid: true });
    });
  });

  // ==================== validateSubscriptionUpdate Tests ====================
  
  describe('validateSubscriptionUpdate', () => {
    test('accepts valid update', () => {
      const update = TestData.createUpdate();
      expect(Manager.validateSubscriptionUpdate(update)).toEqual({ valid: true });
    });

    test('rejects null update', () => {
      const result = Manager.validateSubscriptionUpdate(null);
      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe('INVALID_UPDATE');
    });

    test('rejects non-object update', () => {
      const result = Manager.validateSubscriptionUpdate('not an object');
      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe('INVALID_UPDATE');
    });

    test('rejects update with invalid group email', () => {
      const update = TestData.createUpdate({ groupEmail: 'invalid' });
      const result = Manager.validateSubscriptionUpdate(update);
      expect(result.valid).toBe(false);
    });

    test('rejects update with invalid delivery value', () => {
      const update = TestData.createUpdate({ deliveryValue: 'INVALID' });
      const result = Manager.validateSubscriptionUpdate(update);
      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe('UNKNOWN_DELIVERY_VALUE');
    });
  });

  // ==================== validateSubscriptionUpdates Tests ====================
  
  describe('validateSubscriptionUpdates', () => {
    test('accepts valid updates array', () => {
      const updates = [
        TestData.createUpdate({ groupEmail: 'group1@sc3.club' }),
        TestData.createUpdate({ groupEmail: 'group2@sc3.club' })
      ];
      expect(Manager.validateSubscriptionUpdates(updates)).toEqual({ valid: true });
    });

    test('rejects non-array', () => {
      const result = Manager.validateSubscriptionUpdates('not an array');
      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe('INVALID_UPDATES');
    });

    test('rejects empty array', () => {
      const result = Manager.validateSubscriptionUpdates([]);
      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe('EMPTY_UPDATES');
    });

    test('rejects array with invalid update', () => {
      const updates = [
        TestData.createUpdate({ groupEmail: 'group1@sc3.club' }),
        TestData.createUpdate({ deliveryValue: 'INVALID' })
      ];
      const result = Manager.validateSubscriptionUpdates(updates);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('index 1');
    });
  });

  // ==================== buildSubscription Tests ====================
  
  describe('buildSubscription', () => {
    test('builds subscription for subscribed member', () => {
      const group = TestData.createGroup({ Name: 'My Group', Email: 'my@sc3.club' });
      const member = TestData.createMember({ delivery_settings: 'ALL_MAIL' });
      
      const result = Manager.buildSubscription(group, member);
      
      expect(result).toEqual({
        groupName: 'My Group',
        groupEmail: 'my@sc3.club',
        deliveryValue: 'ALL_MAIL',
        deliveryName: 'Each message'
      });
    });

    test('builds subscription for DIGEST setting', () => {
      const group = TestData.createGroup();
      const member = TestData.createMember({ delivery_settings: 'DIGEST' });
      
      const result = Manager.buildSubscription(group, member);
      
      expect(result.deliveryValue).toBe('DIGEST');
      expect(result.deliveryName).toBe('Digest');
    });

    test('builds unsubscribed for null member', () => {
      const group = TestData.createGroup({ Name: 'My Group', Email: 'my@sc3.club' });
      
      const result = Manager.buildSubscription(group, null);
      
      expect(result).toEqual({
        groupName: 'My Group',
        groupEmail: 'my@sc3.club',
        deliveryValue: 'UNSUBSCRIBE',
        deliveryName: 'UNSUBSCRIBED'
      });
    });

    test('builds unsubscribed for member without delivery_settings', () => {
      const group = TestData.createGroup();
      const member = { email: 'user@test.com' }; // No delivery_settings
      
      const result = Manager.buildSubscription(group, member);
      
      expect(result.deliveryValue).toBe('UNSUBSCRIBE');
      expect(result.deliveryName).toBe('UNSUBSCRIBED');
    });

    test('handles unknown delivery setting gracefully', () => {
      const group = TestData.createGroup();
      const member = TestData.createMember({ delivery_settings: 'UNKNOWN_VALUE' });
      
      const result = Manager.buildSubscription(group, member);
      
      expect(result.deliveryValue).toBe('UNKNOWN_VALUE');
      expect(result.deliveryName).toBe('UNKNOWN_VALUE'); // Falls back to value
    });

    test('uses custom delivery options', () => {
      const group = TestData.createGroup();
      const member = TestData.createMember({ delivery_settings: 'CUSTOM' });
      const customOptions = { 'CUSTOM': ['Custom Name', 'Custom tooltip'] };
      
      const result = Manager.buildSubscription(group, member, customOptions);
      
      expect(result.deliveryName).toBe('Custom Name');
    });
  });

  // ==================== buildUserSubscriptions Tests ====================
  
  describe('buildUserSubscriptions', () => {
    test('builds subscriptions for multiple groups', () => {
      const groups = [
        TestData.createGroup({ Name: 'Group 1', Email: 'g1@sc3.club' }),
        TestData.createGroup({ Name: 'Group 2', Email: 'g2@sc3.club' }),
        TestData.createGroup({ Name: 'Group 3', Email: 'g3@sc3.club' })
      ];
      
      const membersByGroup = {
        'g1@sc3.club': TestData.createMember({ delivery_settings: 'ALL_MAIL' }),
        'g2@sc3.club': null, // Not subscribed
        'g3@sc3.club': TestData.createMember({ delivery_settings: 'DIGEST' })
      };
      
      const result = Manager.buildUserSubscriptions(groups, membersByGroup);
      
      expect(result).toHaveLength(3);
      expect(result[0]).toEqual({
        groupName: 'Group 1',
        groupEmail: 'g1@sc3.club',
        deliveryValue: 'ALL_MAIL',
        deliveryName: 'Each message'
      });
      expect(result[1]).toEqual({
        groupName: 'Group 2',
        groupEmail: 'g2@sc3.club',
        deliveryValue: 'UNSUBSCRIBE',
        deliveryName: 'UNSUBSCRIBED'
      });
      expect(result[2]).toEqual({
        groupName: 'Group 3',
        groupEmail: 'g3@sc3.club',
        deliveryValue: 'DIGEST',
        deliveryName: 'Digest'
      });
    });

    test('handles empty groups array', () => {
      const result = Manager.buildUserSubscriptions([], {});
      expect(result).toEqual([]);
    });

    test('handles empty membersByGroup', () => {
      const groups = [
        TestData.createGroup({ Name: 'Group 1', Email: 'g1@sc3.club' })
      ];
      
      const result = Manager.buildUserSubscriptions(groups, {});
      
      expect(result[0].deliveryValue).toBe('UNSUBSCRIBE');
    });
  });

  // ==================== determineAction Tests ====================
  
  describe('determineAction', () => {
    const userEmail = 'user@test.com';

    test('returns unsubscribe action when unsubscribing subscribed user', () => {
      const update = TestData.createUpdate({ deliveryValue: 'UNSUBSCRIBE' });
      const currentMember = TestData.createMember();
      
      const result = Manager.determineAction(update, currentMember, userEmail);
      
      expect(result).toEqual({
        action: 'unsubscribe',
        groupEmail: 'test@sc3.club',
        userEmail: 'user@test.com'
      });
    });

    test('returns null when unsubscribing already unsubscribed user', () => {
      const update = TestData.createUpdate({ deliveryValue: 'UNSUBSCRIBE' });
      
      const result = Manager.determineAction(update, null, userEmail);
      
      expect(result).toBeNull();
    });

    test('returns subscribe action for new subscription', () => {
      const update = TestData.createUpdate({ deliveryValue: 'ALL_MAIL' });
      
      const result = Manager.determineAction(update, null, userEmail);
      
      expect(result).toEqual({
        action: 'subscribe',
        groupEmail: 'test@sc3.club',
        userEmail: 'user@test.com',
        deliveryValue: 'ALL_MAIL'
      });
    });

    test('returns update action when changing delivery settings', () => {
      const update = TestData.createUpdate({ deliveryValue: 'DIGEST' });
      const currentMember = TestData.createMember({ delivery_settings: 'ALL_MAIL' });
      
      const result = Manager.determineAction(update, currentMember, userEmail);
      
      expect(result).toEqual({
        action: 'update',
        groupEmail: 'test@sc3.club',
        userEmail: 'user@test.com',
        deliveryValue: 'DIGEST'
      });
    });

    test('returns null when settings unchanged', () => {
      const update = TestData.createUpdate({ deliveryValue: 'ALL_MAIL' });
      const currentMember = TestData.createMember({ delivery_settings: 'ALL_MAIL' });
      
      const result = Manager.determineAction(update, currentMember, userEmail);
      
      expect(result).toBeNull();
    });
  });

  // ==================== calculateActions Tests ====================
  
  describe('calculateActions', () => {
    const userEmail = 'user@test.com';

    test('calculates actions for multiple updates', () => {
      const updates = [
        TestData.createUpdate({ groupEmail: 'g1@sc3.club', deliveryValue: 'ALL_MAIL' }), // New subscribe
        TestData.createUpdate({ groupEmail: 'g2@sc3.club', deliveryValue: 'UNSUBSCRIBE' }), // Unsubscribe
        TestData.createUpdate({ groupEmail: 'g3@sc3.club', deliveryValue: 'DIGEST' }) // Update
      ];
      
      const currentMembersByGroup = {
        'g1@sc3.club': null, // Not subscribed
        'g2@sc3.club': TestData.createMember(), // Subscribed
        'g3@sc3.club': TestData.createMember({ delivery_settings: 'ALL_MAIL' }) // Subscribed
      };
      
      const result = Manager.calculateActions(updates, currentMembersByGroup, userEmail);
      
      expect(result.actions).toHaveLength(3);
      expect(result.skipped).toBe(0);
      expect(result.actions[0].action).toBe('subscribe');
      expect(result.actions[1].action).toBe('unsubscribe');
      expect(result.actions[2].action).toBe('update');
    });

    test('skips no-op updates', () => {
      const updates = [
        TestData.createUpdate({ groupEmail: 'g1@sc3.club', deliveryValue: 'UNSUBSCRIBE' }), // Already unsubscribed
        TestData.createUpdate({ groupEmail: 'g2@sc3.club', deliveryValue: 'ALL_MAIL' }) // Same settings
      ];
      
      const currentMembersByGroup = {
        'g1@sc3.club': null, // Not subscribed
        'g2@sc3.club': TestData.createMember({ delivery_settings: 'ALL_MAIL' }) // Same
      };
      
      const result = Manager.calculateActions(updates, currentMembersByGroup, userEmail);
      
      expect(result.actions).toHaveLength(0);
      expect(result.skipped).toBe(2);
    });

    test('handles empty updates', () => {
      const result = Manager.calculateActions([], {}, userEmail);
      
      expect(result.actions).toEqual([]);
      expect(result.skipped).toBe(0);
    });
  });

  // ==================== getDeliveryOptionsArray Tests ====================
  
  describe('getDeliveryOptionsArray', () => {
    test('converts default options to array', () => {
      const result = Manager.getDeliveryOptionsArray();
      
      expect(result).toBeInstanceOf(Array);
      expect(result.length).toBeGreaterThan(0);
      
      const allMail = result.find(o => o.value === 'ALL_MAIL');
      expect(allMail).toEqual({
        value: 'ALL_MAIL',
        name: 'Each message',
        description: 'Receive an email for every message'
      });
    });

    test('includes all default options', () => {
      const result = Manager.getDeliveryOptionsArray();
      
      const values = result.map(o => o.value);
      expect(values).toContain('UNSUBSCRIBE');
      expect(values).toContain('ALL_MAIL');
      expect(values).toContain('DAILY');
      expect(values).toContain('DIGEST');
      expect(values).toContain('NONE');
    });

    test('uses custom options when provided', () => {
      const customOptions = { 
        'CUSTOM1': ['Name1', 'Desc1'],
        'CUSTOM2': ['Name2', 'Desc2']
      };
      
      const result = Manager.getDeliveryOptionsArray(customOptions);
      
      expect(result).toHaveLength(2);
      expect(result[0].value).toBe('CUSTOM1');
    });
  });

  // ==================== formatUpdateResult Tests ====================
  
  describe('formatUpdateResult', () => {
    test('formats all success', () => {
      const result = Manager.formatUpdateResult(3, 0);
      
      expect(result.success).toBe(true);
      expect(result.message).toBe('3 subscriptions updated successfully');
      expect(result.details.successCount).toBe(3);
      expect(result.details.failedCount).toBe(0);
    });

    test('formats single success', () => {
      const result = Manager.formatUpdateResult(1, 0);
      
      expect(result.success).toBe(true);
      expect(result.message).toBe('Subscription updated successfully');
    });

    test('formats all failures', () => {
      const result = Manager.formatUpdateResult(0, 2, ['Error 1', 'Error 2']);
      
      expect(result.success).toBe(false);
      expect(result.message).toBe('Failed to update subscriptions');
      expect(result.details.errors).toEqual(['Error 1', 'Error 2']);
    });

    test('formats partial success', () => {
      const result = Manager.formatUpdateResult(2, 1, ['Error 1']);
      
      expect(result.success).toBe(false);
      expect(result.message).toBe('2 subscriptions updated, 1 failed');
      expect(result.details.successCount).toBe(2);
      expect(result.details.failedCount).toBe(1);
    });

    test('omits errors when empty', () => {
      const result = Manager.formatUpdateResult(1, 0, []);
      
      expect(result.details.errors).toBeUndefined();
    });
  });

  // ==================== normalizeEmail Tests ====================
  
  describe('normalizeEmail', () => {
    test('lowercases email', () => {
      expect(Manager.normalizeEmail('USER@EXAMPLE.COM')).toBe('user@example.com');
    });

    test('trims whitespace', () => {
      expect(Manager.normalizeEmail('  user@example.com  ')).toBe('user@example.com');
    });

    test('handles null', () => {
      expect(Manager.normalizeEmail(null)).toBe('');
    });

    test('handles undefined', () => {
      expect(Manager.normalizeEmail(undefined)).toBe('');
    });

    test('handles non-string', () => {
      expect(Manager.normalizeEmail(123)).toBe('');
    });
  });

  // ==================== getDeliveryOptions Tests ====================
  
  describe('getDeliveryOptions', () => {
    test('returns copy of default options', () => {
      const options = Manager.getDeliveryOptions();
      
      expect(options).toEqual(DEFAULT_DELIVERY_OPTIONS);
    });

    test('returns new object (not reference)', () => {
      const options1 = Manager.getDeliveryOptions();
      const options2 = Manager.getDeliveryOptions();
      
      expect(options1).not.toBe(options2);
    });
  });
});
