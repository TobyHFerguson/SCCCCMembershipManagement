/**
 * @fileoverview Tests for Audit.LogEntry class
 * 
 * Tests the class-based approach to audit entry validation and construction.
 * Ensures proper type safety and corruption prevention.
 */

// Mock GAS environment
jest.mock('../src/common/config/Properties.js', () => ({}));
jest.mock('../src/common/utils/Logger.js', () => ({}));

// Load the AuditLogEntry class
require('../src/common/audit/AuditLogEntry.js');

describe('Audit.LogEntry Class', () => {
  
  describe('Constructor Validation', () => {
    
    test('should create valid audit entry with all parameters', () => {
      const entry = new Audit.LogEntry('test-type', 'success', 'Test note', 'No error', '{"key":"value"}');
      
      expect(entry.Type).toBe('test-type');
      expect(entry.Outcome).toBe('success');
      expect(entry.Note).toBe('Test note');
      expect(entry.Error).toBe('No error');
      expect(entry.JSON).toBe('{"key":"value"}');
      expect(entry.Timestamp).toBeInstanceOf(Date);
    });
    
    test('should create valid audit entry with minimal parameters', () => {
      const entry = new Audit.LogEntry('minimal', 'fail');
      
      expect(entry.Type).toBe('minimal');
      expect(entry.Outcome).toBe('fail');
      expect(entry.Note).toBe('');
      expect(entry.Error).toBe('');
      expect(entry.JSON).toBe('');
    });
    
    test('should trim whitespace from string parameters', () => {
      const entry = new Audit.LogEntry('  type  ', '  success  ', '  note  ', '  error  ', '  data  ');
      
      expect(entry.Type).toBe('type');
      expect(entry.Outcome).toBe('success');
      expect(entry.Note).toBe('note');
      expect(entry.Error).toBe('error');
      expect(entry.JSON).toBe('data');
    });
    
    test('should convert null/undefined optional parameters to empty strings', () => {
      const entry = new Audit.LogEntry('test', 'success', null, undefined);
      
      expect(entry.Note).toBe('');
      expect(entry.Error).toBe('');
      expect(entry.JSON).toBe('');
    });
    
    test('should throw error for invalid type parameter', () => {
      expect(() => new Audit.LogEntry(null, 'success')).toThrow('type must be non-empty string');
      expect(() => new Audit.LogEntry('', 'success')).toThrow('type must be non-empty string');
      expect(() => new Audit.LogEntry('   ', 'success')).toThrow('type must be non-empty string');
      expect(() => new Audit.LogEntry(123, 'success')).toThrow('type must be non-empty string');
    });
    
    test('should throw error for invalid outcome parameter', () => {
      expect(() => new Audit.LogEntry('test', null)).toThrow('outcome must be non-empty string');
      expect(() => new Audit.LogEntry('test', '')).toThrow('outcome must be non-empty string');
      expect(() => new Audit.LogEntry('test', '   ')).toThrow('outcome must be non-empty string');
      expect(() => new Audit.LogEntry('test', 123)).toThrow('outcome must be non-empty string');
    });
    
  });
  
  describe('Audit.LogEntry.create() Factory Method', () => {
    
    beforeEach(() => {
      // Reset mocks
      jest.clearAllMocks();
      
      // Mock Common.Logger
      global.Common = {
        Logger: {
          error: jest.fn()
        }
      };
      
      // Mock MailApp
      global.MailApp = {
        sendEmail: jest.fn()
      };
    });
    
    test('should create valid entry when parameters are correct', () => {
      const entry = Audit.LogEntry.create('test', 'success', 'note', 'error', 'data');
      
      expect(entry).toBeInstanceOf(Audit.LogEntry);
      expect(entry.Type).toBe('test');
      expect(entry.Outcome).toBe('success');
    });
    
    test('should create error entry when construction fails', () => {
      const entry = Audit.LogEntry.create(null, 'success');  // Invalid type
      
      expect(entry).toBeInstanceOf(Audit.LogEntry);
      expect(entry.Type).toBe('audit-construction-error');
      expect(entry.Outcome).toBe('fail');
      expect(entry.Note).toContain('Original audit entry construction failed');
      expect(entry.Error).toContain('type="null"');
    });
    
    test('should log error when construction fails', () => {
      Audit.LogEntry.create(123, 'success');  // Invalid type
      
      expect(Common.Logger.error).toHaveBeenCalledWith(
        'Audit.LogEntry',
        expect.stringContaining('Failed to create audit entry')
      );
    });
    
    test('should send email alert when construction fails', () => {
      Audit.LogEntry.create('', 'fail');  // Empty type
      
      expect(MailApp.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'membership-automation@sc3.club',
          subject: 'CRITICAL: Audit Entry Construction Failed',
          body: expect.stringContaining('Audit entry construction failed')
        })
      );
    });
    
    test('should handle email failure gracefully', () => {
      MailApp.sendEmail.mockImplementation(() => {
        throw new Error('Email service down');
      });
      
      const entry = Audit.LogEntry.create(null, 'success');
      
      expect(entry).toBeInstanceOf(Audit.LogEntry);
      expect(Common.Logger.error).toHaveBeenCalledWith(
        'Audit.LogEntry',
        'Failed to send construction failure alert: Email service down'
      );
    });
    
  });
  
  describe('toArray() Method', () => {
    
    test('should convert audit entry to correct array format', () => {
      const entry = new Audit.LogEntry('test-type', 'success', 'Test note', 'Test error', 'Test data');
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
      const entry = new Audit.LogEntry('minimal', 'fail');
      const array = entry.toArray();
      
      expect(array[3]).toBe('');  // Note
      expect(array[4]).toBe('');  // Error
      expect(array[5]).toBe('');  // JSON
    });
    
  });
  
  describe('Audit.LogEntry.validateArray() Static Method', () => {
    
    beforeEach(() => {
      // Reset mocks
      jest.clearAllMocks();
      
      // Mock Common.Logger
      global.Common = {
        Logger: {
          error: jest.fn()
        }
      };
      
      // Mock MailApp
      global.MailApp = {
        sendEmail: jest.fn()
      };
    });
    
    test('should return empty array for non-array input', () => {
      const result = Audit.LogEntry.validateArray('not-array', 'test-context');
      
      expect(result).toEqual([]);
      expect(Common.Logger.error).toHaveBeenCalledWith(
        'Audit.LogEntry',
        'test-context: entries is not an array: string'
      );
      expect(MailApp.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: 'CRITICAL: Non-Array Audit Entries'
        })
      );
    });
    
    test('should return valid entries unchanged', () => {
      const entry1 = new Audit.LogEntry('test1', 'success');
      const entry2 = new Audit.LogEntry('test2', 'fail');
      const entries = [entry1, entry2];
      
      const result = Audit.LogEntry.validateArray(entries, 'test-context');
      
      expect(result).toHaveLength(2);
      expect(result[0]).toBe(entry1);
      expect(result[1]).toBe(entry2);
      expect(Common.Logger.error).not.toHaveBeenCalled();
      expect(MailApp.sendEmail).not.toHaveBeenCalled();
    });
    
    test('should replace non-Audit.LogEntry objects with error entries', () => {
      const validEntry = new Audit.LogEntry('valid', 'success');
      const invalidEntry = { Type: 'invalid', Outcome: 'fail' };  // Raw object
      const entries = [validEntry, invalidEntry];
      
      const result = Audit.LogEntry.validateArray(entries, 'test-context');
      
      expect(result).toHaveLength(2);
      expect(result[0]).toBe(validEntry);
      expect(result[1]).toBeInstanceOf(Audit.LogEntry);
      expect(result[1].Type).toBe('type-validation-error');
      expect(result[1].Outcome).toBe('fail');
      expect(result[1].Note).toContain('Non-Audit.LogEntry object detected at index 1');
    });
    
    test('should log errors for invalid entries', () => {
      const entries = [new Audit.LogEntry('valid', 'success'), { invalid: 'object' }];
      
      Audit.LogEntry.validateArray(entries, 'test-context');
      
      expect(Common.Logger.error).toHaveBeenCalledWith(
        'Audit.LogEntry',
        expect.stringContaining('test-context: entry 1 is not an Audit.LogEntry instance')
      );
    });
    
    test('should send consolidated email alert for corruption', () => {
      const entries = [{ invalid: 'object1' }, { invalid: 'object2' }];
      
      Audit.LogEntry.validateArray(entries, 'test-context');
      
      expect(MailApp.sendEmail).toHaveBeenCalledTimes(1);
      expect(MailApp.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'membership-automation@sc3.club',
          subject: 'CRITICAL: Non-Audit.LogEntry Objects Detected',
          body: expect.stringContaining('test-context')
        })
      );
    });
    
    test('should handle mixed valid and invalid entries', () => {
      const entries = [
        new Audit.LogEntry('valid1', 'success'),
        { invalid: 'object' },
        new Audit.LogEntry('valid2', 'fail'),
        'string-instead-of-object'
      ];
      
      const result = Audit.LogEntry.validateArray(entries, 'mixed-test');
      
      expect(result).toHaveLength(4);
      expect(result[0]).toBeInstanceOf(Audit.LogEntry);
      expect(result[0].Type).toBe('valid1');
      expect(result[1]).toBeInstanceOf(Audit.LogEntry);
      expect(result[1].Type).toBe('type-validation-error');
      expect(result[2]).toBeInstanceOf(Audit.LogEntry);
      expect(result[2].Type).toBe('valid2');
      expect(result[3]).toBeInstanceOf(Audit.LogEntry);
      expect(result[3].Type).toBe('type-validation-error');
    });
    
    test('should handle empty array', () => {
      const result = Audit.LogEntry.validateArray([], 'empty-test');
      
      expect(result).toEqual([]);
      expect(Common.Logger.error).not.toHaveBeenCalled();
      expect(MailApp.sendEmail).not.toHaveBeenCalled();
    });
    
    test('should handle email sending failure gracefully', () => {
      MailApp.sendEmail.mockImplementation(() => {
        throw new Error('Email service unavailable');
      });
      
      const entries = [{ invalid: 'object' }];
      const result = Audit.LogEntry.validateArray(entries, 'email-fail-test');
      
      expect(result).toHaveLength(1);
      expect(result[0]).toBeInstanceOf(Audit.LogEntry);
      expect(Common.Logger.error).toHaveBeenCalledWith(
        'Audit.LogEntry',
        'Failed to send corruption alert: Email service unavailable'
      );
    });
    
  });
  
});