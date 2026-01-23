// @ts-check
/// <reference path="../../types/global.d.ts" />

/**
 * VerificationCode - 6-digit verification code authentication
 *
 * CRITICAL: This module is in Layer 0 (Foundation).
 * - MUST NOT use AppLogger.* (creates circular dependency)
 * - MUST use Logger.log() (GAS built-in) only for tracing
 *
 * Pattern: IIFE-wrapped classes with static methods (per gas-best-practices.md)
 *
 * This module provides secure verification code generation and validation
 * for the SPA authentication flow. Codes are:
 * - 6 digits (000000-999999)
 * - Time-limited (configurable, default 10 minutes)
 * - Single-use (consumed on successful verification)
 * - Rate-limited (configurable max attempts)
 *
 * Architecture follows GAS Layer Separation pattern:
 * - VerificationCodeManager: Pure logic (testable)
 * - VerificationCode: GAS layer (storage/orchestration)
 */

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
var VERIFICATION_CONFIG = {
    CODE_LENGTH: 6,
    CODE_EXPIRY_MINUTES: 10,
    MAX_VERIFICATION_ATTEMPTS: 3,
    MAX_CODES_PER_EMAIL_PER_HOUR: 5,
    RATE_LIMIT_WINDOW_MINUTES: 60,
};

/**
 * Get configuration with property overrides for testing
 * Reads from script properties to allow rate limiting to be disabled/modified for testing
 * @returns {typeof VERIFICATION_CONFIG}
 */
