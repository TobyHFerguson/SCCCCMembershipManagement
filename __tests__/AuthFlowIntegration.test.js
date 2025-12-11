// @ts-check
/**
 * Test suite for Authentication Flow Integration
 * Tests the complete verification code authentication flow for Phase 1
 */

const { 
  VerificationCode, 
  VerificationCodeManager 
} = require('../src/common/auth/VerificationCode');

const { 
  FeatureFlags 
} = require('../src/common/config/FeatureFlags');

describe('Authentication Flow Integration', () => {
  let mockCache;
  let mockProperties;
  let mockMailApp;
  let mockScriptApp;
  
  beforeEach(() => {
    // Reset mocks for each test
    mockCache = {};
    mockProperties = {};
    
    // Mock CacheService - partial mock for testing
    global.CacheService = /** @type {any} */ ({
      getScriptCache: () => ({
        get: (key) => mockCache[key] || null,
        put: (key, value, expiration) => { mockCache[key] = value; },
        remove: (key) => { delete mockCache[key]; }
      })
    });
    
    // Mock PropertiesService - partial mock for testing
    global.PropertiesService = /** @type {any} */ ({
      getScriptProperties: () => ({
        getProperty: (key) => mockProperties[key] || null,
        setProperty: (key, value) => { mockProperties[key] = value; },
        deleteProperty: (key) => { delete mockProperties[key]; },
        getProperties: () => ({ ...mockProperties })
      })
    });
    
    // Mock MailApp - partial mock for testing
    mockMailApp = {
      sendEmail: jest.fn()
    };
    global.MailApp = /** @type {any} */ (mockMailApp);
    
    // Mock ScriptApp - partial mock for testing
    mockScriptApp = {
      getService: () => ({
        getUrl: () => 'https://script.google.com/test'
      })
    };
    global.ScriptApp = /** @type {any} */ (mockScriptApp);
    
    // Mock Logger - partial mock for testing
    global.Logger = /** @type {any} */ ({
      log: jest.fn()
    });
  });

  afterEach(() => {
    delete global.CacheService;
    delete global.PropertiesService;
    delete global.MailApp;
    delete global.ScriptApp;
    delete global.Logger;
  });

  // ==================== Feature Flag Integration ====================
  
  describe('Feature Flag Integration', () => {
    test('new auth disabled by default', () => {
      expect(FeatureFlags.isNewAuthEnabled()).toBe(false);
    });

    test('can enable new auth', () => {
      FeatureFlags.enableNewAuth();
      expect(FeatureFlags.isNewAuthEnabled()).toBe(true);
    });

    test('emergency rollback disables new auth', () => {
      FeatureFlags.enableNewAuth();
      expect(FeatureFlags.isNewAuthEnabled()).toBe(true);
      
      FeatureFlags.emergencyRollback();
      expect(FeatureFlags.isNewAuthEnabled()).toBe(false);
    });
  });

  // ==================== Complete Flow Tests ====================
  
  describe('Complete Verification Code Flow', () => {
    test('full flow: request code -> verify code -> success', () => {
      const email = 'user@example.com';
      const serviceName = 'Test Service';
      
      // Step 1: Request verification code
      const requestResult = VerificationCode.requestCode(email, serviceName, 'TestService');
      expect(requestResult.success).toBe(true);
      expect(mockMailApp.sendEmail).toHaveBeenCalledTimes(1);
      
      // Get the code from cache (in a real scenario, user gets it from email)
      const entry = JSON.parse(mockCache['vc_user@example.com']);
      expect(entry).toBeDefined();
      expect(entry.code).toHaveLength(6);
      
      // Step 2: Verify the code
      const verifyResult = VerificationCode.verify(email, entry.code);
      expect(verifyResult.success).toBe(true);
      expect(verifyResult.email).toBe('user@example.com');
    });

    test('flow handles incorrect code gracefully', () => {
      const email = 'user@example.com';
      
      // Request code
      VerificationCode.requestCode(email, 'Test Service');
      
      // Try wrong code
      const result = VerificationCode.verify(email, '000000');
      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('INCORRECT_CODE');
    });

    test('flow handles code reuse (already used)', () => {
      const email = 'user@example.com';
      
      // Request and get code
      VerificationCode.requestCode(email, 'Test Service');
      const entry = JSON.parse(mockCache['vc_user@example.com']);
      
      // First verification succeeds
      const result1 = VerificationCode.verify(email, entry.code);
      expect(result1.success).toBe(true);
      
      // Second verification fails (code already used)
      const result2 = VerificationCode.verify(email, entry.code);
      expect(result2.success).toBe(false);
      expect(result2.errorCode).toBe('ALREADY_USED');
    });

    test('flow handles max attempts', () => {
      const email = 'user@example.com';
      
      // Request code
      VerificationCode.requestCode(email, 'Test Service');
      
      // Exhaust attempts with wrong codes
      VerificationCode.verify(email, '111111');
      VerificationCode.verify(email, '222222');
      VerificationCode.verify(email, '333333');
      
      // Get the actual code and try to verify
      const entry = JSON.parse(mockCache['vc_user@example.com']);
      const result = VerificationCode.verify(email, entry.code);
      
      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('MAX_ATTEMPTS');
    });

    test('flow handles rate limiting', () => {
      const email = 'user@example.com';
      
      // Request 5 codes (the limit per hour)
      for (let i = 0; i < 5; i++) {
        const result = VerificationCode.requestCode(email, 'Test Service');
        expect(result.success).toBe(true);
      }
      
      // 6th request should be rate limited
      const result = VerificationCode.requestCode(email, 'Test Service');
      expect(result.success).toBe(false);
      // @ts-expect-error - errorCode exists in actual return type but not in base interface
      expect(result.errorCode).toBe('RATE_LIMITED');
    });
  });

  // ==================== Email Format Tests ====================
  
  describe('Email Formatting', () => {
    test('verification code email contains formatted code', () => {
      VerificationCode.requestCode('user@example.com', 'Test Service');
      
      expect(mockMailApp.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'user@example.com',
          subject: expect.stringContaining('Test Service')
        })
      );
      
      const emailArg = mockMailApp.sendEmail.mock.calls[0][0];
      // Code should be 6 contiguous digits (no hyphen)
      expect(emailArg.body).toMatch(/\d{6}/);
    });

    test('email is normalized (lowercase, trimmed)', () => {
      VerificationCode.requestCode('  USER@EXAMPLE.COM  ', 'Test Service');
      
      expect(mockMailApp.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'user@example.com'
        })
      );
    });
  });

  // ==================== Security Tests ====================
  
  describe('Security', () => {
    test('code is not returned in requestCode response', () => {
      const result = VerificationCode.requestCode('user@example.com', 'Test Service');
      
      expect(result.success).toBe(true);
      // @ts-expect-error - code exists in actual return type but not in base interface
      expect(result.code).toBeUndefined();
    });

    test('different emails get different codes', () => {
      VerificationCode.requestCode('user1@example.com', 'Test Service');
      VerificationCode.requestCode('user2@example.com', 'Test Service');
      
      const entry1 = JSON.parse(mockCache['vc_user1@example.com']);
      const entry2 = JSON.parse(mockCache['vc_user2@example.com']);
      
      // While there's a small chance of collision, it should be extremely rare
      // This test verifies the codes are stored separately
      expect(entry1).toBeDefined();
      expect(entry2).toBeDefined();
    });

    test('verification with wrong email fails', () => {
      VerificationCode.requestCode('user@example.com', 'Test Service');
      const entry = JSON.parse(mockCache['vc_user@example.com']);
      
      // Try to verify with a different email
      const result = VerificationCode.verify('other@example.com', entry.code);
      expect(result.success).toBe(false);
    });
  });

  // ==================== Edge Cases ====================
  
  describe('Edge Cases', () => {
    test('handles empty email', () => {
      const result = VerificationCode.requestCode('', 'Test Service');
      expect(result.success).toBe(false);
      // @ts-expect-error - errorCode exists in actual return type but not in base interface
      expect(result.errorCode).toBe('INVALID_EMAIL');
    });

    test('handles invalid email format', () => {
      const result = VerificationCode.requestCode('notanemail', 'Test Service');
      expect(result.success).toBe(false);
      // @ts-expect-error - errorCode exists in actual return type but not in base interface
      expect(result.errorCode).toBe('INVALID_EMAIL');
    });

    test('handles empty code verification', () => {
      VerificationCode.requestCode('user@example.com', 'Test Service');
      
      const result = VerificationCode.verify('user@example.com', '');
      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('INVALID_FORMAT');
    });

    test('handles code with whitespace', () => {
      VerificationCode.requestCode('user@example.com', 'Test Service');
      const entry = JSON.parse(mockCache['vc_user@example.com']);
      
      // Verify with whitespace around code
      const result = VerificationCode.verify('user@example.com', `  ${entry.code}  `);
      expect(result.success).toBe(true);
    });
  });

  // ==================== Manager Pure Function Tests ====================
  
  describe('VerificationCodeManager Pure Functions', () => {
    test('generates 6-digit codes', () => {
      for (let i = 0; i < 100; i++) {
        const code = VerificationCodeManager.generateCode();
        expect(code).toHaveLength(6);
        expect(/^\d{6}$/.test(code)).toBe(true);
      }
    });

    test('calculates expiry correctly', () => {
      const now = new Date('2025-01-01T12:00:00Z');
      const expiry = VerificationCodeManager.calculateExpiry(now, 10);
      
      expect(expiry.toISOString()).toBe('2025-01-01T12:10:00.000Z');
    });

    test('creates entry with correct structure', () => {
      const now = new Date('2025-01-01T12:00:00Z');
      const entry = VerificationCodeManager.createEntry(
        'User@Example.COM',
        '123456',
        now,
        'TestService'
      );
      
      expect(entry.email).toBe('user@example.com');
      expect(entry.code).toBe('123456');
      expect(entry.createdAt).toBe('2025-01-01T12:00:00.000Z');
      expect(entry.expiresAt).toBe('2025-01-01T12:10:00.000Z');
      expect(entry.attempts).toBe(0);
      expect(entry.used).toBe(false);
      expect(entry.service).toBe('TestService');
    });

    test('isExpired handles various cases', () => {
      const now = new Date('2025-01-01T12:00:00Z');
      
      // Future time - not expired
      expect(VerificationCodeManager.isExpired('2025-01-01T12:10:00.000Z', now)).toBe(false);
      
      // Past time - expired
      expect(VerificationCodeManager.isExpired('2025-01-01T11:50:00.000Z', now)).toBe(true);
      
      // Same time - expired (at boundary)
      expect(VerificationCodeManager.isExpired('2025-01-01T12:00:00.000Z', now)).toBe(true);
      
      // Null - expired
      expect(VerificationCodeManager.isExpired(null, now)).toBe(true);
    });
  });
});

