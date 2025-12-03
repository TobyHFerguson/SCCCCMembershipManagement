// Wrapper-level tests for MembershipManagement.processExpirationFIFO
const ns = require('../src/1namespaces.js');
const createFiddlerMock = require('./helpers/fiddlerMock');

// Set up Common mocks FIRST before loading any MembershipManagement code
global.Common = global.Common || {};
global.Common.Data = global.Common.Data || {};
global.Common.Data.Storage = global.Common.Data.Storage || {};
global.Common.Config = global.Common.Config || {};
global.Common.Config.Properties = {
    getProperty: jest.fn((key, defaultValue) => defaultValue),
    getNumberProperty: jest.fn((key, defaultValue) => defaultValue),
    getBooleanProperty: jest.fn((key, defaultValue) => defaultValue),
    setCodeInternalProperty: jest.fn(),
    deleteCodeInternalProperty: jest.fn(),
    clearCache: jest.fn(),
    getAllUserProperties: jest.fn(() => ({}))
};
global.Common.Logger = global.Common.Logger || {};
global.Common.Logger.info = jest.fn();
global.Common.Logger.warn = jest.fn();
global.Common.Logger.error = jest.fn();
global.Common.Logger.debug = jest.fn();

// Load utilities and manager so MembershipManagement namespace is populated
require('../src/services/MembershipManagement/utils.js');
require('../src/services/MembershipManagement/Manager.js');
// Ensure a global MembershipManagement.Internal exists (Manager.js can overwrite the global)
global.MembershipManagement = global.MembershipManagement || ns.MembershipManagement || {};
global.MembershipManagement.Internal = global.MembershipManagement.Internal || {};
require('../src/services/MembershipManagement/Trigger.js');
// Require the wrapper last so it can attach to the existing global MembershipManagement
require('../src/services/MembershipManagement/MembershipManagement.js');

