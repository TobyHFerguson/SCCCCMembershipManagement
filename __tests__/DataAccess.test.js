/**
 * @fileoverview Tests for DataAccess module focusing on member data accessors
 *
 * Table of Contents:
 * 1. getActiveMembersForUpdate() — Write-context accessor for selective cell writes
 * 2. getMembers() — Read-only accessor (delegates to getActiveMembersForUpdate)
 * 3. getEmailAddresses() — Email list accessor (delegates to getMembers)
 * 4. updateMember() — Header-based selective cell updates (plain objects + instances)
 */

// Mock GAS environment
jest.mock('../src/common/config/Properties.js', () => ({}));
jest.mock('../src/common/utils/Logger.js', () => ({}));

// Load ValidatedMember class and assign to global
const { ValidatedMember } = require('../src/common/data/ValidatedMember.js');
global.ValidatedMember = ValidatedMember;

// Mock AppLogger (flat class pattern)
global.AppLogger = /** @type {any} */ ({
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  debug: jest.fn()
});

// Mock Logger (GAS built-in)
global.Logger = /** @type {any} */ ({
  log: jest.fn(),
  clear: jest.fn(),
  getLog: jest.fn(() => '')
});

// Mock MailApp
global.MailApp = /** @type {any} */ ({
  sendEmail: jest.fn()
});

// Mock DocsService
global.DocsService = /** @type {any} */ ({
  convertDocToHtml: jest.fn((url) => `<html>Mock doc content for ${url}</html>`)
});

// Mock MemberPersistence
global.MemberPersistence = /** @type {any} */ ({
  valuesEqual: jest.fn((a, b) => a === b),
  writeChangedCells: jest.fn(),
  writeSingleMemberChanges: jest.fn().mockReturnValue(0)
});

// Backward compat alias
global.Common = global.Common || {};
global.Common.Logger = global.AppLogger;

// Create mock sheet factory
const createMockSheet = (values = [[]]) => {
  const mockRange = {
    getValues: jest.fn(() => values),
    setValue: jest.fn()
  };

  const sheet = {
    getDataRange: jest.fn(() => mockRange),
    getRange: jest.fn(() => mockRange),
    getLastRow: jest.fn(() => values.length),
    getLastColumn: jest.fn(() => values.length > 0 ? values[0].length : 0)
  };

  return { sheet, mockRange };
};

// Mock SpreadsheetManager (used by SheetAccess)
const mockSpreadsheetManager = {
  getSheet: jest.fn()
};

global.SpreadsheetManager = /** @type {any} */ (mockSpreadsheetManager);

// Load modules after global setup
const { SheetAccess } = require('../src/common/data/SheetAccess.js');
global.SheetAccess = SheetAccess;

const { DataAccess } = require('../src/common/data/data_access.js');
global.DataAccess = DataAccess;

