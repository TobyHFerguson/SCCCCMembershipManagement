// @ts-check
/**
 * Test suite for ProfileManagementService.Manager
 * Tests the pure business logic for profile management
 * 
 * Table of Contents:
 * 1. validateEmail - Email validation
 * 2. validateName - Name validation
 * 3. validatePhone - Phone validation
 * 4. checkForForbiddenUpdates - Forbidden field checking
 * 5. validateProfileUpdate - Full profile validation
 * 6. processProfileUpdate - Complete update processing
 * 7. mergeProfiles - Profile merging
 * 8. formatProfileForDisplay - Client-safe profile formatting
 * 9. getEditableFields - Get editable fields only
 * 10. normalizeEmail - Email normalization
 * 11. formatUpdateResult - Update result formatting
 * 12. getForbiddenFields - Get default forbidden fields
 * 13. getProfileFieldSchema - Get profile field schema
 */

const { Manager, DEFAULT_FORBIDDEN_FIELDS, PROFILE_FIELD_SCHEMA } = require('../src/services/ProfileManagementService/Manager');

// Test data factories
const TestData = {
  createProfile: (overrides = {}) => ({
    Status: 'Active',
    Email: 'test@example.com',
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
  }),

  createValidUpdate: (overrides = {}) => ({
    First: 'Jane',
    Last: 'Smith',
    Phone: '(555) 123-4567',
    'Directory Share Name': false,
    'Directory Share Phone': true,
    'Directory Share Email': false,
    ...overrides
  })
};

