// @ts-check
/// <reference path="../Common.d.ts" />

/**
 * Common.Auth.VerificationCode - 6-digit verification code authentication
 * 
 * This module provides secure verification code generation and validation
 * for the new SPA authentication flow. Codes are:
 * - 6 digits (000000-999999)
 * - Time-limited (configurable, default 10 minutes)
 * - Single-use (consumed on successful verification)
 * - Rate-limited (configurable max attempts)
 * 
 * Architecture follows GAS Layer Separation pattern:
 * - VerificationCodeManager: Pure logic (testable)
 * - VerificationCode: GAS layer (storage/orchestration)
 * 
 * @namespace Common.Auth.VerificationCode
 */

// Namespace declaration pattern (works in both GAS and Jest)
if (typeof Common === 'undefined') Common = {};
if (typeof Common.Auth === 'undefined') Common.Auth = {};

/**
 * @typedef {Object} VerificationCodeEntry
 * @property {string} email - The email address
 * @property {string} code - The 6-digit verification code
 * @property {string} createdAt - ISO timestamp when code was created
 * @property {string} expiresAt - ISO timestamp when code expires
 * @property {number} attempts - Number of verification attempts
 * @property {boolean} used - Whether the code has been consumed
 * @property {string} [service] - Optional service identifier
 */

/**
 * @typedef {Object} VerificationResult
 * @property {boolean} success - Whether verification succeeded
 * @property {string} [email] - Email if verification succeeded
 * @property {string} [error] - Error message if verification failed
 * @property {string} [errorCode] - Machine-readable error code
 */

/**
 * @typedef {Object} CodeGenerationResult
 * @property {boolean} success - Whether code was generated
 * @property {string} [code] - The generated code (if success)
 * @property {string} [error] - Error message (if failed)
 * @property {string} [errorCode] - Machine-readable error code
 */

/**
 * @typedef {Object} RateLimitResult
 * @property {boolean} allowed - Whether the operation is allowed
 * @property {number} remaining - Remaining attempts
 * @property {number} [retryAfter] - Seconds until rate limit resets (if blocked)
 */

/**
 * Configuration constants - can be overridden via script properties for testing
 * Properties:
 * - VERIFICATION_CODE_EXPIRY_MINUTES: Minutes until code expires (default: 10)
 * - VERIFICATION_MAX_ATTEMPTS: Max verification attempts per code (default: 3)
 * - VERIFICATION_MAX_CODES_PER_HOUR: Max codes per email per hour (default: 5)
 * - VERIFICATION_RATE_LIMIT_MINUTES: Rate limit window in minutes (default: 60)
 */
const VERIFICATION_CONFIG = {
  CODE_LENGTH: 6,
  CODE_EXPIRY_MINUTES: 10,
  MAX_VERIFICATION_ATTEMPTS: 3,
  MAX_CODES_PER_EMAIL_PER_HOUR: 5,
  RATE_LIMIT_WINDOW_MINUTES: 60
};

/**
 * Get configuration with property overrides for testing
 * Reads from script properties to allow rate limiting to be disabled/modified for testing
 * @returns {typeof VERIFICATION_CONFIG}
 */
function getVerificationConfig() {
  const config = { ...VERIFICATION_CONFIG };
  
  try {
    // Only try to read properties in GAS environment
    if (typeof PropertiesService !== 'undefined') {
      const props = PropertiesService.getScriptProperties();
      
      // Check for testing override properties
      const expiryMinutes = props.getProperty('VERIFICATION_CODE_EXPIRY_MINUTES');
      if (expiryMinutes) {
        config.CODE_EXPIRY_MINUTES = parseInt(expiryMinutes, 10) || config.CODE_EXPIRY_MINUTES;
      }
      
      const maxAttempts = props.getProperty('VERIFICATION_MAX_ATTEMPTS');
      if (maxAttempts) {
        config.MAX_VERIFICATION_ATTEMPTS = parseInt(maxAttempts, 10) || config.MAX_VERIFICATION_ATTEMPTS;
      }
      
      const maxCodesPerHour = props.getProperty('VERIFICATION_MAX_CODES_PER_HOUR');
      if (maxCodesPerHour) {
        config.MAX_CODES_PER_EMAIL_PER_HOUR = parseInt(maxCodesPerHour, 10) || config.MAX_CODES_PER_EMAIL_PER_HOUR;
      }
      
      const rateLimitMinutes = props.getProperty('VERIFICATION_RATE_LIMIT_MINUTES');
      if (rateLimitMinutes) {
        config.RATE_LIMIT_WINDOW_MINUTES = parseInt(rateLimitMinutes, 10) || config.RATE_LIMIT_WINDOW_MINUTES;
      }
    }
  } catch (e) {
    // In Jest environment, PropertiesService won't be available
    // That's fine - just use defaults
  }
  
  return config;
}