describe('DataAccess.getActiveMembersForUpdate', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return {members, sheet, originalRows, headers}', () => {
    const headers = ['Status', 'Email', 'First', 'Last', 'Phone', 'Joined', 'Expires', 'Period', 'Migrated', 'Directory Share Name', 'Directory Share Email', 'Directory Share Phone', 'Renewed On'];
    const row1 = ['Active', 'test@example.com', 'John', 'Doe', '555-1234', new Date('2024-01-01'), new Date('2025-01-01'), 12, '', 'Yes', 'Yes', 'Yes', ''];
    const allData = [headers, row1];

    const { sheet } = createMockSheet(allData);
    mockSpreadsheetManager.getSheet.mockReturnValue(sheet);

    const result = DataAccess.getActiveMembersForUpdate();

    expect(result).toHaveProperty('members');
    expect(result).toHaveProperty('sheet');
    expect(result).toHaveProperty('originalRows');
    expect(result).toHaveProperty('headers');
    expect(Array.isArray(result.members)).toBe(true);
    expect(Array.isArray(result.originalRows)).toBe(true);
    expect(Array.isArray(result.headers)).toBe(true);
    expect(result.sheet).toBe(sheet);
  });

  it('should return ValidatedMember instances in members array', () => {
    const headers = ['Status', 'Email', 'First', 'Last', 'Phone', 'Joined', 'Expires', 'Period', 'Migrated', 'Directory Share Name', 'Directory Share Email', 'Directory Share Phone', 'Renewed On'];
    const row1 = ['Active', 'test@example.com', 'John', 'Doe', '555-1234', new Date('2024-01-01'), new Date('2025-01-01'), 12, '', 'Yes', 'Yes', 'Yes', ''];
    const allData = [headers, row1];

    const { sheet } = createMockSheet(allData);
    mockSpreadsheetManager.getSheet.mockReturnValue(sheet);

    const { members } = DataAccess.getActiveMembersForUpdate();

    expect(members.length).toBe(1);
    expect(members[0]).toBeInstanceOf(ValidatedMember);
    expect(members[0].Email).toBe('test@example.com');
    expect(members[0].First).toBe('John');
  });

  it('should return originalRows as raw arrays (not ValidatedMember)', () => {
    const headers = ['Status', 'Email', 'First', 'Last', 'Phone', 'Joined', 'Expires', 'Period', 'Migrated', 'Directory Share Name', 'Directory Share Email', 'Directory Share Phone', 'Renewed On'];
    const joined = new Date('2024-01-01');
    const expires = new Date('2025-01-01');
    const row1 = ['Active', 'test@example.com', 'John', 'Doe', '555-1234', joined, expires, 12, '', 'Yes', 'Yes', 'Yes', ''];
    const allData = [headers, row1];

    const { sheet } = createMockSheet(allData);
    mockSpreadsheetManager.getSheet.mockReturnValue(sheet);

    const { originalRows } = DataAccess.getActiveMembersForUpdate();

    expect(originalRows.length).toBe(1);
    expect(Array.isArray(originalRows[0])).toBe(true);
    expect(originalRows[0]).not.toBeInstanceOf(ValidatedMember);
    expect(originalRows[0]).toEqual(['Active', 'test@example.com', 'John', 'Doe', '555-1234', joined, expires, 12, '', 'Yes', 'Yes', 'Yes', '']);
  });

  it('should return headers as array of column names', () => {
    const headers = ['Status', 'Email', 'First', 'Last', 'Phone', 'Joined', 'Expires', 'Period', 'Migrated', 'Directory Share Name', 'Directory Share Email', 'Directory Share Phone', 'Renewed On'];
    const row1 = ['Active', 'test@example.com', 'John', 'Doe', '555-1234', new Date('2024-01-01'), new Date('2025-01-01'), 12, '', 'Yes', 'Yes', 'Yes', ''];
    const allData = [headers, row1];

    const { sheet } = createMockSheet(allData);
    mockSpreadsheetManager.getSheet.mockReturnValue(sheet);

    const result = DataAccess.getActiveMembersForUpdate();

    expect(result.headers).toEqual(headers);
  });

  it('should return empty members array for empty sheet (headers only)', () => {
    const headers = ['Status', 'Email', 'First', 'Last', 'Phone', 'Joined', 'Expires', 'Period', 'Migrated', 'Directory Share Name', 'Directory Share Email', 'Directory Share Phone', 'Renewed On'];
    const allData = [headers];

    const { sheet } = createMockSheet(allData);
    mockSpreadsheetManager.getSheet.mockReturnValue(sheet);

    const { members, originalRows } = DataAccess.getActiveMembersForUpdate();

    expect(members).toEqual([]);
    expect(originalRows).toEqual([]);
  });

  it('should call SheetAccess.getSheet with ActiveMembers', () => {
    const headers = ['Status', 'Email', 'First', 'Last', 'Phone', 'Joined', 'Expires', 'Period', 'Migrated', 'Directory Share Name', 'Directory Share Email', 'Directory Share Phone', 'Renewed On'];
    const allData = [headers];

    const { sheet } = createMockSheet(allData);
    mockSpreadsheetManager.getSheet.mockReturnValue(sheet);

    DataAccess.getActiveMembersForUpdate();

    expect(mockSpreadsheetManager.getSheet).toHaveBeenCalledWith('ActiveMembers');
  });

  it('should handle multiple members correctly', () => {
    const headers = ['Status', 'Email', 'First', 'Last', 'Phone', 'Joined', 'Expires', 'Period', 'Migrated', 'Directory Share Name', 'Directory Share Email', 'Directory Share Phone', 'Renewed On'];
    const row1 = ['Active', 'test1@example.com', 'John', 'Doe', '555-1234', new Date('2024-01-01'), new Date('2025-01-01'), 12, '', 'Yes', 'Yes', 'Yes', ''];
    const row2 = ['Active', 'test2@example.com', 'Jane', 'Smith', '555-5678', new Date('2024-01-01'), new Date('2025-01-01'), 6, '', 'Yes', 'Yes', 'Yes', ''];
    const allData = [headers, row1, row2];

    const { sheet } = createMockSheet(allData);
    mockSpreadsheetManager.getSheet.mockReturnValue(sheet);

    const { members, originalRows } = DataAccess.getActiveMembersForUpdate();

    expect(members.length).toBe(2);
    expect(originalRows.length).toBe(2);
    expect(members[0].Email).toBe('test1@example.com');
    expect(members[1].Email).toBe('test2@example.com');
  });
});