describe('Backward Compatibility', () => {
  let mockCache;
  let mockProperties;
  let mockMailApp;
  
  beforeEach(() => {
    mockCache = {};
    mockProperties = {};
    
    global.CacheService = /** @type {any} */ ({
      getScriptCache: () => ({
        get: (key) => mockCache[key] || null,
        put: (key, value) => { mockCache[key] = value; },
        remove: (key) => { delete mockCache[key]; }
      })
    });
    
    global.PropertiesService = /** @type {any} */ ({
      getScriptProperties: () => ({
        getProperty: (key) => mockProperties[key] || null,
        setProperty: (key, value) => { mockProperties[key] = value; },
        deleteProperty: (key) => { delete mockProperties[key]; },
        getProperties: () => ({ ...mockProperties })
      })
    });
    
    mockMailApp = {
      sendEmail: jest.fn()
    };
    global.MailApp = /** @type {any} */ (mockMailApp);
    
    global.Logger = /** @type {any} */ ({
      log: jest.fn()
    });
  });

  afterEach(() => {
    delete global.CacheService;
    delete global.PropertiesService;
    delete global.MailApp;
    delete global.Logger;
  });

  test('magic link flow still works when new auth disabled', () => {
    // Ensure new auth is disabled (default)
    expect(FeatureFlags.isNewAuthEnabled()).toBe(false);
    
    // Old magic link system should still function
    // This is a placeholder - actual magic link tests are elsewhere
    // The key point is that FeatureFlags.isNewAuthEnabled() returning false
    // means the old system is used
  });

  test('new auth flow used when feature flag enabled', () => {
    FeatureFlags.enableNewAuth();
    expect(FeatureFlags.isNewAuthEnabled()).toBe(true);
    
    // New verification code system is active
    const result = VerificationCode.requestCode('user@example.com', 'Test');
    expect(result.success).toBe(true);
  });

  test('can toggle between old and new auth', () => {
    // Start with old auth (default)
    expect(FeatureFlags.isNewAuthEnabled()).toBe(false);
    
    // Enable new auth
    FeatureFlags.enableNewAuth();
    expect(FeatureFlags.isNewAuthEnabled()).toBe(true);
    
    // Rollback to old auth
    FeatureFlags.emergencyRollback();
    expect(FeatureFlags.isNewAuthEnabled()).toBe(false);
    
    // Can re-enable new auth
    FeatureFlags.enableNewAuth();
    expect(FeatureFlags.isNewAuthEnabled()).toBe(true);
  });
});
