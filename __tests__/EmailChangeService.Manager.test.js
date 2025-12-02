// @ts-check
/**
 * Test suite for EmailChangeService.Manager
 * Tests the pure business logic for email change operations
 * 
 * Table of Contents:
 * 1. getVerificationConfig - Get verification configuration
 * 2. validateEmail - Email validation
 * 3. validateEmailChange - Validate email change (old vs new)
 * 4. validateVerificationCode - Verification code format validation
 * 5. generateVerificationCode - Code generation
 * 6. createVerificationEntry - Create verification data entry
 * 7. verifyCode - Verify code against stored data
 * 8. transformGroupsToMembershipInfo - Transform groups to membership info
 * 9. updateMembershipResult - Update single membership result
 * 10. aggregateResults - Aggregate group update results
 * 11. createUpdatedMemberRecord - Create updated member record
 * 12. createChangeLogEntry - Create email change log entry
 * 13. normalizeEmail - Email normalization
 * 14. buildVerificationEmailContent - Build email content
 * 15. formatSendCodeResult - Format send code result
 */

const { Manager, VERIFICATION_CONFIG, EMAIL_REGEX } = require('../src/services/EmailChangeService/Manager');

// Test data factories
const TestData = {
  createVerificationData: (overrides = {}) => ({
    newEmail: 'new@example.com',
    code: '123456',
    expiry: Date.now() + 15 * 60 * 1000, // 15 minutes from now
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

  createMemberRecord: (overrides = {}) => ({
    Status: 'Active',
    Email: 'old@example.com',
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
  })
};

describe('EmailChangeService.Manager', () => {

  // ==================== getVerificationConfig Tests ====================
  
  describe('getVerificationConfig', () => {
    test('returns config with CODE_LENGTH', () => {
      const config = Manager.getVerificationConfig();
      expect(config.CODE_LENGTH).toBe(6);
    });

    test('returns config with EXPIRY_MINUTES', () => {
      const config = Manager.getVerificationConfig();
      expect(config.EXPIRY_MINUTES).toBe(15);
    });

    test('returns copy of config (not reference)', () => {
      const config1 = Manager.getVerificationConfig();
      const config2 = Manager.getVerificationConfig();
      expect(config1).not.toBe(config2);
      expect(config1).toEqual(config2);
    });
  });

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

    test('rejects whitespace only', () => {
      const result = Manager.validateEmail('   ');
      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe('EMPTY_EMAIL');
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

    test('rejects email without TLD', () => {
      const result = Manager.validateEmail('user@example');
      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe('INVALID_EMAIL_FORMAT');
    });
  });

  // ==================== validateEmailChange Tests ====================
  
  describe('validateEmailChange', () => {
    test('accepts valid email change', () => {
      expect(Manager.validateEmailChange('old@example.com', 'new@example.com')).toEqual({ valid: true });
    });

    test('rejects when old email is invalid', () => {
      const result = Manager.validateEmailChange('invalid', 'new@example.com');
      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe('INVALID_OLD_EMAIL');
    });

    test('rejects when new email is invalid', () => {
      const result = Manager.validateEmailChange('old@example.com', 'invalid');
      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe('INVALID_NEW_EMAIL');
    });

    test('rejects when emails are the same', () => {
      const result = Manager.validateEmailChange('user@example.com', 'user@example.com');
      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe('EMAILS_SAME');
    });

    test('rejects when emails are same but different case', () => {
      const result = Manager.validateEmailChange('User@Example.com', 'user@example.com');
      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe('EMAILS_SAME');
    });

    test('rejects when emails are same with whitespace', () => {
      const result = Manager.validateEmailChange('  user@example.com  ', 'user@example.com');
      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe('EMAILS_SAME');
    });
  });

  // ==================== validateVerificationCode Tests ====================
  
  describe('validateVerificationCode', () => {
    test('accepts valid 6-digit code', () => {
      expect(Manager.validateVerificationCode('123456')).toEqual({ valid: true });
    });

    test('accepts code with leading zeros', () => {
      expect(Manager.validateVerificationCode('000001')).toEqual({ valid: true });
    });

    test('rejects null code', () => {
      const result = Manager.validateVerificationCode(null);
      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe('MISSING_CODE');
    });

    test('rejects undefined code', () => {
      const result = Manager.validateVerificationCode(undefined);
      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe('MISSING_CODE');
    });

    test('rejects empty string', () => {
      const result = Manager.validateVerificationCode('');
      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe('MISSING_CODE');
    });

    test('rejects code too short', () => {
      const result = Manager.validateVerificationCode('12345');
      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe('INVALID_CODE_LENGTH');
    });

    test('rejects code too long', () => {
      const result = Manager.validateVerificationCode('1234567');
      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe('INVALID_CODE_LENGTH');
    });

    test('rejects code with letters', () => {
      const result = Manager.validateVerificationCode('12345a');
      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe('INVALID_CODE_FORMAT');
    });

    test('rejects code with special characters', () => {
      const result = Manager.validateVerificationCode('12345-');
      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe('INVALID_CODE_FORMAT');
    });

    test('trims whitespace from code', () => {
      expect(Manager.validateVerificationCode('  123456  ')).toEqual({ valid: true });
    });
  });

  // ==================== generateVerificationCode Tests ====================
  
  describe('generateVerificationCode', () => {
    test('generates 6-digit code', () => {
      const code = Manager.generateVerificationCode();
      expect(code).toHaveLength(6);
    });

    test('generates only numeric code', () => {
      const code = Manager.generateVerificationCode();
      expect(/^\d{6}$/.test(code)).toBe(true);
    });

    test('uses provided random function', () => {
      let callCount = 0;
      const mockRandom = () => {
        callCount++;
        return 0.5; // Will generate digit 5
      };
      const code = Manager.generateVerificationCode(mockRandom);
      expect(code).toBe('555555');
      expect(callCount).toBe(6);
    });

    test('generates different codes with different random values', () => {
      const values = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6];
      let index = 0;
      const mockRandom = () => values[index++];
      const code = Manager.generateVerificationCode(mockRandom);
      expect(code).toBe('123456');
    });
  });

  // ==================== createVerificationEntry Tests ====================
  
  describe('createVerificationEntry', () => {
    test('creates entry with all fields', () => {
      const now = new Date('2024-01-01T12:00:00Z');
      const entry = Manager.createVerificationEntry('old@example.com', 'new@example.com', '123456', now);
      
      expect(entry.newEmail).toBe('new@example.com');
      expect(entry.code).toBe('123456');
      expect(entry.type).toBe('emailUpdate');
      expect(entry.oldEmail).toBe('old@example.com');
    });

    test('normalizes email addresses', () => {
      const entry = Manager.createVerificationEntry('OLD@EXAMPLE.COM', 'NEW@Example.com', '123456');
      expect(entry.oldEmail).toBe('old@example.com');
      expect(entry.newEmail).toBe('new@example.com');
    });

    test('sets expiry 15 minutes in future', () => {
      const now = new Date('2024-01-01T12:00:00Z');
      const entry = Manager.createVerificationEntry('old@example.com', 'new@example.com', '123456', now);
      const expectedExpiry = now.getTime() + 15 * 60 * 1000;
      expect(entry.expiry).toBe(expectedExpiry);
    });
  });

  // ==================== verifyCode Tests ====================
  
  describe('verifyCode', () => {
    test('accepts valid code', () => {
      const storedData = TestData.createVerificationData();
      const result = Manager.verifyCode('123456', 'old@example.com', 'new@example.com', storedData);
      expect(result.valid).toBe(true);
    });

    test('rejects invalid code format', () => {
      const storedData = TestData.createVerificationData();
      const result = Manager.verifyCode('12345', 'old@example.com', 'new@example.com', storedData);
      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe('INVALID_CODE_LENGTH');
    });

    test('rejects null stored data', () => {
      const result = Manager.verifyCode('123456', 'old@example.com', 'new@example.com', null);
      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe('CODE_NOT_FOUND');
    });

    test('rejects wrong type', () => {
      const storedData = TestData.createVerificationData({ type: 'passwordReset' });
      const result = Manager.verifyCode('123456', 'old@example.com', 'new@example.com', storedData);
      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe('INVALID_CODE_TYPE');
    });

    test('rejects old email mismatch', () => {
      const storedData = TestData.createVerificationData();
      const result = Manager.verifyCode('123456', 'different@example.com', 'new@example.com', storedData);
      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe('EMAIL_MISMATCH_OLD');
    });

    test('rejects new email mismatch', () => {
      const storedData = TestData.createVerificationData();
      const result = Manager.verifyCode('123456', 'old@example.com', 'different@example.com', storedData);
      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe('EMAIL_MISMATCH_NEW');
    });

    test('rejects expired code', () => {
      const expiredData = TestData.createVerificationData({ expiry: Date.now() - 1000 });
      const result = Manager.verifyCode('123456', 'old@example.com', 'new@example.com', expiredData);
      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe('CODE_EXPIRED');
    });

    test('rejects wrong code value', () => {
      const storedData = TestData.createVerificationData({ code: '999999' });
      const result = Manager.verifyCode('123456', 'old@example.com', 'new@example.com', storedData);
      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe('CODE_INVALID');
    });

    test('handles case-insensitive email comparison', () => {
      const storedData = TestData.createVerificationData({
        oldEmail: 'old@example.com',
        newEmail: 'new@example.com'
      });
      const result = Manager.verifyCode('123456', 'OLD@EXAMPLE.COM', 'NEW@EXAMPLE.COM', storedData);
      expect(result.valid).toBe(true);
    });
  });

  // ==================== transformGroupsToMembershipInfo Tests ====================
  
  describe('transformGroupsToMembershipInfo', () => {
    test('transforms array of groups', () => {
      const groups = [
        { email: 'group1@example.com' },
        { email: 'group2@example.com' }
      ];
      const result = Manager.transformGroupsToMembershipInfo(groups, 'old@example.com', 'new@example.com');
      
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        groupEmail: 'group1@example.com',
        oldEmail: 'old@example.com',
        newEmail: 'new@example.com',
        status: 'Pending'
      });
    });

    test('normalizes emails', () => {
      const groups = [{ email: 'GROUP@Example.com' }];
      const result = Manager.transformGroupsToMembershipInfo(groups, 'OLD@Example.com', 'NEW@Example.com');
      
      expect(result[0].oldEmail).toBe('old@example.com');
      expect(result[0].newEmail).toBe('new@example.com');
    });

    test('handles empty array', () => {
      expect(Manager.transformGroupsToMembershipInfo([], 'old@example.com', 'new@example.com')).toEqual([]);
    });

    test('handles null/undefined', () => {
      expect(Manager.transformGroupsToMembershipInfo(null, 'old@example.com', 'new@example.com')).toEqual([]);
      expect(Manager.transformGroupsToMembershipInfo(undefined, 'old@example.com', 'new@example.com')).toEqual([]);
    });

    test('handles missing email property', () => {
      const groups = [{ name: 'Group 1' }];
      const result = Manager.transformGroupsToMembershipInfo(groups, 'old@example.com', 'new@example.com');
      expect(result[0].groupEmail).toBe('');
    });
  });

  // ==================== updateMembershipResult Tests ====================
  
  describe('updateMembershipResult', () => {
    test('updates to success', () => {
      const membership = TestData.createGroupMembershipInfo();
      const result = Manager.updateMembershipResult(membership, true);
      
      expect(result.status).toBe('Success');
      expect(result.error).toBeUndefined();
    });

    test('updates to failed with error', () => {
      const membership = TestData.createGroupMembershipInfo();
      const result = Manager.updateMembershipResult(membership, false, 'Access denied');
      
      expect(result.status).toBe('Failed');
      expect(result.error).toBe('Access denied');
    });

    test('preserves other properties', () => {
      const membership = TestData.createGroupMembershipInfo({
        groupEmail: 'specific@example.com',
        oldEmail: 'specific-old@example.com'
      });
      const result = Manager.updateMembershipResult(membership, true);
      
      expect(result.groupEmail).toBe('specific@example.com');
      expect(result.oldEmail).toBe('specific-old@example.com');
    });
  });

  // ==================== aggregateResults Tests ====================
  
  describe('aggregateResults', () => {
    test('reports all success', () => {
      const results = [
        TestData.createGroupMembershipInfo({ status: 'Success' }),
        TestData.createGroupMembershipInfo({ status: 'Success' })
      ];
      const aggregate = Manager.aggregateResults(results);
      
      expect(aggregate.success).toBe(true);
      expect(aggregate.successCount).toBe(2);
      expect(aggregate.failedCount).toBe(0);
      expect(aggregate.message).toContain('2 group(s)');
    });

    test('reports all failed', () => {
      const results = [
        TestData.createGroupMembershipInfo({ status: 'Failed' }),
        TestData.createGroupMembershipInfo({ status: 'Failed' })
      ];
      const aggregate = Manager.aggregateResults(results);
      
      expect(aggregate.success).toBe(false);
      expect(aggregate.successCount).toBe(0);
      expect(aggregate.failedCount).toBe(2);
      expect(aggregate.message).toContain('Failed');
    });

    test('reports partial success', () => {
      const results = [
        TestData.createGroupMembershipInfo({ status: 'Success' }),
        TestData.createGroupMembershipInfo({ status: 'Failed' })
      ];
      const aggregate = Manager.aggregateResults(results);
      
      expect(aggregate.success).toBe(false);
      expect(aggregate.successCount).toBe(1);
      expect(aggregate.failedCount).toBe(1);
    });

    test('reports pending as not complete', () => {
      const results = [
        TestData.createGroupMembershipInfo({ status: 'Pending' })
      ];
      const aggregate = Manager.aggregateResults(results);
      
      expect(aggregate.success).toBe(false);
      expect(aggregate.message).toContain('pending');
    });

    test('handles empty array', () => {
      const aggregate = Manager.aggregateResults([]);
      
      expect(aggregate.success).toBe(true);
      expect(aggregate.message).toBe('No groups to update');
      expect(aggregate.successCount).toBe(0);
    });

    test('handles null/undefined', () => {
      expect(Manager.aggregateResults(null).success).toBe(true);
      expect(Manager.aggregateResults(undefined).success).toBe(true);
    });
  });

  // ==================== createUpdatedMemberRecord Tests ====================
  
  describe('createUpdatedMemberRecord', () => {
    test('creates updated record with new email', () => {
      const original = TestData.createMemberRecord();
      const result = Manager.createUpdatedMemberRecord(original, 'new@example.com');
      
      expect(result.Email).toBe('new@example.com');
      expect(result.First).toBe('John'); // Preserved
      expect(result.Last).toBe('Doe');   // Preserved
    });

    test('normalizes new email', () => {
      const original = TestData.createMemberRecord();
      const result = Manager.createUpdatedMemberRecord(original, 'NEW@EXAMPLE.COM');
      
      expect(result.Email).toBe('new@example.com');
    });

    test('returns null for null original', () => {
      expect(Manager.createUpdatedMemberRecord(null, 'new@example.com')).toBeNull();
    });

    test('preserves all other fields', () => {
      const original = TestData.createMemberRecord({
        Status: 'Active',
        Phone: '(555) 123-4567',
        'Directory Share Name': true
      });
      const result = Manager.createUpdatedMemberRecord(original, 'new@example.com');
      
      expect(result.Status).toBe('Active');
      expect(result.Phone).toBe('(555) 123-4567');
      expect(result['Directory Share Name']).toBe(true);
    });
  });

  // ==================== createChangeLogEntry Tests ====================
  
  describe('createChangeLogEntry', () => {
    test('creates log entry with all fields', () => {
      const date = new Date('2024-01-15T10:30:00Z');
      const entry = Manager.createChangeLogEntry('old@example.com', 'new@example.com', date);
      
      expect(entry.date).toEqual(date);
      expect(entry.from).toBe('old@example.com');
      expect(entry.to).toBe('new@example.com');
    });

    test('normalizes emails', () => {
      const entry = Manager.createChangeLogEntry('OLD@EXAMPLE.COM', 'NEW@Example.com');
      
      expect(entry.from).toBe('old@example.com');
      expect(entry.to).toBe('new@example.com');
    });

    test('defaults to current date', () => {
      const before = new Date();
      const entry = Manager.createChangeLogEntry('old@example.com', 'new@example.com');
      const after = new Date();
      
      expect(entry.date.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(entry.date.getTime()).toBeLessThanOrEqual(after.getTime());
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

  // ==================== buildVerificationEmailContent Tests ====================
  
  describe('buildVerificationEmailContent', () => {
    test('includes code in body', () => {
      const content = Manager.buildVerificationEmailContent('123456');
      expect(content.body).toContain('123456');
    });

    test('includes code in HTML body', () => {
      const content = Manager.buildVerificationEmailContent('123456');
      expect(content.htmlBody).toContain('123456');
      expect(content.htmlBody).toContain('<strong>');
    });

    test('includes expiry time', () => {
      const content = Manager.buildVerificationEmailContent('123456');
      expect(content.body).toContain('15 minutes');
      expect(content.htmlBody).toContain('15 minutes');
    });

    test('has appropriate subject', () => {
      const content = Manager.buildVerificationEmailContent('123456');
      expect(content.subject).toContain('Verify');
      expect(content.subject).toContain('Email');
    });
  });

  // ==================== formatSendCodeResult Tests ====================
  
  describe('formatSendCodeResult', () => {
    test('formats success result', () => {
      const result = Manager.formatSendCodeResult(true, 'user@example.com');
      
      expect(result.success).toBe(true);
      expect(result.message).toContain('user@example.com');
      expect(result.error).toBeUndefined();
    });

    test('formats failure result', () => {
      const result = Manager.formatSendCodeResult(false, 'user@example.com', 'SMTP error');
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('SMTP error');
      expect(result.errorCode).toBe('EMAIL_SEND_FAILED');
    });

    test('handles missing error message', () => {
      const result = Manager.formatSendCodeResult(false, 'user@example.com');
      
      expect(result.error).toBe('Unknown error');
    });
  });

  // ==================== Constants Tests ====================
  
  describe('exported constants', () => {
    test('VERIFICATION_CONFIG has expected values', () => {
      expect(VERIFICATION_CONFIG.CODE_LENGTH).toBe(6);
      expect(VERIFICATION_CONFIG.EXPIRY_MINUTES).toBe(15);
    });

    test('EMAIL_REGEX matches valid emails', () => {
      expect(EMAIL_REGEX.test('user@example.com')).toBe(true);
      expect(EMAIL_REGEX.test('user.name@example.co.uk')).toBe(true);
    });

    test('EMAIL_REGEX rejects invalid emails', () => {
      expect(EMAIL_REGEX.test('invalid')).toBe(false);
      expect(EMAIL_REGEX.test('user@')).toBe(false);
      expect(EMAIL_REGEX.test('@example.com')).toBe(false);
    });
  });
});