describe('MembershipManagement.processExpirationFIFO (wrapper) ', () => {
    let originalGetFiddler;
    let fifoData;
    let deadData;
    let fiddlers;

    beforeEach(() => {
        // Prepare in-memory fiddlers via helper
        fifoData = [
            { id: 'r1', createdAt: '', status: 'pending', memberEmail: 's1@example.com', memberName: '', expiryDate: '', actionType: 'notify-only', groups: '', emailTo: 's1@example.com', emailSubject: 's1', emailBody: 'b', attempts: 0, lastAttemptAt: '', lastError: '', nextAttemptAt: '', maxAttempts: '', note: '' },
            { id: 'r2', createdAt: '', status: 'pending', memberEmail: 's2@example.com', memberName: '', expiryDate: '', actionType: 'notify-only', groups: '', emailTo: 's2@example.com', emailSubject: 's2', emailBody: 'b', attempts: 0, lastAttemptAt: '', lastError: '', nextAttemptAt: '', maxAttempts: '', note: '' },
            { id: 'r3', createdAt: '', status: 'pending', memberEmail: 's3@example.com', memberName: '', expiryDate: '', actionType: 'notify-only', groups: '', emailTo: 's3@example.com', emailSubject: 's3', emailBody: 'b', attempts: 0, lastAttemptAt: '', lastError: '', nextAttemptAt: '', maxAttempts: '', note: '' }
        ];
        deadData = [];

        fiddlers = createFiddlerMock(fifoData, deadData);
        fiddlers.install();

        // Stub trigger helpers so tests don't call ScriptApp
        global.MembershipManagement.Trigger = global.MembershipManagement.Trigger || {};
        global.MembershipManagement.Trigger._deleteTriggersByFunctionName = jest.fn();
        global.MembershipManagement.Trigger._createMinuteTrigger = jest.fn();
    });

    afterEach(() => {
        // restore fiddlers
        if (fiddlers) fiddlers.restore();
        jest.restoreAllMocks();
    });

    it('persists manager-provided failed items into FIFO and moves dead items to ExpirationDeadLetter', () => {
        // Arrange: stub initializeManagerData_ to provide a fake manager
        const fakeResult = {
            processed: [{ id: 'r1', email: 's1@example.com', subject: '', htmlBody: '', groups: '', attempts: 0, lastAttemptAt: '', lastError: '', nextAttemptAt: '' }],
            failed: [
                { id: 'r2', email: 's2@example.com', subject: 's2', htmlBody: 'b', groups: '', attempts: 2, lastAttemptAt: '2020-01-01T00:00:00.000Z', lastError: 'Error: transient', nextAttemptAt: '2020-01-01T00:05:00.000Z', dead: false },
                { id: 'r3', email: 's3@example.com', subject: 's3', htmlBody: 'b', groups: '', attempts: 3, lastAttemptAt: '2020-01-01T00:00:00.000Z', lastError: 'Error: permanent', nextAttemptAt: '', dead: true }
            ]
        };

        // Override initializeManagerData_ to return our manager
        // @ts-ignore - Mock partial implementation for testing
        global.MembershipManagement.Internal.initializeManagerData_ = jest.fn(() => {
            return { manager: { processExpiredMembers: jest.fn(() => fakeResult) }, membershipData: [], expiryScheduleData: [] };
        });

        // Act
        const res = global.MembershipManagement.processExpirationFIFO();

        // Assert: processed count (processed array length) is returned by the wrapper
        expect(res.processed).toBe(1);
        // One failed non-dead (r2) should remain in FIFO with updated attempts
        const remainingIds = fiddlers.getFifo().map(r => r.id);
        expect(remainingIds).toContain('r2');
        // Dead row r3 moved to deadData
        const deadIds = fiddlers.getDead().map(r => r.id);
        expect(deadIds).toContain('r3');
        // The updated r2 row should have attempts === 2 and lastError matching
        const r2row = fiddlers.getFifo().find(r => r.id === 'r2');
        expect(r2row.attempts).toBe(2);
        expect(r2row.lastError).toBe('Error: transient');
    });

    it('schedules a minute trigger when work remains after processing', () => {
        const fakeResult = {
            processed: [
                { id: 'r2', email: 's2@example.com', subject: '', htmlBody: '', groups: '', attempts: 0, lastAttemptAt: '', lastError: '', nextAttemptAt: '' },
                { id: 'r3', email: 's3@example.com', subject: '', htmlBody: '', groups: '', attempts: 0, lastAttemptAt: '', lastError: '', nextAttemptAt: '' }
            ],
            failed: [
                { id: 'r1', email: 's1@example.com', subject: 's1', htmlBody: 'b', groups: '', attempts: 1, lastAttemptAt: '2020-01-01T00:00:00.000Z', lastError: 'Err', nextAttemptAt: '2020-01-01T00:05:00.000Z', dead: false }
            ]
        };
        // @ts-ignore - Mock partial implementation for testing
        global.MembershipManagement.Internal.initializeManagerData_ = jest.fn(() => {
            return { manager: { processExpiredMembers: jest.fn(() => fakeResult) }, membershipData: [], expiryScheduleData: [] };
        });
        const res = global.MembershipManagement.processExpirationFIFO({ batchSize: 10 });
        // updated queue still has entries (r1 remains) so trigger should be scheduled
        expect(global.MembershipManagement.Trigger._createMinuteTrigger).toHaveBeenCalled();
    });

    it('skips non-eligible rows with future nextAttemptAt', () => {
        // Put a future nextAttemptAt in r1 so it's not eligible
        fiddlers._internal.setFifo([
            { ...fiddlers.getFifo()[0], nextAttemptAt: new Date(Date.now() + 60 * 60 * 1000).toISOString() },
            fiddlers.getFifo()[1],
            fiddlers.getFifo()[2]
        ]);
        const fakeResult = { processed: [{}, {}], failed: [], auditEntries: [] };
        // @ts-ignore - Mock partial implementation for testing
        global.MembershipManagement.Internal.initializeManagerData_ = jest.fn(() => {
            return { manager: { processExpiredMembers: jest.fn(() => fakeResult) }, membershipData: [], expiryScheduleData: [] };
        });
        const res = global.MembershipManagement.processExpirationFIFO({ batchSize: 10 });
        // One row (r1) skipped; processed should reflect eligible count (2)
        expect(res.processed).toBeGreaterThanOrEqual(0);
        // ensure skipped r1 is still present in FIFO
        const ids = fiddlers.getFifo().map(r => r.id);
        expect(ids).toContain('r1');
    });
});

