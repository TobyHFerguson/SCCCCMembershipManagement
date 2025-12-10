// @ts-check
/**
 * Test suite for VerificationCode module
 * Tests both the Manager (pure logic) and VerificationCode (GAS layer) components
 */

const { 
  VerificationCode, 
  VerificationCodeManager, 
  VERIFICATION_CONFIG 
} = require('../src/common/auth/VerificationCode');

describe('VerificationCodeManager - Pure Logic', () => {
  
  // ==================== generateCode Tests ====================
  
  describe('generateCode', () => {
    test('generates 6-digit code', () => {
      const code = VerificationCodeManager.generateCode();
      expect(code).toHaveLength(6);
      expect(/^\d{6}$/.test(code)).toBe(true);
    });

    test('pads codes with leading zeros', () => {
      // Mock random to return small number
      const code = VerificationCodeManager.generateCode(() => 0.000001);
      expect(code).toMatch(/^0+\d$/);
      expect(code).toHaveLength(6);
    });

    test('handles maximum value', () => {
      // Mock random to return just under 1
      const code = VerificationCodeManager.generateCode(() => 0.999999);
      expect(code).toHaveLength(6);
      expect(/^\d{6}$/.test(code)).toBe(true);
    });

    test('generates unique codes', () => {
      const codes = new Set();
      for (let i = 0; i < 100; i++) {
        codes.add(VerificationCodeManager.generateCode());
      }
      // With random generation, we should have mostly unique codes
      expect(codes.size).toBeGreaterThan(90);
    });
  });

  // ==================== validateCodeFormat Tests ====================
  
  describe('validateCodeFormat', () => {
    test('accepts valid 6-digit codes', () => {
      expect(VerificationCodeManager.validateCodeFormat('123456')).toEqual({ valid: true });
      expect(VerificationCodeManager.validateCodeFormat('000000')).toEqual({ valid: true });
      expect(VerificationCodeManager.validateCodeFormat('999999')).toEqual({ valid: true });
    });

    test('accepts codes with whitespace that can be trimmed', () => {
      expect(VerificationCodeManager.validateCodeFormat(' 123456 ')).toEqual({ valid: true });
    });

    test('rejects empty or non-string values', () => {
      expect(VerificationCodeManager.validateCodeFormat('')).toEqual({ 
        valid: false, 
        error: 'Code must be a non-empty string' 
      });
      expect(VerificationCodeManager.validateCodeFormat(null)).toEqual({ 
        valid: false, 
        error: 'Code must be a non-empty string' 
      });
      expect(VerificationCodeManager.validateCodeFormat(undefined)).toEqual({ 
        valid: false, 
        error: 'Code must be a non-empty string' 
      });
    });

    test('rejects wrong length codes', () => {
      expect(VerificationCodeManager.validateCodeFormat('12345')).toEqual({ 
        valid: false, 
        error: 'Code must be exactly 6 digits' 
      });
      expect(VerificationCodeManager.validateCodeFormat('1234567')).toEqual({ 
        valid: false, 
        error: 'Code must be exactly 6 digits' 
      });
    });

    test('rejects non-numeric codes', () => {
      expect(VerificationCodeManager.validateCodeFormat('12345a')).toEqual({ 
        valid: false, 
        error: 'Code must contain only digits' 
      });
      expect(VerificationCodeManager.validateCodeFormat('abc123')).toEqual({ 
        valid: false, 
        error: 'Code must contain only digits' 
      });
    });
  });

  // ==================== validateEmail Tests ====================
  
  describe('validateEmail', () => {
    test('accepts valid emails', () => {
      expect(VerificationCodeManager.validateEmail('test@example.com')).toEqual({ valid: true });
      expect(VerificationCodeManager.validateEmail('user.name@domain.org')).toEqual({ valid: true });
      expect(VerificationCodeManager.validateEmail('user+tag@example.com')).toEqual({ valid: true });
    });

    test('rejects empty or non-string values', () => {
      expect(VerificationCodeManager.validateEmail('')).toEqual({ 
        valid: false, 
        error: 'Email must be a non-empty string' 
      });
      expect(VerificationCodeManager.validateEmail(null)).toEqual({ 
        valid: false, 
        error: 'Email must be a non-empty string' 
      });
    });

    test('rejects invalid email formats', () => {
      expect(VerificationCodeManager.validateEmail('notanemail')).toEqual({ 
        valid: false, 
        error: 'Invalid email format' 
      });
      expect(VerificationCodeManager.validateEmail('@nodomain')).toEqual({ 
        valid: false, 
        error: 'Invalid email format' 
      });
      expect(VerificationCodeManager.validateEmail('no@tld')).toEqual({ 
        valid: false, 
        error: 'Invalid email format' 
      });
    });
  });

  // ==================== calculateExpiry Tests ====================
  
  describe('calculateExpiry', () => {
    test('calculates default expiry (10 minutes)', () => {
      const now = new Date('2025-01-01T12:00:00Z');
      const expiry = VerificationCodeManager.calculateExpiry(now);
      
      expect(expiry.toISOString()).toBe('2025-01-01T12:10:00.000Z');
    });

    test('calculates custom expiry', () => {
      const now = new Date('2025-01-01T12:00:00Z');
      const expiry = VerificationCodeManager.calculateExpiry(now, 30);
      
      expect(expiry.toISOString()).toBe('2025-01-01T12:30:00.000Z');
    });
  });

  // ==================== isExpired Tests ====================
  
  describe('isExpired', () => {
    test('returns false for future expiry', () => {
      const future = new Date(Date.now() + 60000).toISOString();
      expect(VerificationCodeManager.isExpired(future)).toBe(false);
    });

    test('returns true for past expiry', () => {
      const past = new Date(Date.now() - 60000).toISOString();
      expect(VerificationCodeManager.isExpired(past)).toBe(true);
    });

    test('returns true for null/undefined expiry', () => {
      expect(VerificationCodeManager.isExpired(null)).toBe(true);
      expect(VerificationCodeManager.isExpired(undefined)).toBe(true);
      expect(VerificationCodeManager.isExpired('')).toBe(true);
    });

    test('returns true for invalid date string', () => {
      expect(VerificationCodeManager.isExpired('invalid')).toBe(true);
    });

    test('handles exact boundary correctly', () => {
      const now = new Date('2025-01-01T12:00:00Z');
      const expiry = '2025-01-01T12:00:00.000Z';
      
      expect(VerificationCodeManager.isExpired(expiry, now)).toBe(true);
    });
  });

  // ==================== isMaxAttemptsExceeded Tests ====================
  
  describe('isMaxAttemptsExceeded', () => {
    test('returns false when under limit', () => {
      expect(VerificationCodeManager.isMaxAttemptsExceeded(0)).toBe(false);
      expect(VerificationCodeManager.isMaxAttemptsExceeded(1)).toBe(false);
      expect(VerificationCodeManager.isMaxAttemptsExceeded(2)).toBe(false);
    });

    test('returns true at or above limit', () => {
      expect(VerificationCodeManager.isMaxAttemptsExceeded(3)).toBe(true);
      expect(VerificationCodeManager.isMaxAttemptsExceeded(5)).toBe(true);
    });

    test('respects custom limit', () => {
      expect(VerificationCodeManager.isMaxAttemptsExceeded(4, 5)).toBe(false);
      expect(VerificationCodeManager.isMaxAttemptsExceeded(5, 5)).toBe(true);
    });
  });

  // ==================== createEntry Tests ====================
  
  describe('createEntry', () => {
    test('creates valid entry', () => {
      const now = new Date('2025-01-01T12:00:00Z');
      const entry = VerificationCodeManager.createEntry('Test@Example.COM', '123456', now, 'TestService');
      
      expect(entry.email).toBe('test@example.com'); // normalized
      expect(entry.code).toBe('123456');
      expect(entry.createdAt).toBe('2025-01-01T12:00:00.000Z');
      expect(entry.expiresAt).toBe('2025-01-01T12:10:00.000Z');
      expect(entry.attempts).toBe(0);
      expect(entry.used).toBe(false);
      expect(entry.service).toBe('TestService');
    });

    test('creates entry without service', () => {
      const entry = VerificationCodeManager.createEntry('test@example.com', '123456');
      expect(entry.service).toBeUndefined();
    });
  });

  // ==================== verifyCode Tests ====================
  
  describe('verifyCode', () => {
    const createTestEntry = (overrides = {}) => ({
      email: 'test@example.com',
      code: '123456',
      createdAt: new Date('2025-01-01T12:00:00Z').toISOString(),
      expiresAt: new Date('2025-01-01T12:10:00Z').toISOString(),
      attempts: 0,
      used: false,
      ...overrides
    });

    test('succeeds with correct code', () => {
      const entry = createTestEntry();
      const now = new Date('2025-01-01T12:05:00Z');
      
      const result = VerificationCodeManager.verifyCode('123456', entry, now);
      
      expect(result.success).toBe(true);
      expect(result.email).toBe('test@example.com');
    });

    test('fails with incorrect code', () => {
      const entry = createTestEntry();
      const now = new Date('2025-01-01T12:05:00Z');
      
      const result = VerificationCodeManager.verifyCode('000000', entry, now);
      
      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('INCORRECT_CODE');
    });

    test('fails with invalid format', () => {
      const entry = createTestEntry();
      
      const result = VerificationCodeManager.verifyCode('12345', entry);
      
      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('INVALID_FORMAT');
    });

    test('fails when no entry exists', () => {
      const result = VerificationCodeManager.verifyCode('123456', null);
      
      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('NO_CODE');
    });

    test('fails when code is used', () => {
      const entry = createTestEntry({ used: true });
      
      const result = VerificationCodeManager.verifyCode('123456', entry);
      
      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('ALREADY_USED');
    });

    test('fails when code is expired', () => {
      const entry = createTestEntry();
      const now = new Date('2025-01-01T12:15:00Z'); // After expiry
      
      const result = VerificationCodeManager.verifyCode('123456', entry, now);
      
      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('EXPIRED');
    });

    test('fails when max attempts exceeded', () => {
      const entry = createTestEntry({ attempts: 3 });
      const now = new Date('2025-01-01T12:05:00Z');
      
      const result = VerificationCodeManager.verifyCode('123456', entry, now);
      
      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('MAX_ATTEMPTS');
    });

    test('handles whitespace in input code', () => {
      const entry = createTestEntry();
      const now = new Date('2025-01-01T12:05:00Z');
      
      const result = VerificationCodeManager.verifyCode(' 123456 ', entry, now);
      
      expect(result.success).toBe(true);
    });
  });

  // ==================== checkGenerationRateLimit Tests ====================
  
  describe('checkGenerationRateLimit', () => {
    test('allows when no previous entries', () => {
      const result = VerificationCodeManager.checkGenerationRateLimit([]);
      
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(5);
    });

    test('allows when under limit', () => {
      const now = new Date('2025-01-01T12:00:00Z');
      /** @type {any[]} */
      const entries = [
        { createdAt: new Date('2025-01-01T11:30:00Z').toISOString() },
        { createdAt: new Date('2025-01-01T11:45:00Z').toISOString() }
      ];
      
      const result = VerificationCodeManager.checkGenerationRateLimit(entries, now);
      
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(3);
    });

    test('blocks when at limit', () => {
      const now = new Date('2025-01-01T12:00:00Z');
      const entries = [
        { createdAt: new Date('2025-01-01T11:10:00Z').toISOString() },
        { createdAt: new Date('2025-01-01T11:20:00Z').toISOString() },
        { createdAt: new Date('2025-01-01T11:30:00Z').toISOString() },
        { createdAt: new Date('2025-01-01T11:40:00Z').toISOString() },
        { createdAt: new Date('2025-01-01T11:50:00Z').toISOString() }
      ];
      
      // @ts-expect-error - Partial test data, only testing rate limit logic
      const result = VerificationCodeManager.checkGenerationRateLimit(entries, now);
      
      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
      expect(result.retryAfter).toBeGreaterThan(0);
    });

    test('ignores entries outside rate limit window', () => {
      const now = new Date('2025-01-01T12:00:00Z');
      const entries = [
        { createdAt: new Date('2025-01-01T10:00:00Z').toISOString() }, // 2 hours ago - outside window
        { createdAt: new Date('2025-01-01T11:01:00Z').toISOString() }  // Inside window
      ];
      
      // @ts-expect-error - Partial test data, only testing time window logic
      const result = VerificationCodeManager.checkGenerationRateLimit(entries, now);
      
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(4); // Only 1 in window
    });
  });

  // ==================== filterActiveEntries Tests ====================
  
  describe('filterActiveEntries', () => {
    test('filters out used entries', () => {
      const now = new Date('2025-01-01T12:05:00Z');
      const entries = [
        { 
          used: false, 
          expiresAt: new Date('2025-01-01T12:10:00Z').toISOString(),
          attempts: 0 
        },
        { 
          used: true, 
          expiresAt: new Date('2025-01-01T12:10:00Z').toISOString(),
          attempts: 0 
        }
      ];
      
      // @ts-expect-error - Partial test data for filter logic
      const result = VerificationCodeManager.filterActiveEntries(entries, now);
      
      expect(result).toHaveLength(1);
    });

    test('filters out expired entries', () => {
      const now = new Date('2025-01-01T12:15:00Z');
      const entries = [
        { 
          used: false, 
          expiresAt: new Date('2025-01-01T12:10:00Z').toISOString(), // Expired
          attempts: 0 
        },
        { 
          used: false, 
          expiresAt: new Date('2025-01-01T12:20:00Z').toISOString(), // Still valid
          attempts: 0 
        }
      ];
      
      // @ts-expect-error - Partial test data for filter logic
      const result = VerificationCodeManager.filterActiveEntries(entries, now);
      
      expect(result).toHaveLength(1);
    });

    test('filters out max attempts exceeded', () => {
      const now = new Date('2025-01-01T12:05:00Z');
      const entries = [
        { 
          used: false, 
          expiresAt: new Date('2025-01-01T12:10:00Z').toISOString(),
          attempts: 0 
        },
        { 
          used: false, 
          expiresAt: new Date('2025-01-01T12:10:00Z').toISOString(),
          attempts: 5 
        }
      ];
      
      // @ts-expect-error - Partial test data for filter logic
      const result = VerificationCodeManager.filterActiveEntries(entries, now);
      
      expect(result).toHaveLength(1);
    });
  });

  // ==================== getConfig Tests ====================
  
  describe('getConfig', () => {
    test('returns configuration', () => {
      const config = VerificationCodeManager.getConfig();
      
      expect(config.CODE_LENGTH).toBe(6);
      expect(config.CODE_EXPIRY_MINUTES).toBe(10);
      expect(config.MAX_VERIFICATION_ATTEMPTS).toBe(3);
      expect(config.MAX_CODES_PER_EMAIL_PER_HOUR).toBe(5);
    });

    test('returns a copy, not the original', () => {
      const config1 = VerificationCodeManager.getConfig();
      const config2 = VerificationCodeManager.getConfig();
      
      config1.CODE_LENGTH = 10;
      expect(config2.CODE_LENGTH).toBe(6);
    });
  });
});