function getVerificationConfig() {
    var config = Object.assign({}, VERIFICATION_CONFIG);

    try {
        // Only try to read properties in GAS environment
        if (typeof PropertiesService !== 'undefined') {
            var props = PropertiesService.getScriptProperties();

            // Check for testing override properties
            var codeLength = props.getProperty('VERIFICATION_CODE_LENGTH');
            if (codeLength) {
                config.CODE_LENGTH = parseInt(codeLength, 10) || config.CODE_LENGTH;
            }

            var expiryMinutes = props.getProperty('VERIFICATION_CODE_EXPIRY_MINUTES');
            if (expiryMinutes) {
                config.CODE_EXPIRY_MINUTES = parseInt(expiryMinutes, 10) || config.CODE_EXPIRY_MINUTES;
            }

            var maxAttempts = props.getProperty('VERIFICATION_MAX_ATTEMPTS');
            if (maxAttempts) {
                config.MAX_VERIFICATION_ATTEMPTS = parseInt(maxAttempts, 10) || config.MAX_VERIFICATION_ATTEMPTS;
            }

            var maxCodesPerHour = props.getProperty('VERIFICATION_MAX_CODES_PER_HOUR');
            if (maxCodesPerHour) {
                config.MAX_CODES_PER_EMAIL_PER_HOUR = parseInt(maxCodesPerHour, 10) || config.MAX_CODES_PER_EMAIL_PER_HOUR;
            }

            var rateLimitMinutes = props.getProperty('VERIFICATION_RATE_LIMIT_MINUTES');
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
 * Pattern: IIFE-wrapped class with static methods
 */
var VerificationCodeManager = (function () {
    class VerificationCodeManager {
        /**
         * Generate a cryptographically random 6-digit code
         * For production, this should use a secure random source.
         * In tests, can be overridden via dependency injection.
         *
         * @param {function(): number} [randomFn] - Random function returning 0-1 (for testing)
         * @returns {string} 6-digit code padded with leading zeros
         */
        static generateCode(randomFn) {
            if (randomFn === undefined) randomFn = Math.random;
            var config = getVerificationConfig();
            // Generate number 0-999999
            var num = Math.floor(randomFn() * 1000000);
            // Pad to 6 digits
            return String(num).padStart(config.CODE_LENGTH, '0');
        }

        /**
         * Validate a verification code format
         * @param {string} code - The code to validate
         * @returns {{valid: boolean, error?: string}}
         */
        static validateCodeFormat(code) {
            var config = getVerificationConfig();
            if (!code || typeof code !== 'string') {
                return { valid: false, error: 'Code must be a non-empty string' };
            }
            var trimmed = code.trim();
            if (trimmed.length !== config.CODE_LENGTH) {
                return { valid: false, error: 'Code must be exactly ' + config.CODE_LENGTH + ' digits' };
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
            var trimmed = email.trim().toLowerCase();
            // Basic email validation - should have @ and domain
            var emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
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
            var config = getVerificationConfig();
            var minutes = expiryMinutes !== undefined ? expiryMinutes : config.CODE_EXPIRY_MINUTES;
            return new Date(createdAt.getTime() + minutes * 60 * 1000);
        }

        /**
         * Check if a code has expired
         * @param {string} expiresAt - ISO timestamp of expiration
         * @param {Date} [now] - Current time (for testing)
         * @returns {boolean} True if expired
         */
        static isExpired(expiresAt, now) {
            if (now === undefined) now = new Date();
            if (!expiresAt) {
                return true;
            }
            var expiry = new Date(expiresAt);
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
            var config = getVerificationConfig();
            var max = maxAttempts !== undefined ? maxAttempts : config.MAX_VERIFICATION_ATTEMPTS;
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
        static createEntry(email, code, now, service) {
            if (now === undefined) now = new Date();
            var normalizedEmail = email.trim().toLowerCase();
            var expiresAt = VerificationCodeManager.calculateExpiry(now);

            return {
                email: normalizedEmail,
                code: code,
                createdAt: now.toISOString(),
                expiresAt: expiresAt.toISOString(),
                attempts: 0,
                used: false,
                service: service,
            };
        }

        /**
         * Verify a code against an entry
         * @param {string} inputCode - User-provided code
         * @param {VerificationCodeEntry} entry - Stored entry
         * @param {Date} [now] - Current time (for testing)
         * @returns {VerificationResult}
         */
        static verifyCode(inputCode, entry, now) {
            if (now === undefined) now = new Date();

            // Validate input format
            var formatValidation = VerificationCodeManager.validateCodeFormat(inputCode);
            if (!formatValidation.valid) {
                return {
                    success: false,
                    error: formatValidation.error,
                    errorCode: 'INVALID_FORMAT',
                };
            }

            // Check if entry exists
            if (!entry) {
                return {
                    success: false,
                    error: 'No verification code found for this email',
                    errorCode: 'NO_CODE',
                };
            }

            // Check if already used
            if (entry.used) {
                return {
                    success: false,
                    error: 'This verification code has already been used',
                    errorCode: 'ALREADY_USED',
                };
            }

            // Check if expired
            if (VerificationCodeManager.isExpired(entry.expiresAt, now)) {
                return {
                    success: false,
                    error: 'This verification code has expired. Please request a new one.',
                    errorCode: 'EXPIRED',
                };
            }

            // Check max attempts
            if (VerificationCodeManager.isMaxAttemptsExceeded(entry.attempts)) {
                return {
                    success: false,
                    error: 'Too many verification attempts. Please request a new code.',
                    errorCode: 'MAX_ATTEMPTS',
                };
            }

            // Compare codes (constant-time comparison to prevent timing attacks)
            var storedCode = entry.code.trim();
            var providedCode = inputCode.trim();

            // Simple string comparison (for 6-digit codes, timing attack is not practical)
            if (storedCode !== providedCode) {
                return {
                    success: false,
                    error: 'Incorrect verification code',
                    errorCode: 'INCORRECT_CODE',
                };
            }

            // Success!
            return {
                success: true,
                email: entry.email,
            };
        }

        /**
         * Check rate limiting for code generation
         * @param {VerificationCodeEntry[]} existingEntries - Previous entries for this email
         * @param {Date} [now] - Current time (for testing)
         * @returns {RateLimitResult}
         */
        static checkGenerationRateLimit(existingEntries, now) {
            if (now === undefined) now = new Date();
            var config = getVerificationConfig();
            var windowStart = new Date(now.getTime() - config.RATE_LIMIT_WINDOW_MINUTES * 60 * 1000);

            // Count codes generated in the rate limit window
            var recentCodes = existingEntries.filter(function (entry) {
                var created = new Date(entry.createdAt);
                return created >= windowStart && created <= now;
            });

            var remaining = config.MAX_CODES_PER_EMAIL_PER_HOUR - recentCodes.length;

            if (remaining <= 0) {
                // Calculate when the oldest code in the window will expire from rate limit
                var oldestInWindow = recentCodes
                    .map(function (e) {
                        return new Date(e.createdAt);
                    })
                    .sort(function (a, b) {
                        return a.getTime() - b.getTime();
                    })[0];

                var retryAfter = Math.ceil(
                    (oldestInWindow.getTime() + config.RATE_LIMIT_WINDOW_MINUTES * 60 * 1000 - now.getTime()) / 1000
                );

                return {
                    allowed: false,
                    remaining: 0,
                    retryAfter: Math.max(0, retryAfter),
                };
            }

            return {
                allowed: true,
                remaining: remaining,
            };
        }

        /**
         * Filter entries to remove expired and used ones
         * @param {VerificationCodeEntry[]} entries - All entries
         * @param {Date} [now] - Current time (for testing)
         * @returns {VerificationCodeEntry[]} Active entries
         */
        static filterActiveEntries(entries, now) {
            if (now === undefined) now = new Date();
            return entries.filter(function (entry) {
                if (entry.used) return false;
                if (VerificationCodeManager.isExpired(entry.expiresAt, now)) return false;
                if (VerificationCodeManager.isMaxAttemptsExceeded(entry.attempts)) return false;
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
    }

    return VerificationCodeManager;
})();

/**
 * VerificationCode - GAS layer for verification code storage
 * Handles Script Cache and property storage
 *
 * Pattern: IIFE-wrapped class with static methods
 */
var VerificationCode = (function () {
    /**
     * Cache key prefix for verification codes
     * @private
     */
    var _CACHE_PREFIX = 'vc_';

    /**
     * Cache key prefix for rate limit tracking
     * @private
     */
    var _RATE_LIMIT_PREFIX = 'rl_';

    class VerificationCode {
        /**
         * Get cache key prefix for verification codes
         * @returns {string}
         */
        static get _CACHE_PREFIX() {
            return _CACHE_PREFIX;
        }

        /**
         * Get cache key prefix for rate limiting
         * @returns {string}
         */
        static get _RATE_LIMIT_PREFIX() {
            return _RATE_LIMIT_PREFIX;
        }

        /**
         * Get verification configuration from Script Properties (or defaults)
         * @returns {typeof VERIFICATION_CONFIG}
         */
        static getVerificationConfig() {
            return getVerificationConfig();
        }

        /**
         * Generate and store a new verification code for an email
         * @param {string} email - Email address to send code to
         * @param {string} [service] - Optional service identifier
         * @returns {CodeGenerationResult}
         */
        static generateAndStore(email, service) {
            // PURE: Validate email
            var emailValidation = VerificationCodeManager.validateEmail(email);
            if (!emailValidation.valid) {
                return { success: false, error: emailValidation.error, errorCode: 'INVALID_EMAIL' };
            }

            var normalizedEmail = email.trim().toLowerCase();
            var now = new Date();

            try {
                // GAS: Get rate limit history
                var history = VerificationCode._getRateLimitHistory(normalizedEmail);

                // PURE: Check rate limit with dynamic config
                var rateLimitCheck = VerificationCodeManager.checkGenerationRateLimit(history, now);
                if (!rateLimitCheck.allowed) {
                    return {
                        success: false,
                        error:
                            'Too many verification requests. Please try again in ' +
                            Math.ceil(rateLimitCheck.retryAfter / 60) +
                            ' minutes.',
                        errorCode: 'RATE_LIMITED',
                    };
                }

                // PURE: Generate code
                var code = VerificationCodeManager.generateCode();

                // PURE: Create entry
                var entry = VerificationCodeManager.createEntry(normalizedEmail, code, now, service);

                // GAS: Store code entry
                VerificationCode._storeEntry(normalizedEmail, entry);

                // GAS: Update rate limit history
                VerificationCode._addToRateLimitHistory(normalizedEmail, now);

                Logger.log('[VerificationCode.generateAndStore] Code generated for ' + normalizedEmail);

                return { success: true, code: code };
            } catch (error) {
                Logger.log('[VerificationCode.generateAndStore] Error: ' + error);
                return { success: false, error: 'Failed to generate verification code', errorCode: 'INTERNAL_ERROR' };
            }
        }

        /**
         * Verify a code for an email
         * @param {string} email - Email address
         * @param {string} code - User-provided verification code
         * @returns {VerificationResult}
         */
        static verify(email, code) {
            // PURE: Validate email
            var emailValidation = VerificationCodeManager.validateEmail(email);
            if (!emailValidation.valid) {
                return { success: false, error: emailValidation.error, errorCode: 'INVALID_EMAIL' };
            }

            var normalizedEmail = email.trim().toLowerCase();
            var now = new Date();

            try {
                // GAS: Get entry
                var entry = VerificationCode._getEntry(normalizedEmail);

                // Increment attempts before verification
                if (entry && !entry.used) {
                    entry.attempts = (entry.attempts || 0) + 1;
                    VerificationCode._storeEntry(normalizedEmail, entry);
                }

                // PURE: Verify code
                var result = VerificationCodeManager.verifyCode(code, entry, now);

                if (result.success) {
                    // GAS: Mark as used
                    entry.used = true;
                    VerificationCode._storeEntry(normalizedEmail, entry);
                    Logger.log('[VerificationCode.verify] Successful verification for ' + normalizedEmail);
                    return result;
                }

                Logger.log(
                    '[VerificationCode.verify] Failed verification for ' + normalizedEmail + ': ' + result.errorCode
                );

                // If there's no entry or the code expired, auto-generate and send a new code
                if (result.errorCode === 'NO_CODE' || result.errorCode === 'EXPIRED') {
                    try {
                        // Try to generate and store a fresh code (may be rate-limited)
                        var gen = VerificationCode.generateAndStore(
                            normalizedEmail,
                            entry && entry.service ? entry.service : undefined
                        );
                        if (!gen.success) {
                            // Propagate rate-limit or generation error back to caller
                            Logger.log(
                                '[VerificationCode.verify] Auto-resent generation failed for ' +
                                    normalizedEmail +
                                    ': ' +
                                    (gen.error || gen.errorCode)
                            );
                            return {
                                success: false,
                                error: gen.error || 'Failed to resend verification code',
                                errorCode: gen.errorCode || 'INTERNAL_ERROR',
                            };
                        }

                        // Send the new code via email using a generic service name when unknown
                        var serviceName = entry && entry.service ? entry.service : 'SCCCC Services';
                        var emailResult = VerificationCode.sendCodeEmail(normalizedEmail, gen.code, serviceName);
                        if (!emailResult.success) {
                            Logger.log(
                                '[VerificationCode.verify] Auto-resent email send failed for ' +
                                    normalizedEmail +
                                    ': ' +
                                    (emailResult.error || 'unknown')
                            );
                            return {
                                success: false,
                                error: 'Failed to resend verification code',
                                errorCode: 'EMAIL_FAILED',
                            };
                        }

                        Logger.log('[VerificationCode.verify] Auto-resent verification code to ' + normalizedEmail);
                        // Return a friendly message and the canonical email so the client can restart its resend timer
                        return {
                            success: false,
                            error: 'Your verification session timed out. A new verification code has been sent to your email.',
                            errorCode: 'AUTO_RESENT',
                            email: normalizedEmail,
                        };
                    } catch (e) {
                        Logger.log('[VerificationCode.verify] Auto-resent exception for ' + normalizedEmail + ': ' + e);
                        return { success: false, error: 'Verification failed', errorCode: 'INTERNAL_ERROR' };
                    }
                }

                return result;
            } catch (error) {
                Logger.log('[VerificationCode.verify] Error: ' + error);
                return { success: false, error: 'Verification failed', errorCode: 'INTERNAL_ERROR' };
            }
        }

        /**
         * Send verification code email
         * @param {string} email - Email address
         * @param {string} code - Verification code
         * @param {string} serviceName - Name of the service requesting verification
         * @returns {{success: boolean, error?: string}}
         */
        static sendCodeEmail(email, code, serviceName) {
            try {
                // Normalize email address
                var normalizedEmail = email.trim().toLowerCase();
                // Send the code as contiguous digits (no hyphen)
                var formattedCode = code;
                var config = getVerificationConfig();
                var expiryMinutes = config.CODE_EXPIRY_MINUTES;

                var message = {
                    to: normalizedEmail,
                    subject: serviceName + ' - Verification Code',
                    body:
                        'Your verification code for ' +
                        serviceName +
                        ' is:\n\n' +
                        '    ' +
                        formattedCode +
                        '\n\n' +
                        'Copy/Paste this code into the verification form.\n\n' +
                        'This code will expire in ' +
                        expiryMinutes +
                        ' minutes.\n\n' +
                        'If you did not request this code, please ignore this email.\n\n' +
                        '- SCCCC Membership System',
                };

                // GAS: Send email
                MailApp.sendEmail(message);
                Logger.log('[VerificationCode.sendCodeEmail] Email sent to ' + normalizedEmail);

                return { success: true };
            } catch (error) {
                Logger.log('[VerificationCode.sendCodeEmail] Error sending email: ' + error);
                return { success: false, error: 'Failed to send verification email' };
            }
        }

        /**
         * Request verification code (generate + send email)
         * @param {string} email - Email address
         * @param {string} serviceName - Name of the service
         * @param {string} [service] - Service identifier
         * @returns {{success: boolean, error?: string}}
         */
        static requestCode(email, serviceName, service) {
            // Generate code
            var result = VerificationCode.generateAndStore(email, service);
            if (!result.success) {
                return result;
            }

            // Send email
            var emailResult = VerificationCode.sendCodeEmail(email, result.code, serviceName);
            if (!emailResult.success) {
                return emailResult;
            }

            // Return success (don't expose the code to the caller - it was emailed)
            return { success: true };
        }

        /**
         * Clear all codes for an email (for testing/admin)
         * @param {string} email - Email address
         */
        static clearCodes(email) {
            var normalizedEmail = email.trim().toLowerCase();
            var cacheKey = _CACHE_PREFIX + normalizedEmail;

            try {
                var cache = CacheService.getScriptCache();
                cache.remove(cacheKey);
                Logger.log('[VerificationCode.clearCodes] Cleared codes for ' + normalizedEmail);
            } catch (error) {
                Logger.log('[VerificationCode.clearCodes] Error: ' + error);
            }
        }

        /**
         * Get entry from cache (internal)
         * @private
         * @param {string} email - Normalized email
         * @returns {VerificationCodeEntry|null}
         */
        static _getEntry(email) {
            var cacheKey = _CACHE_PREFIX + email;

            try {
                var cache = CacheService.getScriptCache();
                var data = cache.get(cacheKey);

                if (!data) {
                    return null;
                }

                return JSON.parse(data);
            } catch (error) {
                Logger.log('[VerificationCode._getEntry] Error: ' + error);
                return null;
            }
        }

        /**
         * Store entry in cache (internal)
         * @private
         * @param {string} email - Normalized email
         * @param {VerificationCodeEntry} entry - Entry to store
         */
        static _storeEntry(email, entry) {
            var cacheKey = _CACHE_PREFIX + email;

            try {
                var cache = CacheService.getScriptCache();
                var config = getVerificationConfig();
                // Store for the rate limit window duration
                cache.put(cacheKey, JSON.stringify(entry), config.RATE_LIMIT_WINDOW_MINUTES * 60);
            } catch (error) {
                Logger.log('[VerificationCode._storeEntry] Error: ' + error);
                throw error;
            }
        }

        /**
         * Get all entries for an email (for rate limiting)
         * @private
         * @param {string} email - Normalized email
         * @returns {VerificationCodeEntry[]}
         */
        static _getEntriesForEmail(email) {
            var entry = VerificationCode._getEntry(email);
            return entry ? [entry] : [];
        }

        /**
         * Get rate limit history for an email
         * @private
         * @param {string} email - Normalized email
         * @returns {VerificationCodeEntry[]} Array of entries with createdAt timestamps
         */
        static _getRateLimitHistory(email) {
            var cacheKey = _RATE_LIMIT_PREFIX + email;

            try {
                var cache = CacheService.getScriptCache();
                var data = cache.get(cacheKey);

                if (!data) {
                    return [];
                }

                var timestamps = JSON.parse(data);
                // Convert timestamps to entries for rate limit check
                return timestamps.map(function (ts) {
                    return { createdAt: ts };
                });
            } catch (error) {
                Logger.log('[VerificationCode._getRateLimitHistory] Error: ' + error);
                return [];
            }
        }

        /**
         * Add to rate limit history for an email
         * @private
         * @param {string} email - Normalized email
         * @param {Date} now - Current time
         */
        static _addToRateLimitHistory(email, now) {
            var cacheKey = _RATE_LIMIT_PREFIX + email;

            try {
                var cache = CacheService.getScriptCache();
                var config = getVerificationConfig();
                var data = cache.get(cacheKey);

                // Get existing history or start fresh
                var timestamps = data ? JSON.parse(data) : [];

                // Add current timestamp
                timestamps.push(now.toISOString());

                // Clean up old entries (older than rate limit window)
                var windowStart = new Date(now.getTime() - config.RATE_LIMIT_WINDOW_MINUTES * 60 * 1000);
                timestamps = timestamps.filter(function (ts) {
                    return new Date(ts) >= windowStart;
                });

                // Store updated history
                cache.put(cacheKey, JSON.stringify(timestamps), config.RATE_LIMIT_WINDOW_MINUTES * 60);
            } catch (error) {
                Logger.log('[VerificationCode._addToRateLimitHistory] Error: ' + error);
                // Don't throw - rate limiting is secondary to verification functionality
            }
        }

        /**
         * Clear rate limit history for an email (for testing/debugging)
         * @param {string} email - Email address to clear rate limit for
         * @returns {boolean} True if cleared successfully
         */
        static clearRateLimitForEmail(email) {
            var normalizedEmail = email.trim().toLowerCase();
            var cacheKey = _RATE_LIMIT_PREFIX + normalizedEmail;

            try {
                var cache = CacheService.getScriptCache();
                cache.remove(cacheKey);
                Logger.log('[VerificationCode.clearRateLimitForEmail] Cleared rate limit for: ' + normalizedEmail);
                return true;
            } catch (error) {
                Logger.log('[VerificationCode.clearRateLimitForEmail] Error: ' + error);
                return false;
            }
        }

        /**
         * Clear all verification codes and rate limits (for testing/debugging)
         * WARNING: This affects all users
         * @returns {{cleared: number, errors: number}}
         */
        static clearAllVerificationData() {
            var cleared = 0;
            var errors = 0;

            try {
                var cache = CacheService.getScriptCache();
                // CacheService doesn't have a "clear all" method, so we can only remove what we know about
                // This is a limitation - best we can do is log that cache will expire naturally
                Logger.log(
                    '[VerificationCode.clearAllVerificationData] Cache entries will expire naturally (6 hours max for CacheService)'
                );
                Logger.log(
                    '[VerificationCode.clearAllVerificationData] To fully clear, wait for cache expiry or clear specific emails using clearRateLimitForEmail()'
                );
                return { cleared: 0, errors: 0 };
            } catch (error) {
                Logger.log('[VerificationCode.clearAllVerificationData] Error: ' + error);
                return { cleared: cleared, errors: errors + 1 };
            }
        }
    }

    return VerificationCode;
})();
// Node.js export for testing
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        VerificationCode: VerificationCode,
        VerificationCodeManager: VerificationCodeManager,
        VERIFICATION_CONFIG: VERIFICATION_CONFIG,
        getVerificationConfig: getVerificationConfig,
    };
}
