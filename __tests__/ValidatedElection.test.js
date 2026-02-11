/**
 * @fileoverview Tests for ValidatedElection class
 * 
 * Tests the class-based approach to election validation and construction.
 * Ensures proper type safety and data quality.
 * 
 * TABLE OF CONTENTS:
 * 1. Constructor Validation
 * 2. fromRow() Static Factory
 * 3. validateRows() Batch Validation
 * 4. toArray() Serialization
 * 5. Column-Order Independence (MANDATORY)
 */

// Mock GAS environment
jest.mock('../src/common/config/Properties.js', () => ({}));
jest.mock('../src/common/utils/Logger.js', () => ({}));

// Load the ValidatedElection class and assign to global
const { ValidatedElection } = require('../src/services/VotingService/ValidatedElection.js');
global.ValidatedElection = ValidatedElection;

describe('ValidatedElection Class', () => {
  
  // ========================================================================
  // 1. Constructor Validation
  // ========================================================================
  
  describe('Constructor Validation', () => {
    
    test('should create valid election with all fields', () => {
      const start = new Date('2026-01-01');
      const end = new Date('2026-01-31');
      
      const election = new ValidatedElection(
        'Board Election 2026',
        start,
        end,
        'https://docs.google.com/forms/d/1234/edit',
        'officer1@sc3.club,officer2@sc3.club',
        'trigger123'
      );
      
      expect(election.Title).toBe('Board Election 2026');
      expect(election.Start).toBe(start);
      expect(election.End).toBe(end);
      expect(election['Form Edit URL']).toBe('https://docs.google.com/forms/d/1234/edit');
      expect(election['Election Officers']).toBe('officer1@sc3.club,officer2@sc3.club');
      expect(election.TriggerId).toBe('trigger123');
    });
    
    test('should create valid election with minimal required fields (title only)', () => {
      const election = new ValidatedElection(
        'Simple Election',
        null,
        null,
        '',
        '',
        ''
      );
      
      expect(election.Title).toBe('Simple Election');
      expect(election.Start).toBe(null);
      expect(election.End).toBe(null);
      expect(election['Form Edit URL']).toBe('');
      expect(election['Election Officers']).toBe('');
      expect(election.TriggerId).toBe('');
    });
    
    test('should trim title whitespace', () => {
      const election = new ValidatedElection(
        '  Trimmed Title  ',
        null,
        null,
        '',
        '',
        ''
      );
      
      expect(election.Title).toBe('Trimmed Title');
    });
    
    test('should accept string dates and parse them', () => {
      const election = new ValidatedElection(
        'String Date Election',
        '2026-01-01',
        '2026-01-31',
        '',
        '',
        ''
      );
      
      expect(election.Start).toEqual(new Date('2026-01-01'));
      expect(election.End).toEqual(new Date('2026-01-31'));
    });
    
    test('should accept Date objects for start and end', () => {
      const start = new Date('2026-01-01');
      const end = new Date('2026-01-31');
      
      const election = new ValidatedElection(
        'Date Object Election',
        start,
        end,
        '',
        '',
        ''
      );
      
      expect(election.Start).toBe(start);
      expect(election.End).toBe(end);
    });
    
    test('should reject missing title', () => {
      expect(() => {
        new ValidatedElection(
          '',
          null,
          null,
          '',
          '',
          ''
        );
      }).toThrow('ValidatedElection title is required');
    });
    
    test('should reject null title', () => {
      expect(() => {
        new ValidatedElection(
          null,
          null,
          null,
          '',
          '',
          ''
        );
      }).toThrow('ValidatedElection title is required');
    });
    
    test('should reject whitespace-only title', () => {
      expect(() => {
        new ValidatedElection(
          '   ',
          null,
          null,
          '',
          '',
          ''
        );
      }).toThrow('ValidatedElection title is required');
    });
    
    test('should reject invalid Date object for start', () => {
      expect(() => {
        new ValidatedElection(
          'Test Election',
          new Date('invalid'),
          null,
          '',
          '',
          ''
        );
      }).toThrow('ValidatedElection start date must be valid Date');
    });
    
    test('should reject invalid Date object for end', () => {
      expect(() => {
        new ValidatedElection(
          'Test Election',
          null,
          new Date('invalid'),
          '',
          '',
          ''
        );
      }).toThrow('ValidatedElection end date must be valid Date');
    });
    
    test('should reject unparseable string for start', () => {
      expect(() => {
        new ValidatedElection(
          'Test Election',
          'not-a-date',
          null,
          '',
          '',
          ''
        );
      }).toThrow('ValidatedElection start date must be parseable');
    });
    
    test('should reject unparseable string for end', () => {
      expect(() => {
        new ValidatedElection(
          'Test Election',
          null,
          'not-a-date',
          '',
          '',
          ''
        );
      }).toThrow('ValidatedElection end date must be parseable');
    });
    
    test('should reject end date before start date', () => {
      expect(() => {
        new ValidatedElection(
          'Test Election',
          new Date('2026-01-31'),
          new Date('2026-01-01'),
          '',
          '',
          ''
        );
      }).toThrow('ValidatedElection end date must be >= start date');
    });
    
    test('should accept end date equal to start date', () => {
      const date = new Date('2026-01-15');
      
      const election = new ValidatedElection(
        'Single Day Election',
        date,
        date,
        '',
        '',
        ''
      );
      
      expect(election.Start).toBe(date);
      expect(election.End).toBe(date);
    });
    
    test('should reject non-string, non-Date for start', () => {
      expect(() => {
        new ValidatedElection(
          'Test Election',
          12345,
          null,
          '',
          '',
          ''
        );
      }).toThrow('ValidatedElection start date must be Date or string');
    });
    
    test('should reject non-string, non-Date for end', () => {
      expect(() => {
        new ValidatedElection(
          'Test Election',
          null,
          12345,
          '',
          '',
          ''
        );
      }).toThrow('ValidatedElection end date must be Date or string');
    });
    
  });
  
  // ========================================================================
  // 2. fromRow() Static Factory
  // ========================================================================
  
  describe('fromRow() Static Factory', () => {
    
    test('should create election from valid row data', () => {
      const headers = ['Title', 'Start', 'End', 'Form Edit URL', 'Election Officers', 'TriggerId'];
      const rowData = [
        'Board Election 2026',
        new Date('2026-01-01'),
        new Date('2026-01-31'),
        'https://docs.google.com/forms/d/1234/edit',
        'officer1@sc3.club',
        'trigger123'
      ];
      
      const election = ValidatedElection.fromRow(rowData, headers, 2);
      
      expect(election).not.toBeNull();
      expect(election.Title).toBe('Board Election 2026');
      expect(election.Start).toEqual(new Date('2026-01-01'));
      expect(election.End).toEqual(new Date('2026-01-31'));
      expect(election['Form Edit URL']).toBe('https://docs.google.com/forms/d/1234/edit');
      expect(election['Election Officers']).toBe('officer1@sc3.club');
      expect(election.TriggerId).toBe('trigger123');
    });
    
    test('should return null for invalid row data (missing title)', () => {
      const headers = ['Title', 'Start', 'End', 'Form Edit URL', 'Election Officers', 'TriggerId'];
      const rowData = ['', null, null, '', '', ''];
      
      const election = ValidatedElection.fromRow(rowData, headers, 2);
      
      expect(election).toBeNull();
    });
    
    test('should return null for invalid row data (end before start)', () => {
      const headers = ['Title', 'Start', 'End', 'Form Edit URL', 'Election Officers', 'TriggerId'];
      const rowData = [
        'Invalid Election',
        new Date('2026-01-31'),
        new Date('2026-01-01'),
        '',
        '',
        ''
      ];
      
      const election = ValidatedElection.fromRow(rowData, headers, 2);
      
      expect(election).toBeNull();
    });
    
    test('should collect errors when errorCollector is provided', () => {
      const headers = ['Title', 'Start', 'End', 'Form Edit URL', 'Election Officers', 'TriggerId'];
      const rowData = ['', null, null, '', '', ''];
      const errorCollector = { errors: [], rowNumbers: [] };
      
      const election = ValidatedElection.fromRow(rowData, headers, 2, errorCollector);
      
      expect(election).toBeNull();
      expect(errorCollector.errors.length).toBe(1);
      expect(errorCollector.errors[0]).toContain('Row 2');
      expect(errorCollector.errors[0]).toContain('title is required');
      expect(errorCollector.rowNumbers).toEqual([2]);
    });
    
  });
  
  // ========================================================================
  // 3. validateRows() Batch Validation
  // ========================================================================
  
  describe('validateRows() Batch Validation', () => {
    
    test('should validate all valid rows', () => {
      const headers = ['Title', 'Start', 'End', 'Form Edit URL', 'Election Officers', 'TriggerId'];
      const rows = [
        ['Election 1', new Date('2026-01-01'), new Date('2026-01-31'), '', '', ''],
        ['Election 2', new Date('2026-02-01'), new Date('2026-02-28'), '', '', ''],
        ['Election 3', null, null, '', '', '']
      ];
      
      const elections = ValidatedElection.validateRows(rows, headers, 'test context');
      
      expect(elections.length).toBe(3);
      expect(elections[0].Title).toBe('Election 1');
      expect(elections[1].Title).toBe('Election 2');
      expect(elections[2].Title).toBe('Election 3');
    });
    
    test('should filter out invalid rows and continue processing', () => {
      const headers = ['Title', 'Start', 'End', 'Form Edit URL', 'Election Officers', 'TriggerId'];
      const rows = [
        ['Valid Election 1', null, null, '', '', ''],
        ['', null, null, '', '', ''], // Invalid: missing title
        ['Valid Election 2', null, null, '', '', ''],
        ['Invalid Dates', new Date('2026-01-31'), new Date('2026-01-01'), '', '', ''], // Invalid: end < start
        ['Valid Election 3', null, null, '', '', '']
      ];
      
      const elections = ValidatedElection.validateRows(rows, headers, 'test context');
      
      expect(elections.length).toBe(3);
      expect(elections[0].Title).toBe('Valid Election 1');
      expect(elections[1].Title).toBe('Valid Election 2');
      expect(elections[2].Title).toBe('Valid Election 3');
    });
    
    test('should handle empty rows array', () => {
      const headers = ['Title', 'Start', 'End', 'Form Edit URL', 'Election Officers', 'TriggerId'];
      const rows = [];
      
      const elections = ValidatedElection.validateRows(rows, headers, 'test context');
      
      expect(elections.length).toBe(0);
    });
    
    test('should process all rows and send email on errors', () => {
      // Mock MailApp
      const mockSendEmail = jest.fn();
      global.MailApp = /** @type {any} */ ({ sendEmail: mockSendEmail });
      
      const headers = ['Title', 'Start', 'End', 'Form Edit URL', 'Election Officers', 'TriggerId'];
      const rows = [
        ['Valid Election', null, null, '', '', ''],
        ['', null, null, '', '', ''], // Invalid
        ['Another Invalid', new Date('2026-01-31'), new Date('2026-01-01'), '', '', ''] // Invalid
      ];
      
      const elections = ValidatedElection.validateRows(rows, headers, 'test context');
      
      expect(elections.length).toBe(1);
      expect(mockSendEmail).toHaveBeenCalledTimes(1);
      expect(mockSendEmail).toHaveBeenCalledWith({
        to: 'membership-automation@sc3.club',
        subject: 'ALERT: 2 Election Validation Errors',
        body: expect.stringContaining('test context')
      });
    });
    
  });
  
  // ========================================================================
  // 4. toArray() Serialization
  // ========================================================================
  
  describe('toArray() Serialization', () => {
    
    test('should convert election to array matching HEADERS order', () => {
      const start = new Date('2026-01-01');
      const end = new Date('2026-01-31');
      
      const election = new ValidatedElection(
        'Board Election',
        start,
        end,
        'https://docs.google.com/forms/d/1234/edit',
        'officer@sc3.club',
        'trigger123'
      );
      
      const arr = election.toArray();
      
      expect(arr).toEqual([
        'Board Election',
        start,
        end,
        'https://docs.google.com/forms/d/1234/edit',
        'officer@sc3.club',
        'trigger123'
      ]);
    });
    
    test('should convert election with null dates to array', () => {
      const election = new ValidatedElection(
        'Simple Election',
        null,
        null,
        '',
        '',
        ''
      );
      
      const arr = election.toArray();
      
      expect(arr).toEqual([
        'Simple Election',
        null,
        null,
        '',
        '',
        ''
      ]);
    });
    
    test('should round-trip through fromRow and toArray', () => {
      const headers = ValidatedElection.HEADERS;
      const originalData = [
        'Test Election',
        new Date('2026-01-01'),
        new Date('2026-01-31'),
        'https://forms.google.com/edit',
        'officer1@sc3.club,officer2@sc3.club',
        'trigger456'
      ];
      
      const election = ValidatedElection.fromRow(originalData, headers, 2);
      const reconstructed = election.toArray();
      
      expect(reconstructed).toEqual(originalData);
    });
    
  });
  
  // ========================================================================
  // 5. Column-Order Independence (MANDATORY per issue comments)
  // ========================================================================
  
  describe('Column-Order Independence', () => {
    
    test('should work correctly when sheet columns are in different order than HEADERS', () => {
      // Arrange: Headers in a DIFFERENT order than ValidatedElection.HEADERS
      const shuffledHeaders = [...ValidatedElection.HEADERS].reverse();
      const testObj = {
        Title: 'Board Election',
        Start: new Date('2026-01-01'),
        End: new Date('2026-01-31'),
        'Form Edit URL': 'https://forms.google.com/edit',
        'Election Officers': 'officer@sc3.club',
        TriggerId: 'trigger789'
      };
      const rowData = shuffledHeaders.map(h => testObj[h]);
      
      // Act
      const instance = ValidatedElection.fromRow(rowData, shuffledHeaders, 2);
      
      // Assert
      expect(instance).not.toBeNull();
      expect(instance.Title).toBe('Board Election');
      expect(instance.Start).toEqual(new Date('2026-01-01'));
      expect(instance.End).toEqual(new Date('2026-01-31'));
      expect(instance['Form Edit URL']).toBe('https://forms.google.com/edit');
      expect(instance['Election Officers']).toBe('officer@sc3.club');
      expect(instance.TriggerId).toBe('trigger789');
    });
    
    test('should work with arbitrary column order', () => {
      // Random order
      const randomHeaders = [
        'Election Officers',
        'Title',
        'TriggerId',
        'End',
        'Form Edit URL',
        'Start'
      ];
      const testObj = {
        Title: 'Random Order Election',
        Start: new Date('2026-03-01'),
        End: new Date('2026-03-15'),
        'Form Edit URL': 'https://forms.google.com/123',
        'Election Officers': 'admin@sc3.club',
        TriggerId: 'random123'
      };
      const rowData = randomHeaders.map(h => testObj[h]);
      
      const instance = ValidatedElection.fromRow(rowData, randomHeaders, 5);
      
      expect(instance).not.toBeNull();
      expect(instance.Title).toBe('Random Order Election');
      expect(instance.Start).toEqual(new Date('2026-03-01'));
      expect(instance.End).toEqual(new Date('2026-03-15'));
      expect(instance['Form Edit URL']).toBe('https://forms.google.com/123');
      expect(instance['Election Officers']).toBe('admin@sc3.club');
      expect(instance.TriggerId).toBe('random123');
    });
    
    test('should work with partial columns (missing optional fields)', () => {
      // Only some columns present
      const partialHeaders = ['Title', 'Start'];
      const rowData = ['Partial Election', new Date('2026-04-01')];
      
      const instance = ValidatedElection.fromRow(rowData, partialHeaders, 3);
      
      expect(instance).not.toBeNull();
      expect(instance.Title).toBe('Partial Election');
      expect(instance.Start).toEqual(new Date('2026-04-01'));
      expect(instance.End).toBe(null);
      expect(instance['Form Edit URL']).toBe('');
      expect(instance['Election Officers']).toBe('');
      expect(instance.TriggerId).toBe('');
    });
    
  });
  
  // ========================================================================
  // HEADERS constant
  // ========================================================================
  
  describe('HEADERS constant', () => {
    
    test('should have correct column names', () => {
      expect(ValidatedElection.HEADERS).toEqual([
        'Title',
        'Start',
        'End',
        'Form Edit URL',
        'Election Officers',
        'TriggerId'
      ]);
    });
    
    test('should have 6 columns', () => {
      expect(ValidatedElection.HEADERS.length).toBe(6);
    });
    
  });
  
});
