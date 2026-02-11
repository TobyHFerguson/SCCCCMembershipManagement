/**
 * @fileoverview Tests for DataAccess.getTransactions() and getTransactionsForUpdate()
 *
 * Table of Contents:
 * 1. getTransactions() — Read-only accessor returning ValidatedTransaction[]
 * 2. getTransactionsForUpdate() — Write-context accessor for selective cell writes
 *
 * Tests follow TDD: written BEFORE the DataAccess implementation.
 */

// Mock GAS environment
jest.mock('../src/common/config/Properties.js', () => ({}));
jest.mock('../src/common/utils/Logger.js', () => ({}));

// Load ValidatedTransaction class and assign to global
const { ValidatedTransaction } = require('../src/common/data/ValidatedTransaction.js');
global.ValidatedTransaction = ValidatedTransaction;

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
global.SpreadsheetManager = /** @type {any} */ ({
  getSheet: jest.fn()
});

// Load SheetAccess and assign to global
const { SheetAccess } = require('../src/common/data/SheetAccess.js');
global.SheetAccess = SheetAccess;

// Load DataAccess and assign to global (mirrors GAS global `var DataAccess`)
const { DataAccess } = require('../src/common/data/data_access.js');
global.DataAccess = DataAccess;

// Sample transaction data matching ValidatedTransaction.HEADERS
const SAMPLE_HEADERS = ValidatedTransaction.HEADERS;

const makeSampleRow = (overrides = {}) => {
  const defaults = {
    'Timestamp': new Date('2024-01-15T10:00:00Z'),
    'Email Address': 'test@example.com',
    'Are you 18 years of age or older?': 'Yes',
    'Privacy': 'Agree',
    'Membership Agreement': 'Agree',
    'Directory': 'Share Name, Share Email',
    'First Name': 'John',
    'Last Name': 'Doe',
    'Phone': '(555) 123-4567',
    'Payment': '1 year membership',
    'Payable Order ID': 'ORD-001',
    'Payable Total': '$50.00',
    'Payable Status': 'Paid',
    'Payable Payment Method': 'Credit Card',
    'Payable Transaction ID': 'TXN-001',
    'Payable Last Updated': '2024-01-15',
    'Processed': null
  };
  const merged = { ...defaults, ...overrides };
  return SAMPLE_HEADERS.map(h => merged[h]);
};


describe('DataAccess.getTransactions', () => {

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should return ValidatedTransaction[] for valid rows', () => {
    const sheetValues = [
      SAMPLE_HEADERS,
      makeSampleRow({ 'Email Address': 'alice@example.com', 'First Name': 'Alice', 'Last Name': 'Smith' }),
      makeSampleRow({ 'Email Address': 'bob@example.com', 'First Name': 'Bob', 'Last Name': 'Jones' })
    ];

    const { sheet } = createMockSheet(sheetValues);
    (/** @type {any} */ (global.SpreadsheetManager.getSheet)).mockReturnValue(sheet);

    const transactions = global.DataAccess.getTransactions();

    expect(Array.isArray(transactions)).toBe(true);
    expect(transactions.length).toBe(2);
    expect(transactions[0]).toBeInstanceOf(ValidatedTransaction);
    expect(transactions[0]['Email Address']).toBe('alice@example.com');
    expect(transactions[1]['Email Address']).toBe('bob@example.com');
  });

  test('should return empty array when no data rows exist', () => {
    const sheetValues = [
      SAMPLE_HEADERS
      // No data rows
    ];

    const { sheet } = createMockSheet(sheetValues);
    (/** @type {any} */ (global.SpreadsheetManager.getSheet)).mockReturnValue(sheet);

    const transactions = global.DataAccess.getTransactions();

    expect(Array.isArray(transactions)).toBe(true);
    expect(transactions.length).toBe(0);
  });

  test('should return empty array when sheet is completely empty', () => {
    // SheetAccess.getDataAsArrays returns empty array for empty sheet
    const { sheet } = createMockSheet([[]]);
    (/** @type {any} */ (global.SpreadsheetManager.getSheet)).mockReturnValue(sheet);

    const transactions = global.DataAccess.getTransactions();

    expect(Array.isArray(transactions)).toBe(true);
    expect(transactions.length).toBe(0);
  });

  test('should skip invalid rows and return only valid transactions', () => {
    const sheetValues = [
      SAMPLE_HEADERS,
      makeSampleRow({ 'Email Address': 'valid@example.com' }),
      makeSampleRow({ 'Email Address': '' }), // Invalid: empty email
      makeSampleRow({ 'Email Address': 'another@example.com', 'First Name': 'Jane', 'Last Name': 'Doe' })
    ];

    const { sheet } = createMockSheet(sheetValues);
    (/** @type {any} */ (global.SpreadsheetManager.getSheet)).mockReturnValue(sheet);

    const transactions = global.DataAccess.getTransactions();

    // Should have 2 valid, 1 skipped
    expect(transactions.length).toBe(2);
    expect(transactions[0]['Email Address']).toBe('valid@example.com');
    expect(transactions[1]['Email Address']).toBe('another@example.com');
  });

  test('should call SheetAccess.getDataAsArrays with Transactions', () => {
    const sheetValues = [
      SAMPLE_HEADERS,
      makeSampleRow()
    ];

    const { sheet } = createMockSheet(sheetValues);
    (/** @type {any} */ (global.SpreadsheetManager.getSheet)).mockReturnValue(sheet);

    // Spy on SheetAccess.getDataAsArrays
    const spy = jest.spyOn(SheetAccess, 'getDataAsArrays');

    global.DataAccess.getTransactions();

    expect(spy).toHaveBeenCalledWith('Transactions');
    spy.mockRestore();
  });

});


