/**
 * @fileoverview Tests for AuditLogEntry class
 * 
 * Tests the class-based approach to audit entry validation and construction.
 * Ensures proper type safety and corruption prevention.
 */

// Mock GAS environment
jest.mock('../src/common/config/Properties.js', () => ({}));
jest.mock('../src/common/utils/Logger.js', () => ({}));

// Load the AuditLogEntry class (flat pattern)
const AuditLogEntry = require('../src/common/audit/AuditLogEntry.js');
global.AuditLogEntry = AuditLogEntry;

describe('AuditLogEntry Class', () => {
  
  describe('Constructor Validation', () => {
    
    test('should create valid audit entry with all parameters', () => {
      const entry = new AuditLogEntry('test-type', 'success', 'Test note', 'No error', '{"key":"value"}');
      
      expect(entry.Type).toBe('test-type');
      expect(entry.Outcome).toBe('success');
      expect(entry.Note).toBe('Test note');
      expect(entry.Error).toBe('No error');
      expect(entry.JSON).toBe('{"key":"value"}');
      expect(entry.Timestamp).toBeInstanceOf(Date);
    });
    
    test('should create valid audit entry with minimal parameters', () => {
      const entry = new AuditLogEntry('minimal', 'fail');
      
      expect(entry.Type).toBe('minimal');
      expect(entry.Outcome).toBe('fail');
      expect(entry.Note).toBe('');
      expect(entry.Error).toBe('');
      expect(entry.JSON).toBe('');
    });
    
    test('should trim whitespace from string parameters', () => {
      const entry = new AuditLogEntry('  type  ', '  success  ', '  note  ', '  error  ', '  data  ');
      
      expect(entry.Type).toBe('type');
      expect(entry.Outcome).toBe('success');
      expect(entry.Note).toBe('note');
      expect(entry.Error).toBe('error');
      expect(entry.JSON).toBe('data');
    });
    
    test('should convert null/undefined optional parameters to empty strings', () => {
      const entry = new AuditLogEntry('test', 'success', null, undefined);
      
      expect(entry.Note).toBe('');
      expect(entry.Error).toBe('');
      expect(entry.JSON).toBe('');
    });
    
    test('should throw error for invalid type parameter', () => {
      expect(() => new AuditLogEntry(null, 'success')).toThrow('type must be non-empty string');
      expect(() => new AuditLogEntry('', 'success')).toThrow('type must be non-empty string');
      expect(() => new AuditLogEntry('   ', 'success')).toThrow('type must be non-empty string');
      expect(() => new AuditLogEntry(123, 'success')).toThrow('type must be non-empty string');
    });
    
    test('should throw error for invalid outcome parameter', () => {
      expect(() => new AuditLogEntry('test', null)).toThrow('outcome must be non-empty string');
      expect(() => new AuditLogEntry('test', '')).toThrow('outcome must be non-empty string');
      expect(() => new AuditLogEntry('test', '   ')).toThrow('outcome must be non-empty string');
      expect(() => new AuditLogEntry('test', 123)).toThrow('outcome must be non-empty string');
    });
    
  });
  
  describe('AuditLogEntry.create() Factory Method', () => {
    
    beforeEach(() => {
      // Reset mocks
      jest.clearAllMocks();
      
      // Mock Logger (flat class pattern)
      global.AppLogger = {
        error: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn()
      };

    // Mock GAS built-in Logger
    global.Logger = {
      log: jest.fn(),
      clear: jest.fn(),
      getLog: jest.fn(() => '')
    };
      
      // Mock Common.Logger (backward compat)
      global.Common = {
        Logger: global.AppLogger
      };
      
      // Mock MailApp
      global.MailApp = {
        sendEmail: jest.fn()
      };
    });
    
    test('should create valid entry when parameters are correct', () => {
      const entry = AuditLogEntry.create('test', 'success', 'note', 'error', 'data');
      
      expect(entry).toBeInstanceOf(AuditLogEntry);
      expect(entry.Type).toBe('test');
      expect(entry.Outcome).toBe('success');
    });
    
    test('should create error entry when construction fails', () => {
      const entry = AuditLogEntry.create(null, 'success');  // Invalid type
      
      expect(entry).toBeInstanceOf(AuditLogEntry);
      expect(entry.Type).toBe('audit-construction-error');
      expect(entry.Outcome).toBe('fail');
      expect(entry.Note).toContain('Original audit entry construction failed');
      expect(entry.Error).toContain('type="null"');
    });
    
    test('should log error when construction fails', () => {
      AuditLogEntry.create(123, 'success');  // Invalid type
      
      expect(Common.Logger.error).toHaveBeenCalledWith(
        'AuditLogEntry',
        expect.stringContaining('Failed to create audit entry')
      );
    });
    
    test('should send email alert when construction fails', () => {
      AuditLogEntry.create('', 'fail');  // Empty type
      
      expect(MailApp.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'membership-automation@sc3.club',
          subject: 'CRITICAL: Audit Entry Construction Failed',
          body: expect.stringContaining('Audit entry construction failed')
        })
      );
    });
    
    test('should handle email failure gracefully', () => {
      (/** @type {any} */ (MailApp.sendEmail)).mockImplementation(() => {
        throw new Error('Email service down');
      });
      
      const entry = AuditLogEntry.create(null, 'success');
      
      expect(entry).toBeInstanceOf(AuditLogEntry);
      expect(Common.Logger.error).toHaveBeenCalledWith(
        'AuditLogEntry',
        'Failed to send construction failure alert: Email service down'
      );
    });
    
  });
  
  describe('toArray() Method', () => {
    
    test('should convert audit entry to correct array format', () => {
      const entry = new AuditLogEntry('test-type', 'success', 'Test note', 'Test error', 'Test data');
      const array = entry.toArray();
      
      expect(array).toHaveLength(6);
      expect(array[0]).toBeInstanceOf(Date);  // Timestamp
      expect(array[1]).toBe('test-type');     // Type
      expect(array[2]).toBe('success');       // Outcome
      expect(array[3]).toBe('Test note');     // Note
      expect(array[4]).toBe('Test error');    // Error
      expect(array[5]).toBe('Test data');     // JSON
    });
    
    test('should handle empty optional fields', () => {
      const entry = new AuditLogEntry('minimal', 'fail');
      const array = entry.toArray();
      
      expect(array[3]).toBe('');  // Note
      expect(array[4]).toBe('');  // Error
      expect(array[5]).toBe('');  // JSON
    });
    
  });
  
  describe('AuditLogEntry.validateArray() Static Method', () => {
    
    beforeEach(() => {
      // Reset mocks
      jest.clearAllMocks();
      
      // Mock Logger (flat class pattern)
      global.AppLogger = {
        error: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn()
      };

    // Mock GAS built-in Logger
    global.Logger = {
      log: jest.fn(),
      clear: jest.fn(),
      getLog: jest.fn(() => '')
    };
      
      // Mock Common.Logger (backward compat)
      global.Common = {
        Logger: global.AppLogger
      };
      
      // Mock MailApp
      global.MailApp = {
        sendEmail: jest.fn()
      };
    });
    
    test('should return empty array for non-array input', () => {
      const result = AuditLogEntry.validateArray('not-array', 'test-context');
      
      expect(result).toEqual([]);
      expect(Common.Logger.error).toHaveBeenCalledWith(
        'AuditLogEntry',
        'test-context: entries is not an array: string'
      );
      expect(MailApp.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: 'CRITICAL: Non-Array Audit Entries'
        })
      );
    });
    
    test('should return valid entries unchanged', () => {
      const entry1 = new AuditLogEntry('test1', 'success');
      const entry2 = new AuditLogEntry('test2', 'fail');
      const entries = [entry1, entry2];
      
      const result = AuditLogEntry.validateArray(entries, 'test-context');
      
      expect(result).toHaveLength(2);
      expect(result[0]).toBe(entry1);
      expect(result[1]).toBe(entry2);
      expect(Common.Logger.error).not.toHaveBeenCalled();
      expect(MailApp.sendEmail).not.toHaveBeenCalled();
    });
    
    test('should replace non-AuditLogEntry objects with error entries', () => {
      const validEntry = new AuditLogEntry('valid', 'success');
      const invalidEntry = { Type: 'invalid', Outcome: 'fail' };  // Raw object
      const entries = [validEntry, invalidEntry];
      
      const result = AuditLogEntry.validateArray(entries, 'test-context');
      
      expect(result).toHaveLength(2);
      expect(result[0]).toBe(validEntry);
      expect(result[1]).toBeInstanceOf(AuditLogEntry);
      expect(result[1].Type).toBe('type-validation-error');
      expect(result[1].Outcome).toBe('fail');
      expect(result[1].Note).toContain('Non-AuditLogEntry object detected at index 1');
    });
    
    test('should log errors for invalid entries', () => {
      const entries = [new AuditLogEntry('valid', 'success'), { invalid: 'object' }];
      
      AuditLogEntry.validateArray(entries, 'test-context');
      
      expect(Common.Logger.error).toHaveBeenCalledWith(
        'AuditLogEntry',
        expect.stringContaining('test-context: entry 1 is not an AuditLogEntry instance')
      );
    });
    
    test('should send consolidated email alert for corruption', () => {
      const entries = [{ invalid: 'object1' }, { invalid: 'object2' }];
      
      AuditLogEntry.validateArray(entries, 'test-context');
      
      expect(MailApp.sendEmail).toHaveBeenCalledTimes(1);
      expect(MailApp.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'membership-automation@sc3.club',
          subject: 'CRITICAL: Non-AuditLogEntry Objects Detected',
          body: expect.stringContaining('test-context')
        })
      );
    });
    
    test('should handle mixed valid and invalid entries', () => {
      const entries = [
        new AuditLogEntry('valid1', 'success'),
        { invalid: 'object' },
        new AuditLogEntry('valid2', 'fail'),
        'string-instead-of-object'
      ];
      
      const result = AuditLogEntry.validateArray(entries, 'mixed-test');
      
      expect(result).toHaveLength(4);
      expect(result[0]).toBeInstanceOf(AuditLogEntry);
      expect(result[0].Type).toBe('valid1');
      expect(result[1]).toBeInstanceOf(AuditLogEntry);
      expect(result[1].Type).toBe('type-validation-error');
      expect(result[2]).toBeInstanceOf(AuditLogEntry);
      expect(result[2].Type).toBe('valid2');
      expect(result[3]).toBeInstanceOf(AuditLogEntry);
      expect(result[3].Type).toBe('type-validation-error');
    });
    
    test('should handle empty array', () => {
      const result = AuditLogEntry.validateArray([], 'empty-test');
      
      expect(result).toEqual([]);
      expect(Common.Logger.error).not.toHaveBeenCalled();
      expect(MailApp.sendEmail).not.toHaveBeenCalled();
    });
    
    test('should handle email sending failure gracefully', () => {
      (/** @type {any} */ (MailApp.sendEmail)).mockImplementation(() => {
        throw new Error('Email service unavailable');
      });
      
      const entries = [{ invalid: 'object' }];
      const result = AuditLogEntry.validateArray(entries, 'email-fail-test');
      
      expect(result).toHaveLength(1);
      expect(result[0]).toBeInstanceOf(AuditLogEntry);
      expect(Common.Logger.error).toHaveBeenCalledWith(
        'AuditLogEntry',
        'Failed to send corruption alert: Email service unavailable'
      );
    });
    
  });
  
});