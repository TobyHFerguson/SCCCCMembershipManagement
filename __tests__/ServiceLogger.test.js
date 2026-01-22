/// <reference path="../jest-globals.d.ts" />
// @ts-check

/**
 * Tests for Common.Logging.ServiceLogger
 * 
 * Tests the unified service execution logging utility that provides:
 * 1. Business audit logging (Audit sheet)
 * 2. Technical system logging (System Logs sheet)
 */

// Mock Common.Logger before importing ServiceLogger
const mockCommonLogger = {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
};

// Set up global Common namespace
global.Common = {
    Logger: mockCommonLogger,
    Logging: {}
};

// Mock AuditLogger (flat class, no namespace)
global.AuditLogger = class {
    constructor(timestamp) {
        this._timestamp = timestamp || new Date();
    }
    
    createLogEntry(params) {
        return {
            Timestamp: new Date(this._timestamp),
            Type: params.type,
            Outcome: params.outcome,
            Note: params.note || '',
            Error: params.error || '',
            JSON: params.jsonData ? JSON.stringify(params.jsonData, null, 2) : ''
        };
    }
};

// Import ServiceLogger
require('../src/common/logging/ServiceLogger.js');

describe('Common.Logging.ServiceLogger', () => {
    let logger;
    const testServiceName = 'TestService';
    const testUserEmail = 'user@example.com';
    const testTimestamp = new Date('2024-01-15T10:30:00Z');

    beforeEach(() => {
        // Reset all mocks
        mockCommonLogger.info.mockClear();
        mockCommonLogger.error.mockClear();
        mockCommonLogger.warn.mockClear();
        mockCommonLogger.debug.mockClear();
        
        // Create fresh logger instance
        logger = new global.Common.Logging.ServiceLogger(testServiceName, testUserEmail, testTimestamp);
    });

    describe('constructor', () => {
        test('should initialize with provided parameters', () => {
            expect(logger.serviceName).toBe(testServiceName);
            expect(logger.userEmail).toBe(testUserEmail);
            expect(logger.timestamp).toEqual(testTimestamp);
            expect(logger.auditLogger).toBeDefined();
        });

        test('should use current date if timestamp not provided', () => {
            const loggerWithoutTimestamp = new global.Common.Logging.ServiceLogger(
                testServiceName,
                testUserEmail
            );
            expect(loggerWithoutTimestamp.timestamp).toBeInstanceOf(Date);
        });
    });

    describe('logServiceAccess', () => {
        test('should log service access to both system and audit logs', () => {
            const operation = 'getData';
            const auditEntry = logger.logServiceAccess(operation);

            // Verify system log was called
            expect(mockCommonLogger.info).toHaveBeenCalledWith(
                testServiceName,
                `User ${testUserEmail} accessed service via ${operation}()`
            );

            // Verify audit entry structure
            expect(auditEntry).toBeDefined();
            expect(auditEntry.Type).toBe(`${testServiceName}.Access`);
            expect(auditEntry.Outcome).toBe('success');
            expect(auditEntry.Note).toContain(testUserEmail);
            expect(auditEntry.Note).toContain(testServiceName);
            expect(auditEntry.Timestamp).toEqual(testTimestamp);
        });

        test('should create unique access entries for different operations', () => {
            const entry1 = logger.logServiceAccess('getData');
            const entry2 = logger.logServiceAccess('getProfile');

            expect(entry1.Note).toContain('getData()');
            expect(entry2.Note).toContain('getProfile()');
        });
    });

    describe('logOperation', () => {
        test('should log successful operation with INFO level', () => {
            const operationType = 'ProfileUpdate';
            const note = 'Updated phone number';
            const jsonData = { field: 'phone', oldValue: '123', newValue: '456' };

            const auditEntry = logger.logOperation(operationType, 'success', note, undefined, jsonData);

            // Verify system log
            expect(mockCommonLogger.info).toHaveBeenCalledWith(
                testServiceName,
                `${operationType}: ${note}`,
                jsonData
            );

            // Verify audit entry
            expect(auditEntry.Type).toBe(`${testServiceName}.${operationType}`);
            expect(auditEntry.Outcome).toBe('success');
            expect(auditEntry.Note).toBe(note);
            expect(auditEntry.Error).toBe('');
            expect(auditEntry.JSON).toBe(JSON.stringify(jsonData, null, 2));
        });

        test('should log failed operation with ERROR level', () => {
            const operationType = 'SubscriptionChange';
            const note = 'Failed to update subscriptions';
            const error = 'API rate limit exceeded';
            const jsonData = { attemptCount: 3 };

            const auditEntry = logger.logOperation(operationType, 'fail', note, error, jsonData);

            // Verify system log
            expect(mockCommonLogger.error).toHaveBeenCalledWith(
                testServiceName,
                `${operationType} FAILED: ${error}`,
                jsonData
            );

            // Verify audit entry
            expect(auditEntry.Type).toBe(`${testServiceName}.${operationType}`);
            expect(auditEntry.Outcome).toBe('fail');
            expect(auditEntry.Note).toBe(note);
            expect(auditEntry.Error).toBe(error);
        });

        test('should handle operation without jsonData', () => {
            const auditEntry = logger.logOperation('SimpleOp', 'success', 'Completed');

            expect(auditEntry.JSON).toBe('');
            expect(mockCommonLogger.info).toHaveBeenCalledWith(
                testServiceName,
                'SimpleOp: Completed',
                undefined
            );
        });
    });

    describe('logError', () => {
        test('should log Error object with full details', () => {
            const operation = 'fetchData';
            const error = new Error('Network timeout');
            error.name = 'TimeoutError';

            const auditEntry = logger.logError(operation, error);

            // Verify system log
            expect(mockCommonLogger.error).toHaveBeenCalledWith(
                testServiceName,
                `Error in ${operation}: Network timeout`,
                expect.objectContaining({
                    name: 'TimeoutError',
                    message: 'Network timeout',
                    stack: expect.any(String)
                })
            );

            // Verify audit entry
            expect(auditEntry.Type).toBe(`${testServiceName}.Error`);
            expect(auditEntry.Outcome).toBe('fail');
            expect(auditEntry.Note).toContain(testUserEmail);
            expect(auditEntry.Note).toContain(operation);
            expect(auditEntry.Error).toBe('Network timeout');
            
            const jsonData = JSON.parse(auditEntry.JSON);
            expect(jsonData.name).toBe('TimeoutError');
            expect(jsonData.message).toBe('Network timeout');
        });

        test('should log string error', () => {
            const operation = 'validateInput';
            const error = 'Invalid email format';

            const auditEntry = logger.logError(operation, error);

            // Verify system log
            expect(mockCommonLogger.error).toHaveBeenCalledWith(
                testServiceName,
                `Error in ${operation}: ${error}`,
                expect.objectContaining({
                    error: error
                })
            );

            // Verify audit entry
            expect(auditEntry.Error).toBe(error);
        });

        test('should merge additional data with error data', () => {
            const error = new Error('Database error');
            const additionalData = { query: 'SELECT * FROM users', rowCount: 0 };

            const auditEntry = logger.logError('dbQuery', error, additionalData);

            const jsonData = JSON.parse(auditEntry.JSON);
            expect(jsonData.message).toBe('Database error');
            expect(jsonData.query).toBe('SELECT * FROM users');
            expect(jsonData.rowCount).toBe(0);
        });
    });

    describe('createAuditEntry', () => {
        test('should create custom audit entry without system logging', () => {
            const type = 'CustomEvent';
            const outcome = 'success';
            const note = 'Custom note';
            const error = '';
            const jsonData = { custom: 'data' };

            mockCommonLogger.info.mockClear(); // Clear any previous calls

            const auditEntry = logger.createAuditEntry(type, outcome, note, error, jsonData);

            // Verify NO system log was called
            expect(mockCommonLogger.info).not.toHaveBeenCalled();
            expect(mockCommonLogger.error).not.toHaveBeenCalled();

            // Verify audit entry was created
            expect(auditEntry.Type).toBe(type);
            expect(auditEntry.Outcome).toBe(outcome);
            expect(auditEntry.Note).toBe(note);
            expect(auditEntry.Error).toBe(error);
            expect(auditEntry.JSON).toBe(JSON.stringify(jsonData, null, 2));
        });

        test('should handle optional parameters', () => {
            const auditEntry = logger.createAuditEntry('MinimalEvent', 'success', 'Just a note');

            expect(auditEntry.Type).toBe('MinimalEvent');
            expect(auditEntry.Error).toBe('');
            expect(auditEntry.JSON).toBe('');
        });
    });

    describe('integration scenarios', () => {
        test('should support multiple log calls for same service execution', () => {
            // Simulate a service execution with multiple log points
            const accessEntry = logger.logServiceAccess('getData');
            const op1Entry = logger.logOperation('ValidateInput', 'success', 'Input validated');
            const op2Entry = logger.logOperation('FetchData', 'success', 'Data fetched from DB');

            // All should use same timestamp
            expect(accessEntry.Timestamp).toEqual(testTimestamp);
            expect(op1Entry.Timestamp).toEqual(testTimestamp);
            expect(op2Entry.Timestamp).toEqual(testTimestamp);

            // All should have correct service name
            expect(accessEntry.Type).toContain(testServiceName);
            expect(op1Entry.Type).toContain(testServiceName);
            expect(op2Entry.Type).toContain(testServiceName);
        });

        test('should handle error recovery pattern', () => {
            // Simulate operation, error, retry, success
            const attempt1Entry = logger.logOperation('UpdateDB', 'fail', 'First attempt', 'Connection timeout');
            const errorEntry = logger.logError('UpdateDB', new Error('Connection timeout'));
            const attempt2Entry = logger.logOperation('UpdateDB', 'success', 'Retry succeeded');

            expect(attempt1Entry.Outcome).toBe('fail');
            expect(errorEntry.Outcome).toBe('fail');
            expect(attempt2Entry.Outcome).toBe('success');
        });
    });
});