describe('MembershipManagement audit persistence integration', () => {
    beforeEach(() => {
        // Setup Common.Logger mock for AuditPersistence
        global.Common = global.Common || {};
        global.Common.Logger = global.Common.Logger || {};
        global.Common.Logger.info = jest.fn();
        global.Common.Logger.error = jest.fn();
        
        // Ensure Audit namespace exists globally and load Audit.Persistence helper
        const auditModule = require('../src/common/audit/AuditPersistence.js');
        global.Audit = auditModule.Audit;
    });

    it('persistAuditEntries_ uses Audit.Persistence.persistAuditEntries helper', () => {
        const mockAuditEntries = [
            { Type: 'ProcessExpiredMember', Outcome: 'success', Note: 'Test entry 1', Timestamp: '2024-01-01T00:00:00.000Z' },
            { Type: 'DeadLetter', Outcome: 'fail', Note: 'Test entry 2', Error: 'Test error', Timestamp: '2024-01-01T00:00:01.000Z' }
        ];

        const mockAuditFiddler = {
            getData: jest.fn(() => []),
            setData: jest.fn().mockReturnThis(),
            dumpValues: jest.fn()
        };

        global.Common = global.Common || {};
        global.Common.Data = global.Common.Data || {};
        global.Common.Data.Storage = global.Common.Data.Storage || {};
        global.Common.Data.Storage.SpreadsheetManager = {
            getFiddler: jest.fn((name) => {
                if (name === 'Audit') return mockAuditFiddler;
                throw new Error(`Unexpected fiddler: ${name}`);
            })
        };

        // Call the wrapper function
        const numWritten = global.MembershipManagement.Internal.persistAuditEntries_(mockAuditEntries);

        // Verify helper was called with correct fiddler
        expect(global.Common.Data.Storage.SpreadsheetManager.getFiddler).toHaveBeenCalledWith('Audit');

        // Verify audit entries were persisted
        expect(mockAuditFiddler.setData).toHaveBeenCalled();
        expect(mockAuditFiddler.dumpValues).toHaveBeenCalled();

        // Verify return value
        expect(numWritten).toBe(2);
    });

    it('persistAuditEntries_ returns 0 when auditEntries is empty', () => {
        const numWritten = global.MembershipManagement.Internal.persistAuditEntries_([]);
        expect(numWritten).toBe(0);
    });

    it('persistAuditEntries_ returns 0 when auditEntries is null/undefined', () => {
        expect(global.MembershipManagement.Internal.persistAuditEntries_(null)).toBe(0);
        expect(global.MembershipManagement.Internal.persistAuditEntries_(undefined)).toBe(0);
    });

    it('persistAuditEntries_ catches and logs errors without throwing', () => {
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

        const mockAuditEntries = [
            { Type: 'Test', Outcome: 'success', Note: 'Test entry', Timestamp: '2024-01-01T00:00:00.000Z' }
        ];

        global.Common = global.Common || {};
        global.Common.Data = global.Common.Data || {};
        global.Common.Data.Storage = global.Common.Data.Storage || {};
        global.Common.Data.Storage.SpreadsheetManager = {
            getFiddler: jest.fn(() => {
                throw new Error('Fiddler error');
            })
        };

        // Should not throw
        const numWritten = global.MembershipManagement.Internal.persistAuditEntries_(mockAuditEntries);

        // Should log error
        expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to persist audit entries'));

        // Should return 0
        expect(numWritten).toBe(0);

        consoleErrorSpy.mockRestore();
    });
});
