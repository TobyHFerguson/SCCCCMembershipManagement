/**
 * @fileoverview Tests for DataAccess module focusing on member data accessors
 *
 * Table of Contents:
 * 1. getActiveMembersForUpdate() — Write-context accessor for selective cell writes
 * 2. getMembers() — Read-only accessor (delegates to getActiveMembersForUpdate)
 * 3. getEmailAddresses() — Email list accessor (delegates to getMembers)
 */

// Mock GAS environment
jest.mock('../src/common/config/Properties.js', () => ({}));
jest.mock('../src/common/utils/Logger.js', () => ({}));

// Load ValidatedMember class and assign to global
const { ValidatedMember } = require('../src/common/data/ValidatedMember.js');
global.ValidatedMember = ValidatedMember;

// Mock AppLogger (flat class pattern)
global.AppLogger = {
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  debug: jest.fn()
};

// Mock Logger (GAS built-in)
global.Logger = {
  log: jest.fn(),
  clear: jest.fn(),
  getLog: jest.fn(() => '')
};

// Mock MailApp
global.MailApp = {
  sendEmail: jest.fn()
};

// Mock DocsService
global.DocsService = {
  convertDocToHtml: jest.fn((url) => `<html>Mock doc content for ${url}</html>`)
};

// Mock MemberPersistence
global.MemberPersistence = {
  valuesEqual: jest.fn((a, b) => a === b),
  writeChangedCells: jest.fn()
};

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

global.SpreadsheetManager = mockSpreadsheetManager;

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
