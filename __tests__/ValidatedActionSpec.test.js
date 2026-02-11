/**
 * @fileoverview Tests for ValidatedActionSpec class
 * 
 * Tests the class-based approach to action specification validation and construction.
 * Ensures proper type safety and data quality.
 * 
 * TABLE OF CONTENTS:
 * 1. Constructor Validation
 *    - Valid creation with all fields
 *    - Valid creation with minimal required fields
 *    - Field trimming
 *    - Type validation (required)
 *    - Invalid Type rejection
 *    - Subject validation (required)
 *    - Body validation (required, accepts string or RichText)
 *    - Offset validation (optional, numeric)
 * 2. fromRow() Static Factory
 *    - Valid row parsing
 *    - Column-order independence
 *    - Missing required fields
 *    - Invalid Type value
 *    - Error collection
 * 3. validateRows() Batch Processing
 *    - Multiple valid rows
 *    - Mixed valid/invalid rows
 *    - Email alert on errors
 *    - Empty array handling
 * 4. toArray() Serialization
 *    - Round-trip consistency
 *    - Null field handling
 *    - Column order matching HEADERS
 */

// Mock GAS environment
jest.mock('../src/common/config/Properties.js', () => ({}));
jest.mock('../src/common/utils/Logger.js', () => ({}));

// Load the ValidatedActionSpec class and assign to global
const { ValidatedActionSpec } = require('../src/common/data/ValidatedActionSpec.js');
global.ValidatedActionSpec = ValidatedActionSpec;