describe('VerificationCode - GAS Layer', () => {
  let mockCache;
  let mockMailApp;
  
  beforeEach(() => {
    // Reset mock cache for each test
    mockCache = {};
    
    // Mock CacheService
    global.CacheService = {
      getScriptCache: () => ({
      get: (key) => mockCache[key] || null,
        // @ts-expect-error - Simplified mock for testing
        put: (key, value, expirationInSeconds) => { mockCache[key] = value; },
        remove: (key) => { delete mockCache[key]; },
      })
    };
    
    // Mock MailApp
    mockMailApp = {
      sendEmail: jest.fn()
    };
    // @ts-expect-error - Partial mock for testing
    global.MailApp = mockMailApp;
    
    // Mock Logger
    // @ts-ignore - Partial mock for testing
    global.Logger = {
      log: jest.fn(),
      clear: jest.fn(),
      getLog: jest.fn(() => ''),
    };
  });

  afterEach(() => {
    delete global.CacheService;
    delete global.MailApp;
    delete global.Logger;
  });

  // ==================== getVerificationConfig Tests ====================
  
  describe('getVerificationConfig', () => {
    beforeEach(() => {
      // Mock PropertiesService for config tests
      global.PropertiesService = {
        // @ts-expect-error - Partial Properties mock
        getScriptProperties: () => ({
          getProperty: (key) => {
            // Return some test values
            const props = {
              'VERIFICATION_CODE_LENGTH': '8',
              'VERIFICATION_CODE_EXPIRY_MINUTES': '15',
              'VERIFICATION_MAX_ATTEMPTS': '5',
              'VERIFICATION_MAX_CODES_PER_HOUR': '100',
              'VERIFICATION_RATE_LIMIT_MINUTES': '30'
            };
            return props[key];
          }
        })
      };
    });

    afterEach(() => {
      delete global.PropertiesService;
    });

    test('reads config from PropertiesService when available', () => {
      const config = VerificationCode.getVerificationConfig();
      
      expect(config.CODE_LENGTH).toBe(8);
      expect(config.CODE_EXPIRY_MINUTES).toBe(15);
      expect(config.MAX_VERIFICATION_ATTEMPTS).toBe(5);
      expect(config.MAX_CODES_PER_EMAIL_PER_HOUR).toBe(100);
      expect(config.RATE_LIMIT_WINDOW_MINUTES).toBe(30);
    });

    test('falls back to defaults when PropertiesService throws error', () => {
      const originalPropertiesService = global.PropertiesService;
      // @ts-expect-error - Partial mock for testing
      global.PropertiesService = {
        getScriptProperties: () => {
          throw new Error('Properties error');
        }
      };
      
      const config = VerificationCode.getVerificationConfig();
      
      // Should return defaults
      expect(config.CODE_LENGTH).toBe(6);
      expect(config.CODE_EXPIRY_MINUTES).toBe(10);
      expect(config.MAX_VERIFICATION_ATTEMPTS).toBe(3);
      expect(config.MAX_CODES_PER_EMAIL_PER_HOUR).toBe(5);
      expect(config.RATE_LIMIT_WINDOW_MINUTES).toBe(60);
      
      global.PropertiesService = originalPropertiesService;
    });
  });

  // ==================== generateAndStore Tests ====================
  
  describe('generateAndStore', () => {
    test('generates and stores code successfully', () => {
      const result = VerificationCode.generateAndStore('test@example.com');
      
      expect(result.success).toBe(true);
      expect(result.code).toHaveLength(6);
      expect(/^\d{6}$/.test(result.code)).toBe(true);
    });

    test('normalizes email address', () => {
      VerificationCode.generateAndStore('Test@EXAMPLE.com');
      
      // Check that entry is stored with normalized email
      expect(mockCache['vc_test@example.com']).toBeDefined();
    });

    test('fails for invalid email', () => {
      const result = VerificationCode.generateAndStore('notanemail');
      
      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('INVALID_EMAIL');
    });

    test('tracks rate limit history across multiple code generations', () => {
      // Generate 5 codes (the limit)
      for (let i = 0; i < 5; i++) {
        const result = VerificationCode.generateAndStore('test@example.com');
        expect(result.success).toBe(true);
      }
      
      // The 6th should be rate limited
      const result = VerificationCode.generateAndStore('test@example.com');
      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('RATE_LIMITED');
      
      // Check that rate limit history is stored
      expect(mockCache['rl_test@example.com']).toBeDefined();
      const history = JSON.parse(mockCache['rl_test@example.com']);
      expect(history).toHaveLength(5);
    });

    test('rate limiting is per-email', () => {
      // Generate codes for two different emails
      for (let i = 0; i < 5; i++) {
        VerificationCode.generateAndStore('user1@example.com');
      }
      
      // user2 should not be rate limited
      const result = VerificationCode.generateAndStore('user2@example.com');
      expect(result.success).toBe(true);
    });

    test('handles corrupt rate limit data gracefully', () => {
      // Put corrupt data in cache
      mockCache['rl_test@example.com'] = 'not valid json';
      
      // Should still work, falling back to empty history
      const result = VerificationCode.generateAndStore('test@example.com');
      expect(result.success).toBe(true);
      expect(global.Logger.log).toHaveBeenCalledWith(expect.stringContaining('[VerificationCode._getRateLimitHistory] Error'));
    });
  });

  // ==================== verify Tests ====================
  
  describe('verify', () => {
    test('verifies correct code successfully', () => {
      // First generate a code
      const genResult = VerificationCode.generateAndStore('test@example.com');
      expect(genResult.success).toBe(true);
      
      // Then verify it
      const verifyResult = VerificationCode.verify('test@example.com', genResult.code);
      
      expect(verifyResult.success).toBe(true);
      expect(verifyResult.email).toBe('test@example.com');
    });

    test('fails for incorrect code', () => {
      VerificationCode.generateAndStore('test@example.com');
      
      const result = VerificationCode.verify('test@example.com', '000000');
      
      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('INCORRECT_CODE');
    });

    test('fails for invalid email', () => {
      const result = VerificationCode.verify('notanemail', '123456');
      
      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('INVALID_EMAIL');
    });

    test('increments attempts on each try', () => {
      VerificationCode.generateAndStore('test@example.com');
      
      // First wrong attempt
      VerificationCode.verify('test@example.com', '000000');
      
      // Check attempts incremented
      const entry = JSON.parse(mockCache['vc_test@example.com']);
      expect(entry.attempts).toBe(1);
      
      // Second wrong attempt
      VerificationCode.verify('test@example.com', '000001');
      
      const entry2 = JSON.parse(mockCache['vc_test@example.com']);
      expect(entry2.attempts).toBe(2);
    });

    test('marks code as used after success', () => {
      const genResult = VerificationCode.generateAndStore('test@example.com');
      VerificationCode.verify('test@example.com', genResult.code);
      
      const entry = JSON.parse(mockCache['vc_test@example.com']);
      expect(entry.used).toBe(true);
    });

    test('fails for already used code', () => {
      const genResult = VerificationCode.generateAndStore('test@example.com');
      
      // First verification succeeds
      const result1 = VerificationCode.verify('test@example.com', genResult.code);
      expect(result1.success).toBe(true);
      
      // Second verification fails
      const result2 = VerificationCode.verify('test@example.com', genResult.code);
      expect(result2.success).toBe(false);
      expect(result2.errorCode).toBe('ALREADY_USED');
    });
  });

  // ==================== sendCodeEmail Tests ====================
  
  describe('sendCodeEmail', () => {
    test('sends email with formatted code', () => {
      const result = VerificationCode.sendCodeEmail('test@example.com', '123456', 'Test Service');
      
      expect(result.success).toBe(true);
      expect(mockMailApp.sendEmail).toHaveBeenCalledTimes(1);
      
      const emailArg = mockMailApp.sendEmail.mock.calls[0][0];
      expect(emailArg.to).toBe('test@example.com');
      expect(emailArg.subject).toContain('Test Service');
      expect(emailArg.body).toContain('123-456'); // Formatted code
    });

    test('handles email error gracefully', () => {
      mockMailApp.sendEmail.mockImplementation(() => {
        throw new Error('Email failed');
      });
      
      const result = VerificationCode.sendCodeEmail('test@example.com', '123456', 'Test Service');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to send');
    });
  });

  // ==================== requestCode Tests ====================
  
  describe('requestCode', () => {
    test('generates code and sends email', () => {
      const result = VerificationCode.requestCode('test@example.com', 'Test Service');
      
      expect(result.success).toBe(true);
      expect(mockMailApp.sendEmail).toHaveBeenCalled();
      // Code should NOT be returned (security)
      // @ts-expect-error
      expect(result.code).toBeUndefined();
    });
  });

  // ==================== clearCodes Tests ====================
  
  describe('clearCodes', () => {
    test('clears codes for email', () => {
      VerificationCode.generateAndStore('test@example.com');
      expect(mockCache['vc_test@example.com']).toBeDefined();
      
      VerificationCode.clearCodes('test@example.com');
      
      expect(mockCache['vc_test@example.com']).toBeUndefined();
    });

    test('normalizes email', () => {
      VerificationCode.generateAndStore('test@example.com');
      
      VerificationCode.clearCodes('TEST@Example.COM');
      
      expect(mockCache['vc_test@example.com']).toBeUndefined();
    });
  });

  // ==================== clearRateLimitForEmail Tests ====================
  
  describe('clearRateLimitForEmail', () => {
    test('clears rate limit for specific email', () => {
      // Generate some codes to create rate limit history
      VerificationCode.generateAndStore('test@example.com');
      expect(mockCache['rl_test@example.com']).toBeDefined();
      
      const result = VerificationCode.clearRateLimitForEmail('test@example.com');
      
      expect(result).toBe(true);
      expect(mockCache['rl_test@example.com']).toBeUndefined();
    });

    test('normalizes email', () => {
      VerificationCode.generateAndStore('test@example.com');
      
      const result = VerificationCode.clearRateLimitForEmail('TEST@Example.COM');
      
      expect(result).toBe(true);
      expect(mockCache['rl_test@example.com']).toBeUndefined();
    });

    test('handles errors gracefully', () => {
      // Mock CacheService to throw error
      const originalGetScriptCache = global.CacheService.getScriptCache;
      global.CacheService.getScriptCache = jest.fn(() => {
        throw new Error('Cache error');
      });
      
      const result = VerificationCode.clearRateLimitForEmail('test@example.com');
      
      expect(result).toBe(false);
      global.CacheService.getScriptCache = originalGetScriptCache;
    });
  });

  // ==================== clearAllVerificationData Tests ====================
  
  describe('clearAllVerificationData', () => {
    test('returns expected result structure', () => {
      const result = VerificationCode.clearAllVerificationData();
      
      expect(result).toHaveProperty('cleared');
      expect(result).toHaveProperty('errors');
      expect(result.cleared).toBe(0);
      expect(result.errors).toBe(0);
    });

    test('handles errors gracefully', () => {
      // Mock CacheService to throw error
      const originalGetScriptCache = global.CacheService.getScriptCache;
      global.CacheService.getScriptCache = jest.fn(() => {
        throw new Error('Cache error');
      });
      
      const result = VerificationCode.clearAllVerificationData();
      
      expect(result.errors).toBe(1);
      global.CacheService.getScriptCache = originalGetScriptCache;
    });
  });
});