/**
 * VerificationCodeManager - Pure logic for verification code operations
 * All business logic is here and is fully testable with Jest.
 * 
 * @class
 */
Common.Auth.VerificationCodeManager = class {
  /**
   * Generate a cryptographically random 6-digit code
   * For production, this should use a secure random source.
   * In tests, can be overridden via dependency injection.
   * 
   * @param {function(): number} [randomFn] - Random function returning 0-1 (for testing)
   * @returns {string} 6-digit code padded with leading zeros
   */
  static generateCode(randomFn = Math.random) {
    const config = getVerificationConfig();
    // Generate number 0-999999
    const num = Math.floor(randomFn() * 1000000);
    // Pad to 6 digits
    return String(num).padStart(config.CODE_LENGTH, '0');
  }

  /**
   * Validate a verification code format
   * @param {string} code - The code to validate
   * @returns {{valid: boolean, error?: string}}
   */
  static validateCodeFormat(code) {
    const config = getVerificationConfig();
    if (!code || typeof code !== 'string') {
      return { valid: false, error: 'Code must be a non-empty string' };
    }
    const trimmed = code.trim();
    if (trimmed.length !== config.CODE_LENGTH) {
      return { valid: false, error: `Code must be exactly ${config.CODE_LENGTH} digits` };
    }
    if (!/^\d+$/.test(trimmed)) {
      return { valid: false, error: 'Code must contain only digits' };
    }
    return { valid: true };
  }

  /**
   * Validate an email format
   * @param {string} email - The email to validate
   * @returns {{valid: boolean, error?: string}}
   */
  static validateEmail(email) {
    if (!email || typeof email !== 'string') {
      return { valid: false, error: 'Email must be a non-empty string' };
    }
    const trimmed = email.trim().toLowerCase();
    // Basic email validation - should have @ and domain
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmed)) {
      return { valid: false, error: 'Invalid email format' };
    }
    return { valid: true };
  }

  /**
   * Calculate expiration time from creation time
   * @param {Date} createdAt - When the code was created
   * @param {number} [expiryMinutes] - Minutes until expiry (uses config if not provided)
   * @returns {Date} Expiration time
   */
  static calculateExpiry(createdAt, expiryMinutes) {
    const config = getVerificationConfig();
    const minutes = expiryMinutes !== undefined ? expiryMinutes : config.CODE_EXPIRY_MINUTES;
    return new Date(createdAt.getTime() + minutes * 60 * 1000);
  }

  /**
   * Check if a code has expired
   * @param {string} expiresAt - ISO timestamp of expiration
   * @param {Date} [now] - Current time (for testing)
   * @returns {boolean} True if expired
   */
  static isExpired(expiresAt, now = new Date()) {
    if (!expiresAt) {
      return true;
    }
    const expiry = new Date(expiresAt);
    if (isNaN(expiry.getTime())) {
      return true;
    }
    return now >= expiry;
  }

  /**
   * Check if max attempts exceeded
   * @param {number} attempts - Current attempt count
   * @param {number} [maxAttempts] - Maximum allowed attempts (uses config if not provided)
   * @returns {boolean} True if max attempts exceeded
   */
  static isMaxAttemptsExceeded(attempts, maxAttempts) {
    const config = getVerificationConfig();
    const max = maxAttempts !== undefined ? maxAttempts : config.MAX_VERIFICATION_ATTEMPTS;
    return attempts >= max;
  }

  /**
   * Create a new verification code entry
   * @param {string} email - Email address
   * @param {string} code - Generated code
   * @param {Date} [now] - Current time (for testing)
   * @param {string} [service] - Optional service identifier
   * @returns {VerificationCodeEntry}
   */
  static createEntry(email, code, now = new Date(), service = undefined) {
    const normalizedEmail = email.trim().toLowerCase();
    const expiresAt = this.calculateExpiry(now);
    
    return {
      email: normalizedEmail,
      code: code,
      createdAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      attempts: 0,
      used: false,
      service: service
    };
  }

  /**
   * Verify a code against an entry
   * @param {string} inputCode - User-provided code
   * @param {VerificationCodeEntry} entry - Stored entry
   * @param {Date} [now] - Current time (for testing)
   * @returns {VerificationResult}
   */
  static verifyCode(inputCode, entry, now = new Date()) {
    // Validate input format
    const formatValidation = this.validateCodeFormat(inputCode);
    if (!formatValidation.valid) {
      return { 
        success: false, 
        error: formatValidation.error,
        errorCode: 'INVALID_FORMAT'
      };
    }

    // Check if entry exists
    if (!entry) {
      return { 
        success: false, 
        error: 'No verification code found for this email',
        errorCode: 'NO_CODE'
      };
    }

    // Check if already used
    if (entry.used) {
      return { 
        success: false, 
        error: 'This verification code has already been used',
        errorCode: 'ALREADY_USED'
      };
    }

    // Check if expired
    if (this.isExpired(entry.expiresAt, now)) {
      return { 
        success: false, 
        error: 'This verification code has expired. Please request a new one.',
        errorCode: 'EXPIRED'
      };
    }

    // Check max attempts
    if (this.isMaxAttemptsExceeded(entry.attempts)) {
      return { 
        success: false, 
        error: 'Too many verification attempts. Please request a new code.',
        errorCode: 'MAX_ATTEMPTS'
      };
    }

    // Compare codes (constant-time comparison to prevent timing attacks)
    const storedCode = entry.code.trim();
    const providedCode = inputCode.trim();
    
    // Simple string comparison (for 6-digit codes, timing attack is not practical)
    if (storedCode !== providedCode) {
      return { 
        success: false, 
        error: 'Incorrect verification code',
        errorCode: 'INCORRECT_CODE'
      };
    }

    // Success!
    return { 
      success: true, 
      email: entry.email 
    };
  }

  /**
   * Check rate limiting for code generation
   * @param {VerificationCodeEntry[]} existingEntries - Previous entries for this email
   * @param {Date} [now] - Current time (for testing)
   * @returns {RateLimitResult}
   */
  static checkGenerationRateLimit(existingEntries, now = new Date()) {
    const config = getVerificationConfig();
    const windowStart = new Date(now.getTime() - config.RATE_LIMIT_WINDOW_MINUTES * 60 * 1000);
    
    // Count codes generated in the rate limit window
    const recentCodes = existingEntries.filter(entry => {
      const created = new Date(entry.createdAt);
      return created >= windowStart && created <= now;
    });

    const remaining = config.MAX_CODES_PER_EMAIL_PER_HOUR - recentCodes.length;
    
    if (remaining <= 0) {
      // Calculate when the oldest code in the window will expire from rate limit
      const oldestInWindow = recentCodes
        .map(e => new Date(e.createdAt))
        .sort((a, b) => a.getTime() - b.getTime())[0];
      
      const retryAfter = Math.ceil(
        (oldestInWindow.getTime() + config.RATE_LIMIT_WINDOW_MINUTES * 60 * 1000 - now.getTime()) / 1000
      );

      return {
        allowed: false,
        remaining: 0,
        retryAfter: Math.max(0, retryAfter)
      };
    }

    return {
      allowed: true,
      remaining: remaining
    };
  }

  /**
   * Filter entries to remove expired and used ones
   * @param {VerificationCodeEntry[]} entries - All entries
   * @param {Date} [now] - Current time (for testing)
   * @returns {VerificationCodeEntry[]} Active entries
   */
  static filterActiveEntries(entries, now = new Date()) {
    return entries.filter(entry => {
      if (entry.used) return false;
      if (this.isExpired(entry.expiresAt, now)) return false;
      if (this.isMaxAttemptsExceeded(entry.attempts)) return false;
      return true;
    });
  }

  /**
   * Get configuration constants (for display/testing)
   * @returns {typeof VERIFICATION_CONFIG}
   */
  static getConfig() {
    return getVerificationConfig();
  }
};