describe('ValidatedActionSpec Class', () => {
  
  describe('Constructor Validation', () => {
    
    test('should create valid action spec with all fields', () => {
      const spec = new ValidatedActionSpec(
        'Join',
        'Welcome to SCCCC!',
        '<p>Welcome to our club</p>',
        0
      );
      
      expect(spec.Type).toBe('Join');
      expect(spec.Subject).toBe('Welcome to SCCCC!');
      expect(spec.Body).toBe('<p>Welcome to our club</p>');
      expect(spec.Offset).toBe(0);
    });
    
    test('should create valid action spec with minimal required fields', () => {
      const spec = new ValidatedActionSpec(
        'Renew',
        'Time to renew',
        '<p>Please renew your membership</p>',
        null
      );
      
      expect(spec.Type).toBe('Renew');
      expect(spec.Subject).toBe('Time to renew');
      expect(spec.Body).toBe('<p>Please renew your membership</p>');
      expect(spec.Offset).toBe(null);
    });
    
    test('should accept Body with RichText link objects', () => {
      const richTextBody = {
        text: 'Click here to renew',
        url: 'https://docs.google.com/document/d/abc123'
      };
      
      const spec = new ValidatedActionSpec(
        'Expiry1',
        'Reminder',
        richTextBody,
        -30
      );
      
      expect(spec.Type).toBe('Expiry1');
      expect(spec.Body).toEqual(richTextBody);
      expect(spec.Offset).toBe(-30);
    });
    
    test('should trim Type and Subject fields', () => {
      const spec = new ValidatedActionSpec(
        '  Migrate  ',
        '  Migration Notice  ',
        '<p>Migrating...</p>',
        null
      );
      
      expect(spec.Type).toBe('Migrate');
      expect(spec.Subject).toBe('Migration Notice');
    });
    
    test('should throw error when Type is missing', () => {
      expect(() => {
        new ValidatedActionSpec(
          '',
          'Subject',
          'Body',
          null
        );
      }).toThrow('ValidatedActionSpec Type is required');
    });
    
    test('should throw error when Type is invalid', () => {
      expect(() => {
        new ValidatedActionSpec(
          'InvalidType',
          'Subject',
          'Body',
          null
        );
      }).toThrow('ValidatedActionSpec Type must be one of');
    });
    
    test('should accept all valid ActionType values', () => {
      const validTypes = ['Migrate', 'Join', 'Renew', 'Expiry1', 'Expiry2', 'Expiry3', 'Expiry4'];
      
      validTypes.forEach(type => {
        const spec = new ValidatedActionSpec(
          type,
          'Subject',
          'Body',
          null
        );
        expect(spec.Type).toBe(type);
      });
    });
    
    test('should throw error when Subject is missing', () => {
      expect(() => {
        new ValidatedActionSpec(
          'Join',
          '',
          'Body',
          null
        );
      }).toThrow('ValidatedActionSpec Subject is required');
    });
    
    test('should throw error when Body is missing', () => {
      expect(() => {
        new ValidatedActionSpec(
          'Join',
          'Subject',
          '',
          null
        );
      }).toThrow('ValidatedActionSpec Body is required');
      
      expect(() => {
        new ValidatedActionSpec(
          'Join',
          'Subject',
          null,
          null
        );
      }).toThrow('ValidatedActionSpec Body is required');
    });
    
    test('should throw error when Body RichText object lacks text property', () => {
      expect(() => {
        new ValidatedActionSpec(
          'Join',
          'Subject',
          { url: 'http://example.com' }, // Missing 'text' property
          null
        );
      }).toThrow("ValidatedActionSpec Body object must have 'text' property");
    });
    
    test('should handle Offset as string and convert to number', () => {
      const spec = new ValidatedActionSpec(
        'Expiry2',
        'Subject',
        'Body',
        '-15' // String representation
      );
      
      expect(spec.Offset).toBe(-15);
      expect(typeof spec.Offset).toBe('number');
    });
    
    test('should throw error when Offset is not numeric', () => {
      expect(() => {
        new ValidatedActionSpec(
          'Expiry3',
          'Subject',
          'Body',
          'not-a-number'
        );
      }).toThrow('ValidatedActionSpec Offset must be a valid number');
    });
  });
  
  describe('fromRow() Static Factory', () => {
    
    test('should create ValidatedActionSpec from valid row data', () => {
      const headers = ValidatedActionSpec.HEADERS;
      const rowData = [
        'Join',           // Type
        0,                // Offset
        'Welcome!',       // Subject
        '<p>Body</p>'     // Body
      ];
      
      const spec = ValidatedActionSpec.fromRow(rowData, headers, 2, null);
      
      expect(spec).not.toBeNull();
      expect(spec.Type).toBe('Join');
      expect(spec.Subject).toBe('Welcome!');
      expect(spec.Offset).toBe(0);
    });
    
    test('should work correctly when sheet columns are in different order than HEADERS', () => {
      // Arrange: Headers in a DIFFERENT order than ValidatedActionSpec.HEADERS
      const shuffledHeaders = [...ValidatedActionSpec.HEADERS].reverse();
      const testObj = {
        Type: 'Renew',
        Offset: -10,
        Subject: 'Renewal Time',
        Body: '<p>Renew now</p>'
      };
      const rowData = shuffledHeaders.map(h => testObj[h]);
      
      // Act
      const instance = ValidatedActionSpec.fromRow(rowData, shuffledHeaders, 2, null);
      
      // Assert
      expect(instance).not.toBeNull();
      expect(instance.Type).toBe('Renew');
      expect(instance.Subject).toBe('Renewal Time');
      expect(instance.Offset).toBe(-10);
      expect(instance.Body).toBe('<p>Renew now</p>');
    });
    
    test('should return null when Type is missing', () => {
      const headers = ValidatedActionSpec.HEADERS;
      const rowData = [
        '',               // Type (missing)
        0,
        'Subject',
        'Body'
      ];
      
      const errorCollector = { errors: [], rowNumbers: [] };
      const spec = ValidatedActionSpec.fromRow(rowData, headers, 2, errorCollector);
      
      expect(spec).toBeNull();
      expect(errorCollector.errors.length).toBe(1);
      expect(errorCollector.errors[0]).toContain('Row 2');
      expect(errorCollector.errors[0]).toContain('Type is required');
    });
    
    test('should return null when Type is invalid', () => {
      const headers = ValidatedActionSpec.HEADERS;
      const rowData = [
        'InvalidType',
        0,
        'Subject',
        'Body'
      ];
      
      const errorCollector = { errors: [], rowNumbers: [] };
      const spec = ValidatedActionSpec.fromRow(rowData, headers, 3, errorCollector);
      
      expect(spec).toBeNull();
      expect(errorCollector.errors.length).toBe(1);
      expect(errorCollector.errors[0]).toContain('Row 3');
      expect(errorCollector.errors[0]).toContain('must be one of');
    });
    
    test('should return null when Subject is missing', () => {
      const headers = ValidatedActionSpec.HEADERS;
      const rowData = [
        'Join',
        0,
        '',               // Subject (missing)
        'Body'
      ];
      
      const errorCollector = { errors: [], rowNumbers: [] };
      const spec = ValidatedActionSpec.fromRow(rowData, headers, 4, errorCollector);
      
      expect(spec).toBeNull();
      expect(errorCollector.errors.length).toBe(1);
      expect(errorCollector.errors[0]).toContain('Subject is required');
    });
    
    test('should return null when Body is missing', () => {
      const headers = ValidatedActionSpec.HEADERS;
      const rowData = [
        'Join',
        0,
        'Subject',
        ''                // Body (missing)
      ];
      
      const errorCollector = { errors: [], rowNumbers: [] };
      const spec = ValidatedActionSpec.fromRow(rowData, headers, 5, errorCollector);
      
      expect(spec).toBeNull();
      expect(errorCollector.errors.length).toBe(1);
      expect(errorCollector.errors[0]).toContain('Body is required');
    });
    
    test('should handle RichText Body from row data', () => {
      const headers = ValidatedActionSpec.HEADERS;
      const richTextBody = {
        text: 'Click to view',
        url: 'https://docs.google.com/document/d/xyz789'
      };
      const rowData = [
        'Expiry1',
        -30,
        'Expiring Soon',
        richTextBody      // Body as RichText object
      ];
      
      const spec = ValidatedActionSpec.fromRow(rowData, headers, 2, null);
      
      expect(spec).not.toBeNull();
      expect(spec.Body).toEqual(richTextBody);
    });
  });
  
  describe('validateRows() Batch Processing', () => {
    
    beforeEach(() => {
      // Mock AppLogger
      global.AppLogger = /** @type {any} */ ({
        error: jest.fn(),
        warn: jest.fn()
      });
      
      // Mock MailApp
      global.MailApp = /** @type {any} */ ({
        sendEmail: jest.fn()
      });
    });
    
    test('should validate multiple valid rows', () => {
      const headers = ValidatedActionSpec.HEADERS;
      const rows = [
        ['Join', 0, 'Welcome!', '<p>Welcome</p>'],
        ['Renew', null, 'Time to Renew', '<p>Renew</p>'],
        ['Expiry1', -30, 'Expiring Soon', '<p>Expiring</p>']
      ];
      
      const validSpecs = ValidatedActionSpec.validateRows(rows, headers, 'test context');
      
      expect(validSpecs.length).toBe(3);
      expect(validSpecs[0].Type).toBe('Join');
      expect(validSpecs[1].Type).toBe('Renew');
      expect(validSpecs[2].Type).toBe('Expiry1');
      expect(global.MailApp.sendEmail).not.toHaveBeenCalled();
    });
    
    test('should filter invalid rows and collect errors', () => {
      const headers = ValidatedActionSpec.HEADERS;
      const rows = [
        ['Join', 0, 'Welcome!', '<p>Welcome</p>'],                         // Valid
        ['InvalidType', 0, 'Subject', 'Body'],                             // Invalid Type
        ['Renew', null, '', 'Body'],                                        // Missing Subject
        ['Expiry1', -30, 'Subject', '<p>Body</p>']                         // Valid
      ];
      
      const validSpecs = ValidatedActionSpec.validateRows(rows, headers, 'test context');
      
      expect(validSpecs.length).toBe(2);
      expect(validSpecs[0].Type).toBe('Join');
      expect(validSpecs[1].Type).toBe('Expiry1');
      expect(global.AppLogger.error).toHaveBeenCalledTimes(2);
      expect(global.MailApp.sendEmail).toHaveBeenCalledTimes(1);
    });
    
    test('should send consolidated email alert on validation errors', () => {
      const headers = ValidatedActionSpec.HEADERS;
      const rows = [
        ['', 0, 'Subject', 'Body'],                                         // Missing Type
        ['Join', 0, '', 'Body']                                             // Missing Subject
      ];
      
      ValidatedActionSpec.validateRows(rows, headers, 'DataAccess.getActionSpecs');
      
      expect(global.MailApp.sendEmail).toHaveBeenCalledTimes(1);
      const emailCall = (/** @type {any} */ (global.MailApp.sendEmail)).mock.calls[0][0];
      expect(emailCall.to).toBe('membership-automation@sc3.club');
      expect(emailCall.subject).toContain('2 ActionSpec Validation Error');
      expect(emailCall.body).toContain('Context: DataAccess.getActionSpecs');
      expect(emailCall.body).toContain('Total rows processed: 2');
      expect(emailCall.body).toContain('Row 2');
      expect(emailCall.body).toContain('Row 3');
    });
    
    test('should handle empty rows array', () => {
      const headers = ValidatedActionSpec.HEADERS;
      const rows = [];
      
      const validSpecs = ValidatedActionSpec.validateRows(rows, headers, 'test context');
      
      expect(validSpecs.length).toBe(0);
      expect(global.MailApp.sendEmail).not.toHaveBeenCalled();
    });
    
    test('should continue processing on email send failure', () => {
      const headers = ValidatedActionSpec.HEADERS;
      const rows = [
        ['', 0, 'Subject', 'Body']  // Invalid - missing Type
      ];
      
      (/** @type {any} */ (global.MailApp.sendEmail)).mockImplementation(() => {
        throw new Error('Email send failed');
      });
      
      const validSpecs = ValidatedActionSpec.validateRows(rows, headers, 'test context');
      
      expect(validSpecs.length).toBe(0);
      expect(global.AppLogger.error).toHaveBeenCalledWith(
        'ValidatedActionSpec',
        expect.stringContaining('Failed to send validation error alert')
      );
    });
  });
  
  describe('toArray() Serialization', () => {
    
    test('should convert to array in HEADERS order', () => {
      const spec = new ValidatedActionSpec(
        'Join',
        'Welcome!',
        '<p>Body</p>',
        0
      );
      
      const array = spec.toArray();
      
      expect(array).toEqual([
        'Join',
        0,
        'Welcome!',
        '<p>Body</p>'
      ]);
      expect(array.length).toBe(ValidatedActionSpec.HEADERS.length);
    });
    
    test('should handle null values correctly', () => {
      const spec = new ValidatedActionSpec(
        'Renew',
        'Renewal',
        '<p>Renew</p>',
        null
      );
      
      const array = spec.toArray();
      
      expect(array[1]).toBe(null);  // Offset
    });
    
    test('should round-trip through toArray and fromRow', () => {
      const original = new ValidatedActionSpec(
        'Expiry2',
        'Second Notice',
        '<p>Please renew</p>',
        -15
      );
      
      const array = original.toArray();
      const reconstructed = ValidatedActionSpec.fromRow(
        array,
        ValidatedActionSpec.HEADERS,
        2,
        null
      );
      
      expect(reconstructed).not.toBeNull();
      expect(reconstructed.Type).toBe(original.Type);
      expect(reconstructed.Subject).toBe(original.Subject);
      expect(reconstructed.Body).toBe(original.Body);
      expect(reconstructed.Offset).toBe(original.Offset);
    });
    
    test('should preserve RichText Body object in toArray', () => {
      const richTextBody = {
        text: 'Click here',
        url: 'https://docs.google.com/document/d/abc'
      };
      
      const spec = new ValidatedActionSpec(
        'Join',
        'Welcome',
        richTextBody,
        null
      );
      
      const array = spec.toArray();
      
      expect(array[3]).toEqual(richTextBody);
    });
  });
  
  describe('HEADERS Static Property', () => {
    
    test('should have correct column count', () => {
      expect(ValidatedActionSpec.HEADERS.length).toBe(4);
    });
    
    test('should have expected column names', () => {
      const headers = ValidatedActionSpec.HEADERS;
      expect(headers).toContain('Type');
      expect(headers).toContain('Offset');
      expect(headers).toContain('Subject');
      expect(headers).toContain('Body');
    });
    
    test('should match toArray output order', () => {
      const spec = new ValidatedActionSpec(
        'Join',
        'Subject',
        'Body',
        0
      );
      
      const array = spec.toArray();
      const headers = ValidatedActionSpec.HEADERS;
      
      // Create an object using headers as keys and array values
      const reconstructed = {};
      headers.forEach((header, i) => {
        reconstructed[header] = array[i];
      });
      
      expect(reconstructed.Type).toBe(spec.Type);
      expect(reconstructed.Subject).toBe(spec.Subject);
      expect(reconstructed.Body).toBe(spec.Body);
      expect(reconstructed.Offset).toBe(spec.Offset);
    });
  });
});