describe('DataAccess.getMembers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return ValidatedMember[] by delegating to getActiveMembersForUpdate', () => {
    const headers = ['Status', 'Email', 'First', 'Last', 'Phone', 'Joined', 'Expires', 'Period', 'Migrated', 'Directory Share Name', 'Directory Share Email', 'Directory Share Phone', 'Renewed On'];
    const row1 = ['Active', 'test@example.com', 'John', 'Doe', '555-1234', new Date('2024-01-01'), new Date('2025-01-01'), 12, '', 'Yes', 'Yes', 'Yes', ''];
    const allData = [headers, row1];

    const { sheet } = createMockSheet(allData);
    mockSpreadsheetManager.getSheet.mockReturnValue(sheet);

    const members = DataAccess.getMembers();

    expect(Array.isArray(members)).toBe(true);
    expect(members.length).toBe(1);
    expect(members[0]).toBeInstanceOf(ValidatedMember);
    expect(members[0].Email).toBe('test@example.com');
  });

  it('should return empty array for empty sheet', () => {
    const headers = ['Status', 'Email', 'First', 'Last', 'Phone', 'Joined', 'Expires', 'Period', 'Migrated', 'Directory Share Name', 'Directory Share Email', 'Directory Share Phone', 'Renewed On'];
    const allData = [headers];

    const { sheet } = createMockSheet(allData);
    mockSpreadsheetManager.getSheet.mockReturnValue(sheet);

    const members = DataAccess.getMembers();

    expect(members).toEqual([]);
  });
});

describe('DataAccess.getEmailAddresses', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return lowercase email strings by delegating to getMembers', () => {
    const headers = ['Status', 'Email', 'First', 'Last', 'Phone', 'Joined', 'Expires', 'Period', 'Migrated', 'Directory Share Name', 'Directory Share Email', 'Directory Share Phone', 'Renewed On'];
    const row1 = ['Active', 'Test@Example.com', 'John', 'Doe', '555-1234', new Date('2024-01-01'), new Date('2025-01-01'), 12, '', 'Yes', 'Yes', 'Yes', ''];
    const row2 = ['Active', 'JANE@EXAMPLE.COM', 'Jane', 'Smith', '555-5678', new Date('2024-01-01'), new Date('2025-01-01'), 6, '', 'Yes', 'Yes', 'Yes', ''];
    const allData = [headers, row1, row2];

    const { sheet } = createMockSheet(allData);
    mockSpreadsheetManager.getSheet.mockReturnValue(sheet);

    const emails = DataAccess.getEmailAddresses();

    expect(Array.isArray(emails)).toBe(true);
    expect(emails.length).toBe(2);
    expect(emails[0]).toBe('test@example.com');
    expect(emails[1]).toBe('jane@example.com');
  });

  it('should return empty array for empty sheet', () => {
    const headers = ['Status', 'Email', 'First', 'Last', 'Phone', 'Joined', 'Expires', 'Period', 'Migrated', 'Directory Share Name', 'Directory Share Email', 'Directory Share Phone', 'Renewed On'];
    const allData = [headers];

    const { sheet } = createMockSheet(allData);
    mockSpreadsheetManager.getSheet.mockReturnValue(sheet);

    const emails = DataAccess.getEmailAddresses();

    expect(emails).toEqual([]);
  });
});

// ==================== updateMember Tests ====================

