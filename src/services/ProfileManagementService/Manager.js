// @ts-check
/// <reference path="../../types/global.d.ts" />

/**
 * ProfileManagementService.Manager - Pure business logic for profile management
 * 
 * This module contains all business logic for managing user profiles.
 * It is fully testable with Jest as it has no GAS dependencies.
 * 
 * Architecture follows GAS Layer Separation pattern:
 * - Manager: Pure logic (testable)
 * - GAS layer (WebApp.js, Api.js): Orchestration and GAS API calls
 * 
 * @namespace ProfileManagementService.Manager
 */

// Namespace declaration pattern (works in both GAS and Jest)
if (typeof ProfileManagementService === 'undefined') ProfileManagementService = /** @type {any} */ ({});

/**
 * @typedef {Object} ValidationResult
 * @property {boolean} valid - Whether validation passed
 * @property {string} [error] - Error message if validation failed
 * @property {string} [errorCode] - Machine-readable error code
 */

/**
 * @typedef {Object} ForbiddenFieldCheckResult
 * @property {boolean} hasViolation - Whether a forbidden field was modified
 * @property {string} [field] - The forbidden field that was violated
 * @property {string} [violationType] - 'update' or 'add'
 */

/**
 * @typedef {Object} ProfileUpdateResult
 * @property {boolean} success - Whether the update succeeded
 * @property {string} message - Result message
 * @property {Object} [mergedProfile] - The merged profile (if successful)
 */

/**
 * @typedef {Object} ProfileField
 * @property {string} name - Field name
 * @property {boolean} required - Whether the field is required
 * @property {string} [pattern] - Regex pattern for validation
 * @property {string} [patternDescription] - Description of the pattern
 * @property {number} [maxLength] - Maximum length
 */

/**
 * Default forbidden fields that users cannot modify
 * @type {string[]}
 */
const DEFAULT_FORBIDDEN_FIELDS = [
  'Status',
  'Email',
  'Joined',
  'Expires',
  'Period',
  'Migrated',
  'Renewed On'
];

/**
 * Shared validation patterns
 * @type {Object.<string, {pattern: string, regex: RegExp, description: string}>}
 */