describe('ProfileManagementService.Manager', () => {

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
  });

  // ==================== validateName Tests ====================
  
  describe('validateName', () => {
    test('accepts valid name', () => {
      expect(Manager.validateName('John')).toEqual({ valid: true });
    });

    test('accepts name with spaces', () => {
      expect(Manager.validateName('Mary Anne')).toEqual({ valid: true });
    });

    test('accepts name with hyphen', () => {
      expect(Manager.validateName('Mary-Anne')).toEqual({ valid: true });
    });

    test('accepts name with apostrophe', () => {
      expect(Manager.validateName("O'Brien")).toEqual({ valid: true });
    });

    test('accepts name with period', () => {
      expect(Manager.validateName('J. Robert')).toEqual({ valid: true });
    });

    test('rejects null name', () => {
      const result = Manager.validateName(null, 'First Name');
      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe('INVALID_NAME');
      expect(result.error).toContain('First Name');
    });

    test('rejects empty string', () => {
      const result = Manager.validateName('', 'Last Name');
      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe('INVALID_NAME');
    });

    test('rejects whitespace only', () => {
      const result = Manager.validateName('   ', 'First Name');
      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe('EMPTY_NAME');
    });

    test('rejects name with special characters', () => {
      const result = Manager.validateName('John@#$%');
      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe('INVALID_NAME_CHARACTERS');
    });

    test('rejects name over 100 characters', () => {
      const longName = 'A'.repeat(101);
      const result = Manager.validateName(longName);
      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe('NAME_TOO_LONG');
    });

    test('accepts name exactly 100 characters', () => {
      const name100 = 'A'.repeat(100);
      expect(Manager.validateName(name100)).toEqual({ valid: true });
    });
  });

  // ==================== validatePhone Tests ====================
  
  describe('validatePhone', () => {
    test('accepts valid phone format', () => {
      expect(Manager.validatePhone('(123) 456-7890')).toEqual({ valid: true });
    });

    test('accepts phone with various area codes', () => {
      expect(Manager.validatePhone('(800) 555-1212')).toEqual({ valid: true });
      expect(Manager.validatePhone('(999) 000-0000')).toEqual({ valid: true });
    });

    test('rejects null phone', () => {
      const result = Manager.validatePhone(null);
      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe('INVALID_PHONE');
    });

    test('rejects empty string', () => {
      const result = Manager.validatePhone('');
      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe('INVALID_PHONE');
    });

    test('rejects wrong format - no parentheses', () => {
      const result = Manager.validatePhone('123-456-7890');
      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe('INVALID_PHONE_FORMAT');
    });

    test('rejects wrong format - no space after area code', () => {
      const result = Manager.validatePhone('(123)456-7890');
      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe('INVALID_PHONE_FORMAT');
    });

    test('rejects wrong format - dots instead of dashes', () => {
      const result = Manager.validatePhone('(123) 456.7890');
      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe('INVALID_PHONE_FORMAT');
    });

    test('rejects phone with letters', () => {
      const result = Manager.validatePhone('(123) 456-ABCD');
      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe('INVALID_PHONE_FORMAT');
    });

    test('rejects phone with wrong number of digits', () => {
      const result = Manager.validatePhone('(123) 456-789');
      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe('INVALID_PHONE_FORMAT');
    });
  });

  // ==================== checkForForbiddenUpdates Tests ====================
  
  describe('checkForForbiddenUpdates', () => {
    test('returns no violation when only allowed fields are updated', () => {
      const original = TestData.createProfile();
      const updated = { First: 'Jane', Last: 'Smith' };
      
      const result = Manager.checkForForbiddenUpdates(original, updated);
      expect(result.hasViolation).toBe(false);
    });

    test('returns no violation when no fields are updated', () => {
      const original = TestData.createProfile();
      const updated = { First: 'John' }; // Same value
      
      const result = Manager.checkForForbiddenUpdates(original, updated);
      expect(result.hasViolation).toBe(false);
    });

    test('returns violation when Status is updated', () => {
      const original = TestData.createProfile();
      const updated = { Status: 'Inactive' };
      
      const result = Manager.checkForForbiddenUpdates(original, updated);
      expect(result.hasViolation).toBe(true);
      expect(result.field).toBe('Status');
      expect(result.violationType).toBe('update');
    });

    test('returns violation when Email is updated', () => {
      const original = TestData.createProfile();
      const updated = { Email: 'new@example.com' };
      
      const result = Manager.checkForForbiddenUpdates(original, updated);
      expect(result.hasViolation).toBe(true);
      expect(result.field).toBe('Email');
      expect(result.violationType).toBe('update');
    });

    test('returns violation when Expires is updated', () => {
      const original = TestData.createProfile();
      const updated = { Expires: new Date('2025-01-01') };
      
      const result = Manager.checkForForbiddenUpdates(original, updated);
      expect(result.hasViolation).toBe(true);
      expect(result.field).toBe('Expires');
      expect(result.violationType).toBe('update');
    });

    test('returns violation when adding a forbidden field', () => {
      const original = { First: 'John', Last: 'Doe' }; // No Status field
      const updated = { First: 'Jane', Status: 'Active' }; // Adding Status
      
      const result = Manager.checkForForbiddenUpdates(original, updated);
      expect(result.hasViolation).toBe(true);
      expect(result.field).toBe('Status');
      expect(result.violationType).toBe('add');
    });

    test('accepts custom forbidden fields list', () => {
      const original = { First: 'John', CustomField: 'value1' };
      const updated = { First: 'Jane', CustomField: 'value2' };
      
      const result = Manager.checkForForbiddenUpdates(original, updated, ['CustomField']);
      expect(result.hasViolation).toBe(true);
      expect(result.field).toBe('CustomField');
    });

    test('returns first violation when multiple forbidden fields are updated', () => {
      const original = TestData.createProfile();
      const updated = { Status: 'Inactive', Email: 'new@example.com' };
      
      const result = Manager.checkForForbiddenUpdates(original, updated);
      expect(result.hasViolation).toBe(true);
      // Should return first violation (Status comes before Email in DEFAULT_FORBIDDEN_FIELDS)
      expect(result.field).toBe('Status');
    });
  });

  // ==================== validateProfileUpdate Tests ====================
  
  describe('validateProfileUpdate', () => {
    test('accepts valid profile update', () => {
      const update = TestData.createValidUpdate();
      expect(Manager.validateProfileUpdate(update)).toEqual({ valid: true });
    });

    test('accepts partial update with only First name', () => {
      const update = { First: 'Jane' };
      expect(Manager.validateProfileUpdate(update)).toEqual({ valid: true });
    });

    test('accepts empty object (no changes)', () => {
      expect(Manager.validateProfileUpdate({})).toEqual({ valid: true });
    });

    test('rejects null profile', () => {
      const result = Manager.validateProfileUpdate(null);
      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe('INVALID_PROFILE');
    });

    test('rejects non-object profile', () => {
      const result = Manager.validateProfileUpdate('not an object');
      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe('INVALID_PROFILE');
    });

    test('rejects invalid First name', () => {
      const update = { First: '@#$%' };
      const result = Manager.validateProfileUpdate(update);
      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe('INVALID_NAME_CHARACTERS');
    });

    test('rejects invalid Last name', () => {
      const update = { Last: '' };
      const result = Manager.validateProfileUpdate(update);
      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe('INVALID_NAME');
    });

    test('rejects invalid Phone format', () => {
      const update = { Phone: '123-456-7890' };
      const result = Manager.validateProfileUpdate(update);
      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe('INVALID_PHONE_FORMAT');
    });

    test('rejects non-boolean Directory Share Name', () => {
      const update = { 'Directory Share Name': 'yes' };
      const result = Manager.validateProfileUpdate(update);
      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe('INVALID_BOOLEAN_FIELD');
    });

    test('rejects non-boolean Directory Share Phone', () => {
      const update = { 'Directory Share Phone': 1 };
      const result = Manager.validateProfileUpdate(update);
      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe('INVALID_BOOLEAN_FIELD');
    });

    test('rejects non-boolean Directory Share Email', () => {
      const update = { 'Directory Share Email': 'true' };
      const result = Manager.validateProfileUpdate(update);
      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe('INVALID_BOOLEAN_FIELD');
    });

    test('accepts boolean false values for directory sharing', () => {
      const update = { 
        'Directory Share Name': false,
        'Directory Share Phone': false,
        'Directory Share Email': false
      };
      expect(Manager.validateProfileUpdate(update)).toEqual({ valid: true });
    });
  });

  // ==================== processProfileUpdate Tests ====================
  
  describe('processProfileUpdate', () => {
    test('successfully processes valid update', () => {
      const original = TestData.createProfile();
      const update = { First: 'Jane', Last: 'Smith' };
      
      const result = Manager.processProfileUpdate(original, update);
      
      expect(result.success).toBe(true);
      expect(result.message).toBe('Profile updated successfully');
      expect(result.mergedProfile.First).toBe('Jane');
      expect(result.mergedProfile.Last).toBe('Smith');
      expect(result.mergedProfile.Email).toBe('test@example.com'); // Preserved
    });

    test('fails when original profile is null', () => {
      const update = { First: 'Jane' };
      
      const result = Manager.processProfileUpdate(null, update);
      
      expect(result.success).toBe(false);
      expect(result.message).toBe('Original profile not found');
    });

    test('fails when updated profile is null', () => {
      const original = TestData.createProfile();
      
      const result = Manager.processProfileUpdate(original, null);
      
      expect(result.success).toBe(false);
      expect(result.message).toBe('Updated profile data must be provided');
    });

    test('fails when updating forbidden field', () => {
      const original = TestData.createProfile();
      const update = { Email: 'new@example.com' };
      
      const result = Manager.processProfileUpdate(original, update);
      
      expect(result.success).toBe(false);
      expect(result.message).toContain('forbidden field');
      expect(result.message).toContain('Email');
    });

    test('fails when validation fails', () => {
      const original = TestData.createProfile();
      const update = { First: '' };
      
      const result = Manager.processProfileUpdate(original, update);
      
      expect(result.success).toBe(false);
    });

    test('preserves all original fields not in update', () => {
      const original = TestData.createProfile();
      const update = { First: 'Jane' };
      
      const result = Manager.processProfileUpdate(original, update);
      
      expect(result.success).toBe(true);
      expect(result.mergedProfile.Last).toBe('Doe');
      expect(result.mergedProfile.Phone).toBe('(123) 456-7890');
      expect(result.mergedProfile.Status).toBe('Active');
    });
  });

  // ==================== mergeProfiles Tests ====================
  
  describe('mergeProfiles', () => {
    test('merges updates into original', () => {
      const original = { a: 1, b: 2, c: 3 };
      const updates = { b: 20, d: 4 };
      
      const result = Manager.mergeProfiles(original, updates);
      
      expect(result).toEqual({ a: 1, b: 20, c: 3, d: 4 });
    });

    test('does not modify original profile', () => {
      const original = { a: 1, b: 2 };
      const updates = { b: 20 };
      
      Manager.mergeProfiles(original, updates);
      
      expect(original.b).toBe(2);
    });

    test('handles empty updates', () => {
      const original = { a: 1, b: 2 };
      
      const result = Manager.mergeProfiles(original, {});
      
      expect(result).toEqual({ a: 1, b: 2 });
    });
  });

  // ==================== formatProfileForDisplay Tests ====================
  
  describe('formatProfileForDisplay', () => {
    test('returns all profile fields including membership dates', () => {
      const profile = TestData.createProfile();
      
      const result = Manager.formatProfileForDisplay(profile);
      
      expect(Object.keys(result)).toEqual([
        'First', 'Last', 'Phone', 'Email',
        'Status', 'Joined', 'Expires', 'Renewed On', 'Period',
        'Directory Share Name', 'Directory Share Phone', 'Directory Share Email'
      ]);
    });

    test('includes membership fields as read-only data', () => {
      const profile = TestData.createProfile();
      
      const result = Manager.formatProfileForDisplay(profile);
      
      expect(result.Status).toBe('Active');
      expect(result.Joined).toEqual(expect.any(Date));
      expect(result.Expires).toEqual(expect.any(Date));
      expect(result.Period).toBe(12); // Updated to match test data
    });

    test('returns null for null profile', () => {
      expect(Manager.formatProfileForDisplay(null)).toBeNull();
    });

    test('converts directory sharing to booleans', () => {
      const profile = { 
        First: 'John',
        'Directory Share Name': 1, // Truthy but not boolean
        'Directory Share Phone': 0 // Falsy
      };
      
      const result = Manager.formatProfileForDisplay(profile);
      
      expect(result['Directory Share Name']).toBe(true);
      expect(result['Directory Share Phone']).toBe(false);
    });

    test('defaults missing fields to empty string or false', () => {
      const profile = {};
      
      const result = Manager.formatProfileForDisplay(profile);
      
      expect(result.First).toBe('');
      expect(result.Last).toBe('');
      expect(result.Phone).toBe('');
      expect(result.Email).toBe('');
      expect(result['Directory Share Name']).toBe(false);
    });
  });

  // ==================== getEditableFields Tests ====================
  
  describe('getEditableFields', () => {
    test('returns only editable fields', () => {
      const profile = TestData.createProfile();
      
      const result = Manager.getEditableFields(profile);
      
      expect(Object.keys(result)).toEqual([
        'First', 'Last', 'Phone',
        'Directory Share Name', 'Directory Share Phone', 'Directory Share Email'
      ]);
      expect(result.Email).toBeUndefined();
      expect(result.Status).toBeUndefined();
    });

    test('returns null for null profile', () => {
      expect(Manager.getEditableFields(null)).toBeNull();
    });

    test('converts directory sharing to booleans', () => {
      const profile = { 
        First: 'John',
        'Directory Share Name': 'yes' // Truthy string
      };
      
      const result = Manager.getEditableFields(profile);
      
      expect(result['Directory Share Name']).toBe(true);
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

  // ==================== formatUpdateResult Tests ====================
  
  describe('formatUpdateResult', () => {
    test('formats success result', () => {
      const result = Manager.formatUpdateResult(true, 'Success!');
      
      expect(result).toEqual({
        success: true,
        message: 'Success!'
      });
    });

    test('formats failure result', () => {
      const result = Manager.formatUpdateResult(false, 'Error occurred');
      
      expect(result).toEqual({
        success: false,
        message: 'Error occurred'
      });
    });
  });

  // ==================== getForbiddenFields Tests ====================
  
  describe('getForbiddenFields', () => {
    test('returns copy of default forbidden fields', () => {
      const fields = Manager.getForbiddenFields();
      
      expect(fields).toEqual(DEFAULT_FORBIDDEN_FIELDS);
    });

    test('returns new array (not reference)', () => {
      const fields1 = Manager.getForbiddenFields();
      const fields2 = Manager.getForbiddenFields();
      
      expect(fields1).not.toBe(fields2);
    });

    test('includes expected fields', () => {
      const fields = Manager.getForbiddenFields();
      
      expect(fields).toContain('Status');
      expect(fields).toContain('Email');
      expect(fields).toContain('Joined');
      expect(fields).toContain('Expires');
      expect(fields).toContain('Period');
    });
  });

  // ==================== getProfileFieldSchema Tests ====================
  
  describe('getProfileFieldSchema', () => {
    test('returns copy of field schema', () => {
      const schema = Manager.getProfileFieldSchema();
      
      expect(schema).toEqual(PROFILE_FIELD_SCHEMA);
    });

    test('returns new object (not reference)', () => {
      const schema1 = Manager.getProfileFieldSchema();
      const schema2 = Manager.getProfileFieldSchema();
      
      expect(schema1).not.toBe(schema2);
    });

    test('includes First name schema', () => {
      const schema = Manager.getProfileFieldSchema();
      
      expect(schema.First).toBeDefined();
      expect(schema.First.required).toBe(true);
      expect(schema.First.pattern).toBeDefined();
    });

    test('includes Phone schema', () => {
      const schema = Manager.getProfileFieldSchema();
      
      expect(schema.Phone).toBeDefined();
      expect(schema.Phone.required).toBe(true);
      expect(schema.Phone.pattern).toBeDefined();
    });
  });
});