describe('DataAccess.updateMember', () => {
  const headers = ['Email', 'Status', 'First', 'Last', 'Phone', 'Joined', 'Expires', 'Period', 'Migrated', 'Directory Share Name', 'Directory Share Email', 'Directory Share Phone', 'Renewed On'];
  
  const makeRow = (overrides = {}) => {
    const defaults = {
      Email: 'test@example.com', Status: 'Active', First: 'John', Last: 'Doe',
      Phone: '555-1234', Joined: new Date('2024-01-01'), Expires: new Date('2025-01-01'),
      Period: 1, Migrated: null, 'Directory Share Name': true,
      'Directory Share Email': false, 'Directory Share Phone': false, 'Renewed On': null
    };
    const merged = { ...defaults, ...overrides };
    return headers.map(h => merged[h]);
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should delegate to MemberPersistence.writeSingleMemberChanges with a plain object', () => {
    const originalRow = makeRow();
    const allData = [headers, originalRow];
    const { sheet } = createMockSheet(allData);
    mockSpreadsheetManager.getSheet.mockReturnValue(sheet);

    // Plain object (no toArray method) — the exact shape that mergeProfiles returns
    const plainObject = {
      Email: 'test@example.com', Status: 'Active', First: 'Jane', Last: 'Doe',
      Phone: '555-1234', Joined: new Date('2024-01-01'), Expires: new Date('2025-01-01'),
      Period: 1, Migrated: null, 'Directory Share Name': true,
      'Directory Share Email': true, 'Directory Share Phone': false, 'Renewed On': null
    };

    MemberPersistence.writeSingleMemberChanges.mockReturnValue(2);

    const result = DataAccess.updateMember('test@example.com', plainObject);

    expect(result).toBe(true);
    expect(MemberPersistence.writeSingleMemberChanges).toHaveBeenCalledWith(
      sheet, originalRow, plainObject, headers, 2 // sheetRow = rowIndex(0) + 2
    );
    expect(AppLogger.info).toHaveBeenCalledWith('data_access', expect.stringContaining('Updated 2 cells'));
  });

  it('should delegate to MemberPersistence.writeSingleMemberChanges with a ValidatedMember instance', () => {
    const originalRow = makeRow();
    const allData = [headers, originalRow];
    const { sheet } = createMockSheet(allData);
    mockSpreadsheetManager.getSheet.mockReturnValue(sheet);

    // ValidatedMember instance (has toArray method)
    const member = new ValidatedMember(
      'test@example.com', 'Active', 'Jane', 'Doe',
      '555-1234', new Date('2024-01-01'), new Date('2025-01-01'),
      1, null, true, true, false, null
    );

    MemberPersistence.writeSingleMemberChanges.mockReturnValue(3);

    const result = DataAccess.updateMember('test@example.com', member);

    expect(result).toBe(true);
    expect(MemberPersistence.writeSingleMemberChanges).toHaveBeenCalledWith(
      sheet, originalRow, member, headers, 2
    );
  });

  it('should return false when member is not found', () => {
    const allData = [headers, makeRow({ Email: 'other@example.com' })];
    const { sheet } = createMockSheet(allData);
    mockSpreadsheetManager.getSheet.mockReturnValue(sheet);

    const result = DataAccess.updateMember('notfound@example.com', { Email: 'notfound@example.com', First: 'X' });

    expect(result).toBe(false);
    expect(AppLogger.warn).toHaveBeenCalledWith('data_access', expect.stringContaining('not found'));
  });

  it('should handle case-insensitive email lookup', () => {
    const originalRow = makeRow({ Email: 'Test@Example.COM' });
    const allData = [headers, originalRow];
    const { sheet } = createMockSheet(allData);
    mockSpreadsheetManager.getSheet.mockReturnValue(sheet);

    MemberPersistence.writeSingleMemberChanges.mockReturnValue(0);

    const result = DataAccess.updateMember('test@example.com', { Email: 'test@example.com', First: 'John' });

    expect(result).toBe(true);
    expect(MemberPersistence.writeSingleMemberChanges).toHaveBeenCalled();
  });

  it('should report zero changes when MemberPersistence returns 0', () => {
    const originalRow = makeRow();
    const allData = [headers, originalRow];
    const { sheet } = createMockSheet(allData);
    mockSpreadsheetManager.getSheet.mockReturnValue(sheet);

    MemberPersistence.writeSingleMemberChanges.mockReturnValue(0);

    const plainObject = {
      Email: 'test@example.com', Status: 'Active', First: 'John', Last: 'Doe',
      Phone: '555-1234'
    };

    const result = DataAccess.updateMember('test@example.com', plainObject);

    expect(result).toBe(true);
    expect(AppLogger.info).toHaveBeenCalledWith('data_access', expect.stringContaining('Updated 0 cells'));
  });

  it('should pass correct row and headers to MemberPersistence regardless of column order', () => {
    // Reversed headers to prove delegation passes whatever the sheet provides
    const reversedHeaders = [...headers].reverse();
    const row = reversedHeaders.map(h => {
      const defaults = {
        Email: 'test@example.com', Status: 'Active', First: 'John', Last: 'Doe',
        Phone: '555-1234', Joined: new Date('2024-01-01'), Expires: new Date('2025-01-01'),
        Period: 1, Migrated: null, 'Directory Share Name': true,
        'Directory Share Email': false, 'Directory Share Phone': false, 'Renewed On': null
      };
      return defaults[h];
    });
    const allData = [reversedHeaders, row];
    const { sheet } = createMockSheet(allData);
    mockSpreadsheetManager.getSheet.mockReturnValue(sheet);

    MemberPersistence.writeSingleMemberChanges.mockReturnValue(1);

    const plainObject = { Email: 'test@example.com', First: 'Jane' };

    const result = DataAccess.updateMember('test@example.com', plainObject);

    expect(result).toBe(true);
    // Should pass the reversed headers and row to MemberPersistence
    expect(MemberPersistence.writeSingleMemberChanges).toHaveBeenCalledWith(
      sheet, row, plainObject, reversedHeaders, 2
    );
  });
});
