/**
 * @fileoverview Tests for ValidatedFIFOItem class
 * 
 * Tests the class-based approach to FIFO item validation and construction.
 * Ensures proper type safety and data quality for expiration queue items.
 */

// Mock GAS environment
jest.mock('../src/common/config/Properties.js', () => ({}));
jest.mock('../src/common/utils/Logger.js', () => ({}));

// Load the ValidatedFIFOItem class and assign to global
const { ValidatedFIFOItem } = require('../src/services/MembershipManagement/ValidatedFIFOItem.js');
global.ValidatedFIFOItem = ValidatedFIFOItem;

describe('ValidatedFIFOItem Class', () => {
  
  describe('Constructor Validation', () => {
    
    test('should create valid FIFO item with all fields', () => {
      const item = new ValidatedFIFOItem(
        'fifo-001',
        'test@example.com',
        'Expiry Notice',
        '<p>Your membership has expired</p>',
        'members@sc3.club,board@sc3.club',
        2,
        '2025-11-21T18:30:00.000Z',
        'Email service temporarily unavailable',
        '2025-11-21T18:35:00.000Z',
        5,
        false
      );
      
      expect(item.id).toBe('fifo-001');
      expect(item.email).toBe('test@example.com');
      expect(item.subject).toBe('Expiry Notice');
      expect(item.htmlBody).toBe('<p>Your membership has expired</p>');
      expect(item.groups).toBe('members@sc3.club,board@sc3.club');
      expect(item.attempts).toBe(2);
      expect(item.lastAttemptAt).toBe('2025-11-21T18:30:00.000Z');
      expect(item.lastError).toBe('Email service temporarily unavailable');
      expect(item.nextAttemptAt).toBe('2025-11-21T18:35:00.000Z');
      expect(item.maxAttempts).toBe(5);
      expect(item.dead).toBe(false);
    });
    
    test('should create valid FIFO item with minimal required fields', () => {
      const item = new ValidatedFIFOItem(
        'fifo-002',
        'minimal@example.com',
        'Test Subject',
        '<p>Test body</p>',
        '',
        0,
        '',
        '',
        '',
        null,
        false
      );
      
      expect(item.id).toBe('fifo-002');
      expect(item.email).toBe('minimal@example.com');
      expect(item.subject).toBe('Test Subject');
      expect(item.htmlBody).toBe('<p>Test body</p>');
      expect(item.groups).toBe('');
      expect(item.attempts).toBe(0);
      expect(item.lastAttemptAt).toBe('');
      expect(item.lastError).toBe('');
      expect(item.nextAttemptAt).toBe('');
      expect(item.maxAttempts).toBe(null);
      expect(item.dead).toBe(false);
    });
    
    test('should default dead to false when not provided', () => {
      const item = new ValidatedFIFOItem(
        'fifo-003',
        'test@example.com',
        'Subject',
        '<p>Body</p>',
        '',
        0,
        '',
        '',
        '',
        null,
        undefined
      );
      
      expect(item.dead).toBe(false);
    });
    
    test('should coerce dead to boolean', () => {
      const item1 = new ValidatedFIFOItem(
        'fifo-004',
        'test@example.com',
        'Subject',
        '<p>Body</p>',
        '',
        0,
        '',
        '',
        '',
        null,
        'true'
      );
      expect(item1.dead).toBe(true);
      
      const item2 = new ValidatedFIFOItem(
        'fifo-005',
        'test@example.com',
        'Subject',
        '<p>Body</p>',
        '',
        0,
        '',
        '',
        '',
        null,
        1
      );
      expect(item2.dead).toBe(true);
      
      const item3 = new ValidatedFIFOItem(
        'fifo-006',
        'test@example.com',
        'Subject',
        '<p>Body</p>',
        '',
        0,
        '',
        '',
        '',
        null,
        0
      );
      expect(item3.dead).toBe(false);
    });
    
    test('should throw error for missing id', () => {
      expect(() => new ValidatedFIFOItem(
        null,
        'test@example.com',
        'Subject',
        '<p>Body</p>',
        '',
        0,
        '',
        '',
        '',
        null,
        false
      )).toThrow('id is required');
      
      expect(() => new ValidatedFIFOItem(
        '',
        'test@example.com',
        'Subject',
        '<p>Body</p>',
        '',
        0,
        '',
        '',
        '',
        null,
        false
      )).toThrow('id is required');
      
      expect(() => new ValidatedFIFOItem(
        '   ',
        'test@example.com',
        'Subject',
        '<p>Body</p>',
        '',
        0,
        '',
        '',
        '',
        null,
        false
      )).toThrow('id is required');
    });
    
    test('should throw error for missing email', () => {
      expect(() => new ValidatedFIFOItem(
        'fifo-001',
        null,
        'Subject',
        '<p>Body</p>',
        '',
        0,
        '',
        '',
        '',
        null,
        false
      )).toThrow('email is required');
      
      expect(() => new ValidatedFIFOItem(
        'fifo-001',
        '',
        'Subject',
        '<p>Body</p>',
        '',
        0,
        '',
        '',
        '',
        null,
        false
      )).toThrow('email is required');
    });
    
    test('should throw error for invalid email format', () => {
      expect(() => new ValidatedFIFOItem(
        'fifo-001',
        'not-an-email',
        'Subject',
        '<p>Body</p>',
        '',
        0,
        '',
        '',
        '',
        null,
        false
      )).toThrow('email must be valid format');
      
      expect(() => new ValidatedFIFOItem(
        'fifo-001',
        'missing-at-sign.com',
        'Subject',
        '<p>Body</p>',
        '',
        0,
        '',
        '',
        '',
        null,
        false
      )).toThrow('email must be valid format');
      
      expect(() => new ValidatedFIFOItem(
        'fifo-001',
        '@no-local-part.com',
        'Subject',
        '<p>Body</p>',
        '',
        0,
        '',
        '',
        '',
        null,
        false
      )).toThrow('email must be valid format');
    });
    
    test('should throw error for missing subject', () => {
      expect(() => new ValidatedFIFOItem(
        'fifo-001',
        'test@example.com',
        null,
        '<p>Body</p>',
        '',
        0,
        '',
        '',
        '',
        null,
        false
      )).toThrow('subject is required');
      
      expect(() => new ValidatedFIFOItem(
        'fifo-001',
        'test@example.com',
        '',
        '<p>Body</p>',
        '',
        0,
        '',
        '',
        '',
        null,
        false
      )).toThrow('subject is required');
      
      expect(() => new ValidatedFIFOItem(
        'fifo-001',
        'test@example.com',
        '   ',
        '<p>Body</p>',
        '',
        0,
        '',
        '',
        '',
        null,
        false
      )).toThrow('subject is required');
    });
    
    test('should throw error for missing htmlBody', () => {
      expect(() => new ValidatedFIFOItem(
        'fifo-001',
        'test@example.com',
        'Subject',
        null,
        '',
        0,
        '',
        '',
        '',
        null,
        false
      )).toThrow('htmlBody is required');
      
      expect(() => new ValidatedFIFOItem(
        'fifo-001',
        'test@example.com',
        'Subject',
        '',
        '',
        0,
        '',
        '',
        '',
        null,
        false
      )).toThrow('htmlBody is required');
      
      expect(() => new ValidatedFIFOItem(
        'fifo-001',
        'test@example.com',
        'Subject',
        '   ',
        '',
        0,
        '',
        '',
        '',
        null,
        false
      )).toThrow('htmlBody is required');
    });
    
    test('should throw error for invalid attempts', () => {
      expect(() => new ValidatedFIFOItem(
        'fifo-001',
        'test@example.com',
        'Subject',
        '<p>Body</p>',
        '',
        -1,
        '',
        '',
        '',
        null,
        false
      )).toThrow('attempts must be number >= 0');
      
      expect(() => new ValidatedFIFOItem(
        'fifo-001',
        'test@example.com',
        'Subject',
        '<p>Body</p>',
        '',
        'not-a-number',
        '',
        '',
        '',
        null,
        false
      )).toThrow('attempts must be number >= 0');
      
      expect(() => new ValidatedFIFOItem(
        'fifo-001',
        'test@example.com',
        'Subject',
        '<p>Body</p>',
        '',
        null,
        '',
        '',
        '',
        null,
        false
      )).toThrow('attempts must be number >= 0');
    });
    
    test('should handle empty optional string fields', () => {
      const item = new ValidatedFIFOItem(
        'fifo-001',
        'test@example.com',
        'Subject',
        '<p>Body</p>',
        null,
        0,
        null,
        null,
        null,
        null,
        false
      );
      
      expect(item.groups).toBe('');
      expect(item.lastAttemptAt).toBe('');
      expect(item.lastError).toBe('');
      expect(item.nextAttemptAt).toBe('');
    });
    
    test('should handle maxAttempts as null', () => {
      const item1 = new ValidatedFIFOItem(
        'fifo-001',
        'test@example.com',
        'Subject',
        '<p>Body</p>',
        '',
        0,
        '',
        '',
        '',
        null,
        false
      );
      expect(item1.maxAttempts).toBe(null);
      
      const item2 = new ValidatedFIFOItem(
        'fifo-002',
        'test@example.com',
        'Subject',
        '<p>Body</p>',
        '',
        0,
        '',
        '',
        '',
        '',
        false
      );
      expect(item2.maxAttempts).toBe(null);
      
      const item3 = new ValidatedFIFOItem(
        'fifo-003',
        'test@example.com',
        'Subject',
        '<p>Body</p>',
        '',
        0,
        '',
        '',
        '',
        5,
        false
      );
      expect(item3.maxAttempts).toBe(5);
    });
    
  });
  
  describe('toArray() Method', () => {
    
    test('should convert FIFO item to array in correct column order', () => {
      const item = new ValidatedFIFOItem(
        'fifo-001',
        'test@example.com',
        'Expiry Notice',
        '<p>Your membership has expired</p>',
        'members@sc3.club',
        2,
        '2025-11-21T18:30:00.000Z',
        'Email error',
        '2025-11-21T18:35:00.000Z',
        5,
        false
      );
      
      const array = item.toArray();
      
      expect(array).toEqual([
        'fifo-001',
        'test@example.com',
        'Expiry Notice',
        '<p>Your membership has expired</p>',
        'members@sc3.club',
        2,
        '2025-11-21T18:30:00.000Z',
        'Email error',
        '2025-11-21T18:35:00.000Z',
        5,
        false
      ]);
    });
    
    test('should match HEADERS constant order', () => {
      const item = new ValidatedFIFOItem(
        'fifo-001',
        'test@example.com',
        'Subject',
        '<p>Body</p>',
        '',
        0,
        '',
        '',
        '',
        null,
        false
      );
      
      const array = item.toArray();
      const headers = ValidatedFIFOItem.HEADERS;
      
      expect(array.length).toBe(headers.length);
      
      for (let i = 0; i < headers.length; i++) {
        expect(array[i]).toBe(item[headers[i]]);
      }
    });
    
  });
  
  describe('HEADERS Static Getter', () => {
    
    test('should return correct headers', () => {
      const headers = ValidatedFIFOItem.HEADERS;
      
      expect(headers).toEqual([
        'id',
        'email',
        'subject',
        'htmlBody',
        'groups',
        'attempts',
        'lastAttemptAt',
        'lastError',
        'nextAttemptAt',
        'maxAttempts',
        'dead'
      ]);
    });
    
  });
  
  describe('fromRow() Static Method', () => {
    
    const headers = ValidatedFIFOItem.HEADERS;
    
    test('should create FIFO item from valid row', () => {
      const row = [
        'fifo-001',
        'test@example.com',
        'Expiry Notice',
        '<p>Your membership has expired</p>',
        'members@sc3.club',
        2,
        '2025-11-21T18:30:00.000Z',
        'Email error',
        '2025-11-21T18:35:00.000Z',
        5,
        false
      ];
      
      // Mock AppLogger
      global.AppLogger = /** @type {any} */ ({
        error: jest.fn(),
        warn: jest.fn(),
        info: jest.fn()
      });
      
      const item = ValidatedFIFOItem.fromRow(row, headers, 2, null);
      
      expect(item).not.toBeNull();
      expect(item.id).toBe('fifo-001');
      expect(item.email).toBe('test@example.com');
      expect(item.subject).toBe('Expiry Notice');
      expect(item.htmlBody).toBe('<p>Your membership has expired</p>');
      expect(item.groups).toBe('members@sc3.club');
      expect(item.attempts).toBe(2);
      expect(item.lastAttemptAt).toBe('2025-11-21T18:30:00.000Z');
      expect(item.lastError).toBe('Email error');
      expect(item.nextAttemptAt).toBe('2025-11-21T18:35:00.000Z');
      expect(item.maxAttempts).toBe(5);
      expect(item.dead).toBe(false);
    });
    
    test('should create FIFO item with minimal fields', () => {
      const row = [
        'fifo-002',
        'minimal@example.com',
        'Subject',
        '<p>Body</p>',
        '',
        0,
        '',
        '',
        '',
        null,
        false
      ];
      
      global.AppLogger = /** @type {any} */ ({
        error: jest.fn(),
        warn: jest.fn(),
        info: jest.fn()
      });
      
      const item = ValidatedFIFOItem.fromRow(row, headers, 2, null);
      
      expect(item).not.toBeNull();
      expect(item.id).toBe('fifo-002');
      expect(item.email).toBe('minimal@example.com');
      expect(item.groups).toBe('');
      expect(item.attempts).toBe(0);
      expect(item.maxAttempts).toBe(null);
    });
    
    test('should return null on invalid data (missing id)', () => {
      const row = [
        '',
        'test@example.com',
        'Subject',
        '<p>Body</p>',
        '',
        0,
        '',
        '',
        '',
        null,
        false
      ];
      
      global.AppLogger = /** @type {any} */ ({
        error: jest.fn(),
        warn: jest.fn(),
        info: jest.fn()
      });
      
      const item = ValidatedFIFOItem.fromRow(row, headers, 2, null);
      
      expect(item).toBeNull();
      expect(AppLogger.error).toHaveBeenCalledWith(
        'ValidatedFIFOItem',
        expect.stringContaining('Row 2')
      );
    });
    
    test('should return null on invalid data (missing email)', () => {
      const row = [
        'fifo-001',
        '',
        'Subject',
        '<p>Body</p>',
        '',
        0,
        '',
        '',
        '',
        null,
        false
      ];
      
      global.AppLogger = /** @type {any} */ ({
        error: jest.fn(),
        warn: jest.fn(),
        info: jest.fn()
      });
      
      const item = ValidatedFIFOItem.fromRow(row, headers, 3, null);
      
      expect(item).toBeNull();
      expect(AppLogger.error).toHaveBeenCalledWith(
        'ValidatedFIFOItem',
        expect.stringContaining('Row 3')
      );
    });
    
    test('should return null on invalid data (invalid email format)', () => {
      const row = [
        'fifo-001',
        'not-an-email',
        'Subject',
        '<p>Body</p>',
        '',
        0,
        '',
        '',
        '',
        null,
        false
      ];
      
      global.AppLogger = /** @type {any} */ ({
        error: jest.fn(),
        warn: jest.fn(),
        info: jest.fn()
      });
      
      const item = ValidatedFIFOItem.fromRow(row, headers, 4, null);
      
      expect(item).toBeNull();
      expect(AppLogger.error).toHaveBeenCalledWith(
        'ValidatedFIFOItem',
        expect.stringContaining('Row 4')
      );
      expect(AppLogger.error).toHaveBeenCalledWith(
        'ValidatedFIFOItem',
        expect.stringContaining('email must be valid format')
      );
    });
    
    test('should collect errors when errorCollector provided', () => {
      const row = [
        '',
        'test@example.com',
        'Subject',
        '<p>Body</p>',
        '',
        0,
        '',
        '',
        '',
        null,
        false
      ];
      
      global.AppLogger = /** @type {any} */ ({
        error: jest.fn(),
        warn: jest.fn(),
        info: jest.fn()
      });
      
      const errorCollector = { errors: [], rowNumbers: [] };
      const item = ValidatedFIFOItem.fromRow(row, headers, 5, errorCollector);
      
      expect(item).toBeNull();
      expect(errorCollector.errors.length).toBe(1);
      expect(errorCollector.rowNumbers).toEqual([5]);
      expect(errorCollector.errors[0]).toContain('Row 5');
    });
    
    test('should work correctly when sheet columns are in different order than HEADERS', () => {
      // Arrange: Headers in a DIFFERENT order than ValidatedFIFOItem.HEADERS
      const shuffledHeaders = [...ValidatedFIFOItem.HEADERS].reverse();
      const testObj = {
        id: 'fifo-001',
        email: 'test@example.com',
        subject: 'Expiry Notice',
        htmlBody: '<p>Notice</p>',
        groups: 'members@sc3.club',
        attempts: 1,
        lastAttemptAt: '2025-11-21T10:00:00.000Z',
        lastError: 'Error',
        nextAttemptAt: '2025-11-21T10:05:00.000Z',
        maxAttempts: 5,
        dead: false
      };
      const rowData = shuffledHeaders.map(h => testObj[h]);
      
      global.AppLogger = /** @type {any} */ ({
        error: jest.fn(),
        warn: jest.fn(),
        info: jest.fn()
      });
      
      // Act
      const instance = ValidatedFIFOItem.fromRow(rowData, shuffledHeaders, 2, null);
      
      // Assert
      expect(instance).not.toBeNull();
      expect(instance.id).toBe('fifo-001');
      expect(instance.email).toBe('test@example.com');
      expect(instance.subject).toBe('Expiry Notice');
      expect(instance.htmlBody).toBe('<p>Notice</p>');
      expect(instance.groups).toBe('members@sc3.club');
      expect(instance.attempts).toBe(1);
    });
    
  });
  
  describe('validateRows() Batch Validation', () => {
    
    const headers = ValidatedFIFOItem.HEADERS;
    
    beforeEach(() => {
      // Mock AppLogger
      global.AppLogger = /** @type {any} */ ({
        error: jest.fn(),
        warn: jest.fn(),
        info: jest.fn(),
        debug: jest.fn()
      });
      
      // Mock Properties
      global.Properties = /** @type {any} */ ({
        getProperty: jest.fn(() => 'test@sc3.club')
      });
      
      // Mock MailApp
      global.MailApp = /** @type {any} */ ({
        sendEmail: jest.fn()
      });
    });
    
    test('should validate all valid rows', () => {
      const rows = [
        ['fifo-001', 'test1@example.com', 'Subject 1', '<p>Body 1</p>', '', 0, '', '', '', null, false],
        ['fifo-002', 'test2@example.com', 'Subject 2', '<p>Body 2</p>', '', 0, '', '', '', null, false],
        ['fifo-003', 'test3@example.com', 'Subject 3', '<p>Body 3</p>', '', 0, '', '', '', null, false]
      ];
      
      const validItems = ValidatedFIFOItem.validateRows(rows, headers, 'test context');
      
      expect(validItems.length).toBe(3);
      expect(validItems[0].id).toBe('fifo-001');
      expect(validItems[1].id).toBe('fifo-002');
      expect(validItems[2].id).toBe('fifo-003');
      expect(MailApp.sendEmail).not.toHaveBeenCalled();
    });
    
    test('should filter out invalid rows', () => {
      const rows = [
        ['fifo-001', 'test1@example.com', 'Subject 1', '<p>Body 1</p>', '', 0, '', '', '', null, false],
        ['', 'test2@example.com', 'Subject 2', '<p>Body 2</p>', '', 0, '', '', '', null, false], // Missing id
        ['fifo-003', 'test3@example.com', 'Subject 3', '<p>Body 3</p>', '', 0, '', '', '', null, false]
      ];
      
      const validItems = ValidatedFIFOItem.validateRows(rows, headers, 'test context');
      
      expect(validItems.length).toBe(2);
      expect(validItems[0].id).toBe('fifo-001');
      expect(validItems[1].id).toBe('fifo-003');
    });
    
    test('should send email alert on validation errors', () => {
      const rows = [
        ['fifo-001', 'test1@example.com', 'Subject 1', '<p>Body 1</p>', '', 0, '', '', '', null, false],
        ['', 'test2@example.com', 'Subject 2', '<p>Body 2</p>', '', 0, '', '', '', null, false], // Missing id
        ['fifo-003', 'invalid-email', 'Subject 3', '<p>Body 3</p>', '', 0, '', '', '', null, false] // Invalid email
      ];
      
      ValidatedFIFOItem.validateRows(rows, headers, 'DataAccess.getExpirationFIFO');
      
      expect(MailApp.sendEmail).toHaveBeenCalledTimes(1);
      expect(MailApp.sendEmail).toHaveBeenCalledWith({
        to: 'test@sc3.club',
        subject: 'Data Validation Errors: DataAccess.getExpirationFIFO',
        body: expect.stringContaining('2 validation error(s)')
      });
    });
    
    test('should use default email when VALIDATION_ERROR_EMAIL not set', () => {
      global.Properties = /** @type {any} */ ({
        getProperty: jest.fn(() => null)
      });
      
      const rows = [
        ['', 'test@example.com', 'Subject', '<p>Body</p>', '', 0, '', '', '', null, false]
      ];
      
      ValidatedFIFOItem.validateRows(rows, headers, 'test context');
      
      expect(MailApp.sendEmail).toHaveBeenCalledWith({
        to: 'membership_automation@sc3.club',
        subject: expect.stringMatching(/test context/),
        body: expect.stringContaining('1 validation error')
      });
    });
    
    test('should handle email send failure gracefully', () => {
      global.MailApp = /** @type {any} */ ({
        sendEmail: jest.fn(() => { throw new Error('Email service unavailable'); })
      });
      
      const rows = [
        ['', 'test@example.com', 'Subject', '<p>Body</p>', '', 0, '', '', '', null, false]
      ];
      
      // Should not throw
      expect(() => {
        ValidatedFIFOItem.validateRows(rows, headers, 'test context');
      }).not.toThrow();
      
      expect(AppLogger.error).toHaveBeenCalledWith(
        'ValidatedFIFOItem',
        expect.stringContaining('Failed to send validation error email')
      );
    });
    
    test('should return empty array when all rows invalid', () => {
      const rows = [
        ['', 'test1@example.com', 'Subject 1', '<p>Body 1</p>', '', 0, '', '', '', null, false],
        ['fifo-002', '', 'Subject 2', '<p>Body 2</p>', '', 0, '', '', '', null, false],
        ['fifo-003', 'test3@example.com', '', '<p>Body 3</p>', '', 0, '', '', '', null, false]
      ];
      
      const validItems = ValidatedFIFOItem.validateRows(rows, headers, 'test context');
      
      expect(validItems.length).toBe(0);
      expect(MailApp.sendEmail).toHaveBeenCalledTimes(1);
    });
    
  });
  
});