const VALIDATION_PATTERNS = {
  NAME: {
    pattern: "^[A-Za-z0-9\\s\\-'.]+$",
    regex: /^[A-Za-z0-9\s\-'.]+$/,
    description: 'can only contain letters, numbers, spaces, hyphens, apostrophes, or periods'
  },
  PHONE: {
    pattern: '^\\(\\d{3}\\) \\d{3}-\\d{4}$',
    regex: /^\(\d{3}\) \d{3}-\d{4}$/,
    description: 'must match (123) 123-1234 format'
  }
};

/**
 * Allowed profile fields with their validation rules
 * @type {Object.<string, ProfileField>}
 */
const PROFILE_FIELD_SCHEMA = {
  'First': {
    name: 'First',
    required: true,
    pattern: VALIDATION_PATTERNS.NAME.pattern,
    patternDescription: 'First Name must be non-empty and ' + VALIDATION_PATTERNS.NAME.description + '.',
    maxLength: 100
  },
  'Last': {
    name: 'Last',
    required: true,
    pattern: VALIDATION_PATTERNS.NAME.pattern,
    patternDescription: 'Last Name must be non-empty and ' + VALIDATION_PATTERNS.NAME.description + '.',
    maxLength: 100
  },
  'Phone': {
    name: 'Phone',
    required: true,
    pattern: VALIDATION_PATTERNS.PHONE.pattern,
    patternDescription: 'Phone ' + VALIDATION_PATTERNS.PHONE.description,
    maxLength: 14
  },
  'Directory Share Name': {
    name: 'Directory Share Name',
    required: false
  },
  'Directory Share Phone': {
    name: 'Directory Share Phone',
    required: false
  },
  'Directory Share Email': {
    name: 'Directory Share Email',
    required: false
  }
};

/**
 * ProfileManagementService.Manager - Pure logic class for profile operations
 * All business logic is here and is fully testable with Jest.
 * 
 * @class
 */
ProfileManagementService.Manager = class {
  /**
   * Get default forbidden fields
   * @returns {string[]}
   */
  static getForbiddenFields() {
    return [...DEFAULT_FORBIDDEN_FIELDS];
  }

  /**
   * Get profile field schema
   * @returns {Object.<string, ProfileField>}
   */
  static getProfileFieldSchema() {
    // Return a deep copy to prevent external modification
    /** @type {Object.<string, ProfileField>} */
    const copy = {};
    for (const [key, value] of Object.entries(PROFILE_FIELD_SCHEMA)) {
      copy[key] = { ...value };
    }
    return copy;
  }

  /**
   * Validate an email format
   * @param {string} email - The email to validate
   * @returns {ValidationResult}
   */
  static validateEmail(email) {
    if (!email || typeof email !== 'string') {
      return { valid: false, error: 'Email must be a non-empty string', errorCode: 'INVALID_EMAIL' };
    }
    const trimmed = email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmed)) {
      return { valid: false, error: 'Invalid email format', errorCode: 'INVALID_EMAIL_FORMAT' };
    }
    return { valid: true };
  }

  /**
   * Validate a name field (First or Last name)
   * @param {string} name - The name to validate
   * @param {string} fieldName - 'First' or 'Last' for error messages
   * @returns {ValidationResult}
   */
  static validateName(name, fieldName = 'Name') {
    if (!name || typeof name !== 'string') {
      return { 
        valid: false, 
        error: `${fieldName} must be a non-empty string`, 
        errorCode: 'INVALID_NAME' 
      };
    }
    
    const trimmed = name.trim();
    if (trimmed.length === 0) {
      return { 
        valid: false, 
        error: `${fieldName} cannot be empty`, 
        errorCode: 'EMPTY_NAME' 
      };
    }
    
    if (trimmed.length > 100) {
      return { 
        valid: false, 
        error: `${fieldName} must be 100 characters or less`, 
        errorCode: 'NAME_TOO_LONG' 
      };
    }
    
    if (!VALIDATION_PATTERNS.NAME.regex.test(trimmed)) {
      return { 
        valid: false, 
        error: `${fieldName} ${VALIDATION_PATTERNS.NAME.description}`, 
        errorCode: 'INVALID_NAME_CHARACTERS' 
      };
    }
    
    return { valid: true };
  }

  /**
   * Validate a phone number
   * @param {string} phone - The phone number to validate
   * @returns {ValidationResult}
   */
  static validatePhone(phone) {
    if (!phone || typeof phone !== 'string') {
      return { 
        valid: false, 
        error: 'Phone must be a non-empty string', 
        errorCode: 'INVALID_PHONE' 
      };
    }
    
    const trimmed = phone.trim();
    if (!VALIDATION_PATTERNS.PHONE.regex.test(trimmed)) {
      return { 
        valid: false, 
        error: 'Phone ' + VALIDATION_PATTERNS.PHONE.description, 
        errorCode: 'INVALID_PHONE_FORMAT' 
      };
    }
    
    return { valid: true };
  }

  /**
   * Check if a profile update contains forbidden field modifications
   * @param {ValidatedMember} originalProfile - The original profile
   * @param {ValidatedMember} updatedProfile - The updated profile
   * @param {string[]} [forbiddenFields] - List of forbidden fields
   * @returns {ForbiddenFieldCheckResult}
   */
  static checkForForbiddenUpdates(originalProfile, updatedProfile, forbiddenFields = DEFAULT_FORBIDDEN_FIELDS) {
    for (const field of forbiddenFields) {
      // Check if attempting to update a forbidden field
      if (Object.prototype.hasOwnProperty.call(updatedProfile, field) &&
          Object.prototype.hasOwnProperty.call(originalProfile, field) &&
          updatedProfile[field] !== originalProfile[field]) {
        return { 
          hasViolation: true, 
          field: field, 
          violationType: 'update' 
        };
      }
      
      // Check if attempting to add a forbidden field
      if (Object.prototype.hasOwnProperty.call(updatedProfile, field) &&
          !Object.prototype.hasOwnProperty.call(originalProfile, field)) {
        return { 
          hasViolation: true, 
          field: field, 
          violationType: 'add' 
        };
      }
    }
    
    return { hasViolation: false };
  }

  /**
   * Validate an entire profile update
   * @param {Record<string, any>} updatedProfile - The profile data to validate (can be partial ValidatedMember)
   * @returns {ValidationResult}
   */
  static validateProfileUpdate(updatedProfile) {
    if (!updatedProfile || typeof updatedProfile !== 'object') {
      return { 
        valid: false, 
        error: 'Profile must be an object', 
        errorCode: 'INVALID_PROFILE' 
      };
    }

    // Validate First Name if present
    if (Object.prototype.hasOwnProperty.call(updatedProfile, 'First')) {
      const firstValidation = this.validateName(updatedProfile.First, 'First Name');
      if (!firstValidation.valid) {
        return firstValidation;
      }
    }

    // Validate Last Name if present
    if (Object.prototype.hasOwnProperty.call(updatedProfile, 'Last')) {
      const lastValidation = this.validateName(updatedProfile.Last, 'Last Name');
      if (!lastValidation.valid) {
        return lastValidation;
      }
    }

    // Validate Phone if present
    if (Object.prototype.hasOwnProperty.call(updatedProfile, 'Phone')) {
      const phoneValidation = this.validatePhone(updatedProfile.Phone);
      if (!phoneValidation.valid) {
        return phoneValidation;
      }
    }

    // Validate directory sharing flags are booleans
    const booleanFields = ['Directory Share Name', 'Directory Share Phone', 'Directory Share Email'];
    for (const field of booleanFields) {
      if (Object.prototype.hasOwnProperty.call(updatedProfile, field)) {
        if (typeof updatedProfile[field] !== 'boolean') {
          return { 
            valid: false, 
            error: `${field} must be a boolean`, 
            errorCode: 'INVALID_BOOLEAN_FIELD' 
          };
        }
      }
    }

    return { valid: true };
  }

  /**
   * Merge original profile with updates
   * @param {ValidatedMember} originalProfile - The original profile
   * @param {Record<string, any>} updates - The updates to apply (field name to new value)
   * @returns {ValidatedMember} The merged profile
   */
  static mergeProfiles(originalProfile, updates) {
    return { ...originalProfile, ...updates };
  }

  /**
   * Process a profile update (full validation and merge)
   * @param {ValidatedMember} originalProfile - The original profile
   * @param {ValidatedMember} updatedProfile - The updated profile data
   * @param {string[]} [forbiddenFields] - List of forbidden fields
   * @returns {ProfileUpdateResult}
   */
  static processProfileUpdate(originalProfile, updatedProfile, forbiddenFields = DEFAULT_FORBIDDEN_FIELDS) {
    // Check for null/undefined profiles
    if (!originalProfile) {
      return {
        success: false,
        message: 'Original profile not found'
      };
    }

    if (!updatedProfile) {
      return {
        success: false,
        message: 'Updated profile data must be provided'
      };
    }

    // Validate profile update format
    const validation = this.validateProfileUpdate(updatedProfile);
    if (!validation.valid) {
      return {
        success: false,
        message: validation.error
      };
    }

    // Check for forbidden field updates
    const forbiddenCheck = this.checkForForbiddenUpdates(originalProfile, updatedProfile, forbiddenFields);
    if (forbiddenCheck.hasViolation) {
      const action = forbiddenCheck.violationType === 'add' ? 'Addition of' : 'Update to';
      return {
        success: false,
        message: `${action} forbidden field: ${forbiddenCheck.field}`
      };
    }

    // Merge profiles
    const mergedProfile = this.mergeProfiles(originalProfile, updatedProfile);

    return {
      success: true,
      message: 'Profile updated successfully',
      mergedProfile: mergedProfile
    };
  }

  /**
   * Format a profile for display (client-safe view)
   * Removes sensitive fields that shouldn't be exposed to the client
   * @param {ValidatedMember} profile - The full profile
   * @returns {Record<string, any>} The safe profile for display
   */
  static formatProfileForDisplay(profile) {
    if (!profile) {
      return null;
    }
    
    // Return all member information for display
    // Dates will be formatted by the GAS layer for local timezone
    return {
      // Identity (email is read-only)
      First: profile.First || '',
      Last: profile.Last || '',
      Phone: profile.Phone || '',
      Email: profile.Email || '',
      
      // Membership info (all read-only)
      Status: profile.Status || '',
      Joined: profile.Joined || null,
      Expires: profile.Expires || null,
      'Renewed On': profile['Renewed On'] || null,
      Period: profile.Period || '',
      
      // Directory sharing (editable checkboxes)
      'Directory Share Name': !!profile['Directory Share Name'],
      'Directory Share Phone': !!profile['Directory Share Phone'],
      'Directory Share Email': !!profile['Directory Share Email']
    };
  }

  /**
   * Get editable fields from a profile
   * @param {ValidatedMember} profile - The full profile
   * @returns {Record<string, any>} Only the editable fields
   */
  static getEditableFields(profile) {
    if (!profile) {
      return null;
    }
    
    return {
      First: profile.First || '',
      Last: profile.Last || '',
      Phone: profile.Phone || '',
      'Directory Share Name': !!profile['Directory Share Name'],
      'Directory Share Phone': !!profile['Directory Share Phone'],
      'Directory Share Email': !!profile['Directory Share Email']
    };
  }

  /**
   * Normalize email address
   * @param {string} email - Email to normalize
   * @returns {string} Normalized email (lowercase, trimmed)
   */
  static normalizeEmail(email) {
    if (!email || typeof email !== 'string') {
      return '';
    }
    return email.trim().toLowerCase();
  }

  /**
   * Format a profile update result for API response
   * @param {boolean} success - Whether the update succeeded
   * @param {string} message - Result message
   * @returns {{success: boolean, message: string}}
   */
  static formatUpdateResult(success, message) {
    return {
      success: success,
      message: message
    };
  }
};

// Node.js export for testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    Manager: ProfileManagementService.Manager,
    DEFAULT_FORBIDDEN_FIELDS,
    PROFILE_FIELD_SCHEMA
  };
}