describe('DataAccess.getTransactionsForUpdate', () => {

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should return transactions, headers, and sheet for write-context', () => {
    const sheetValues = [
      SAMPLE_HEADERS,
      makeSampleRow({ 'Email Address': 'test@example.com' })
    ];

    const { sheet } = createMockSheet(sheetValues);
    (/** @type {any} */ (global.SpreadsheetManager.getSheet)).mockReturnValue(sheet);

    const result = global.DataAccess.getTransactionsForUpdate();

    expect(result).toHaveProperty('transactions');
    expect(result).toHaveProperty('headers');
    expect(result).toHaveProperty('sheet');

    // transactions should be ValidatedTransaction[]
    expect(Array.isArray(result.transactions)).toBe(true);
    expect(result.transactions.length).toBe(1);
    expect(result.transactions[0]).toBeInstanceOf(ValidatedTransaction);

    // headers should be the actual sheet headers array
    expect(result.headers).toEqual(SAMPLE_HEADERS);

    // sheet should be the actual Sheet object
    expect(result.sheet).toBe(sheet);
  });

  test('should return empty transactions when no data rows exist', () => {
    const sheetValues = [
      SAMPLE_HEADERS
    ];

    const { sheet } = createMockSheet(sheetValues);
    (/** @type {any} */ (global.SpreadsheetManager.getSheet)).mockReturnValue(sheet);

    const result = global.DataAccess.getTransactionsForUpdate();

    expect(result.transactions.length).toBe(0);
    expect(result.headers).toEqual(SAMPLE_HEADERS);
    expect(result.sheet).toBe(sheet);
  });

  test('should return empty result when sheet has no data', () => {
    const { sheet } = createMockSheet([[]]);
    (/** @type {any} */ (global.SpreadsheetManager.getSheet)).mockReturnValue(sheet);

    const result = global.DataAccess.getTransactionsForUpdate();

    expect(result.transactions.length).toBe(0);
    expect(result.headers).toEqual([]);
    expect(result.sheet).toBe(sheet);
  });

  test('transactions should have _sheetRowIndex metadata for write-back', () => {
    const sheetValues = [
      SAMPLE_HEADERS,
      makeSampleRow({ 'Email Address': 'first@example.com' }),
      makeSampleRow({ 'Email Address': 'second@example.com', 'First Name': 'Jane', 'Last Name': 'Smith' })
    ];

    const { sheet } = createMockSheet(sheetValues);
    (/** @type {any} */ (global.SpreadsheetManager.getSheet)).mockReturnValue(sheet);

    const result = global.DataAccess.getTransactionsForUpdate();

    // ValidatedTransaction.fromRow sets _sheetRowIndex to the rowNumber param
    // which is i + 2 (1 for header, 1 for 1-based indexing)
    expect(result.transactions[0]._sheetRowIndex).toBe(2);
    expect(result.transactions[1]._sheetRowIndex).toBe(3);
  });

  test('transactions should have _originalValues metadata for change detection', () => {
    const sheetValues = [
      SAMPLE_HEADERS,
      makeSampleRow({ 'Email Address': 'test@example.com' })
    ];

    const { sheet } = createMockSheet(sheetValues);
    (/** @type {any} */ (global.SpreadsheetManager.getSheet)).mockReturnValue(sheet);

    const result = global.DataAccess.getTransactionsForUpdate();

    expect(result.transactions[0]._originalValues).toBeDefined();
    expect(result.transactions[0]._originalValues['Email Address']).toBe('test@example.com');
  });

  test('should work with ValidatedTransaction.writeChangedCells for selective writes', () => {
    const sheetValues = [
      SAMPLE_HEADERS,
      makeSampleRow({ 'Email Address': 'test@example.com' })
    ];

    const { sheet, mockRange } = createMockSheet(sheetValues);
    (/** @type {any} */ (global.SpreadsheetManager.getSheet)).mockReturnValue(sheet);

    const result = global.DataAccess.getTransactionsForUpdate();

    // Simulate processing: mark transaction as processed
    result.transactions[0].Processed = new Date('2024-02-01');

    // Write back changed cells
    const changeCount = ValidatedTransaction.writeChangedCells(
      result.sheet,
      result.transactions,
      result.headers
    );

    // Should have written exactly 1 cell (Processed)
    expect(changeCount).toBe(1);
  });

});