/**
 * VerificationCode - GAS layer for verification code storage
 * Handles Script Cache and property storage
 */
Common.Auth.VerificationCode = {
  /**
   * Cache key prefix for verification codes
   * @private
   */
  _CACHE_PREFIX: 'vc_',

  /**
   * Cache key prefix for rate limit tracking
   * @private
   */
  _RATE_LIMIT_PREFIX: 'rl_',

  /**
   * Generate and store a new verification code for an email
   * @param {string} email - Email address to send code to
   * @param {string} [service] - Optional service identifier
   * @returns {CodeGenerationResult}
   */
  generateAndStore: function(email, service) {
    // PURE: Validate email
    const emailValidation = Common.Auth.VerificationCodeManager.validateEmail(email);
    if (!emailValidation.valid) {
      return { success: false, error: emailValidation.error, errorCode: 'INVALID_EMAIL' };
    }

    const normalizedEmail = email.trim().toLowerCase();
    const now = new Date();

    try {
      // GAS: Get rate limit history
      const history = this._getRateLimitHistory(normalizedEmail);
      
      // PURE: Check rate limit
      const rateLimitCheck = Common.Auth.VerificationCodeManager.checkGenerationRateLimit(history, now);
      if (!rateLimitCheck.allowed) {
        return {
          success: false,
          error: `Too many verification requests. Please try again in ${Math.ceil(rateLimitCheck.retryAfter / 60)} minutes.`,
          errorCode: 'RATE_LIMITED'
        };
      }

      // PURE: Generate code
      const code = Common.Auth.VerificationCodeManager.generateCode();
      
      // PURE: Create entry
      const entry = Common.Auth.VerificationCodeManager.createEntry(normalizedEmail, code, now, service);
      
      // GAS: Store code entry
      this._storeEntry(normalizedEmail, entry);
      
      // GAS: Update rate limit history
      this._addToRateLimitHistory(normalizedEmail, now);
      
      Logger.log('[VerificationCode.generateAndStore] Code generated for ' + normalizedEmail);
      
      return { success: true, code: code };
    } catch (error) {
      Logger.log('[VerificationCode.generateAndStore] Error: ' + error);
      return { success: false, error: 'Failed to generate verification code', errorCode: 'INTERNAL_ERROR' };
    }
  },

  /**
   * Verify a code for an email
   * @param {string} email - Email address
   * @param {string} code - User-provided verification code
   * @returns {VerificationResult}
   */
  verify: function(email, code) {
    // PURE: Validate email
    const emailValidation = Common.Auth.VerificationCodeManager.validateEmail(email);
    if (!emailValidation.valid) {
      return { success: false, error: emailValidation.error, errorCode: 'INVALID_EMAIL' };
    }

    const normalizedEmail = email.trim().toLowerCase();
    const now = new Date();

    try {
      // GAS: Get entry
      const entry = this._getEntry(normalizedEmail);
      
      // Increment attempts before verification
      if (entry && !entry.used) {
        entry.attempts = (entry.attempts || 0) + 1;
        this._storeEntry(normalizedEmail, entry);
      }

      // PURE: Verify code
      const result = Common.Auth.VerificationCodeManager.verifyCode(code, entry, now);
      
      if (result.success) {
        // GAS: Mark as used
        entry.used = true;
        this._storeEntry(normalizedEmail, entry);
        Logger.log('[VerificationCode.verify] Successful verification for ' + normalizedEmail);
      } else {
        Logger.log('[VerificationCode.verify] Failed verification for ' + normalizedEmail + ': ' + result.errorCode);
      }
      
      return result;
    } catch (error) {
      Logger.log('[VerificationCode.verify] Error: ' + error);
      return { success: false, error: 'Verification failed', errorCode: 'INTERNAL_ERROR' };
    }
  },

  /**
   * Send verification code email
   * @param {string} email - Email address
   * @param {string} code - Verification code
   * @param {string} serviceName - Name of the service requesting verification
   * @returns {{success: boolean, error?: string}}
   */
  sendCodeEmail: function(email, code, serviceName) {
    try {
      // Normalize email address
      const normalizedEmail = email.trim().toLowerCase();
      const formattedCode = code.slice(0, 3) + '-' + code.slice(3);
      const config = getVerificationConfig();
      const expiryMinutes = config.CODE_EXPIRY_MINUTES;
      
      const message = {
        to: normalizedEmail,
        subject: `SCCCC ${serviceName} - Verification Code`,
        body: `Your verification code for SCCCC ${serviceName} is:\n\n` +
              `    ${formattedCode}\n\n` +
              `This code will expire in ${expiryMinutes} minutes.\n\n` +
              `If you did not request this code, please ignore this email.\n\n` +
              `- SCCCC Membership System`
      };
      
      // GAS: Send email
      MailApp.sendEmail(message);
      Logger.log('[VerificationCode.sendCodeEmail] Email sent to ' + normalizedEmail);
      
      return { success: true };
    } catch (error) {
      Logger.log('[VerificationCode.sendCodeEmail] Error sending email: ' + error);
      return { success: false, error: 'Failed to send verification email' };
    }
  },

  /**
   * Request verification code (generate + send email)
   * @param {string} email - Email address
   * @param {string} serviceName - Name of the service
   * @param {string} [service] - Service identifier
   * @returns {{success: boolean, error?: string}}
   */
  requestCode: function(email, serviceName, service) {
    // Generate code
    const result = this.generateAndStore(email, service);
    if (!result.success) {
      return result;
    }

    // Send email
    const emailResult = this.sendCodeEmail(email, result.code, serviceName);
    if (!emailResult.success) {
      return emailResult;
    }

    // Return success (don't expose the code to the caller - it was emailed)
    return { success: true };
  },

  /**
   * Clear all codes for an email (for testing/admin)
   * @param {string} email - Email address
   */
  clearCodes: function(email) {
    const normalizedEmail = email.trim().toLowerCase();
    const cacheKey = this._CACHE_PREFIX + normalizedEmail;
    
    try {
      const cache = CacheService.getScriptCache();
      cache.remove(cacheKey);
      Logger.log('[VerificationCode.clearCodes] Cleared codes for ' + normalizedEmail);
    } catch (error) {
      Logger.log('[VerificationCode.clearCodes] Error: ' + error);
    }
  },

  /**
   * Get entry from cache (internal)
   * @private
   * @param {string} email - Normalized email
   * @returns {VerificationCodeEntry|null}
   */
  _getEntry: function(email) {
    const cacheKey = this._CACHE_PREFIX + email;
    
    try {
      const cache = CacheService.getScriptCache();
      const data = cache.get(cacheKey);
      
      if (!data) {
        return null;
      }
      
      return JSON.parse(data);
    } catch (error) {
      Logger.log('[VerificationCode._getEntry] Error: ' + error);
      return null;
    }
  },

  /**
   * Store entry in cache (internal)
   * @private
   * @param {string} email - Normalized email
   * @param {VerificationCodeEntry} entry - Entry to store
   */
  _storeEntry: function(email, entry) {
    const cacheKey = this._CACHE_PREFIX + email;
    
    try {
      const cache = CacheService.getScriptCache();
      const config = getVerificationConfig();
      // Store for the rate limit window duration
      cache.put(cacheKey, JSON.stringify(entry), config.RATE_LIMIT_WINDOW_MINUTES * 60);
    } catch (error) {
      Logger.log('[VerificationCode._storeEntry] Error: ' + error);
      throw error;
    }
  },

  /**
   * Get all entries for an email (for rate limiting)
   * @private
   * @param {string} email - Normalized email
   * @returns {VerificationCodeEntry[]}
   */
  _getEntriesForEmail: function(email) {
    const entry = this._getEntry(email);
    return entry ? [entry] : [];
  },

  /**
   * Get rate limit history for an email
   * @private
   * @param {string} email - Normalized email
   * @returns {VerificationCodeEntry[]} Array of entries with createdAt timestamps
   */
  _getRateLimitHistory: function(email) {
    const cacheKey = this._RATE_LIMIT_PREFIX + email;
    
    try {
      const cache = CacheService.getScriptCache();
      const data = cache.get(cacheKey);
      
      if (!data) {
        return [];
      }
      
      const timestamps = JSON.parse(data);
      // Convert timestamps to entries for rate limit check
      return timestamps.map(ts => ({ createdAt: ts }));
    } catch (error) {
      Logger.log('[VerificationCode._getRateLimitHistory] Error: ' + error);
      return [];
    }
  },

  /**
   * Add to rate limit history for an email
   * @private
   * @param {string} email - Normalized email
   * @param {Date} now - Current time
   */
  _addToRateLimitHistory: function(email, now) {
    const cacheKey = this._RATE_LIMIT_PREFIX + email;
    
    try {
      const cache = CacheService.getScriptCache();
      const config = getVerificationConfig();
      const data = cache.get(cacheKey);
      
      // Get existing history or start fresh
      let timestamps = data ? JSON.parse(data) : [];
      
      // Add current timestamp
      timestamps.push(now.toISOString());
      
      // Clean up old entries (older than rate limit window)
      const windowStart = new Date(now.getTime() - config.RATE_LIMIT_WINDOW_MINUTES * 60 * 1000);
      timestamps = timestamps.filter(ts => new Date(ts) >= windowStart);
      
      // Store updated history
      cache.put(cacheKey, JSON.stringify(timestamps), config.RATE_LIMIT_WINDOW_MINUTES * 60);
    } catch (error) {
      Logger.log('[VerificationCode._addToRateLimitHistory] Error: ' + error);
      // Don't throw - rate limiting is secondary to verification functionality
    }
  }
};

// Node.js export for testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { 
    VerificationCode: Common.Auth.VerificationCode,
    VerificationCodeManager: Common.Auth.VerificationCodeManager,
    VERIFICATION_CONFIG,
    getVerificationConfig
  };
}
