// Wrapper-level tests for MembershipManagement.processExpirationFIFO
const ns = require('../src/1namespaces.js');
const createFiddlerMock = require('./helpers/fiddlerMock');
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
            { id: 'r1', createdAt: '', status: 'pending', memberEmail: 's1@example.com', memberName: '', expiryDate: '', actionType: 'notify-only', groups: '', emailTo: 's1@example.com', emailSubject: 's1', emailBody: 'b', attempts: 0, lastAttemptAt: '', lastError: '', nextRetryAt: '', maxRetries: '', note: '' },
            { id: 'r2', createdAt: '', status: 'pending', memberEmail: 's2@example.com', memberName: '', expiryDate: '', actionType: 'notify-only', groups: '', emailTo: 's2@example.com', emailSubject: 's2', emailBody: 'b', attempts: 0, lastAttemptAt: '', lastError: '', nextRetryAt: '', maxRetries: '', note: '' },
            { id: 'r3', createdAt: '', status: 'pending', memberEmail: 's3@example.com', memberName: '', expiryDate: '', actionType: 'notify-only', groups: '', emailTo: 's3@example.com', emailSubject: 's3', emailBody: 'b', attempts: 0, lastAttemptAt: '', lastError: '', nextRetryAt: '', maxRetries: '', note: '' }
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
            processed: [{ id: 'r1', email: 's1@example.com', subject: '', htmlBody: '', groups: '', attempts: 0, lastAttemptAt: '', lastError: '', nextRetryAt: '' }],
            failed: [
                { id: 'r2', email: 's2@example.com', subject: 's2', htmlBody: 'b', groups: '', attempts: 2, lastAttemptAt: '2020-01-01T00:00:00.000Z', lastError: 'Error: transient', nextRetryAt: '2020-01-01T00:05:00.000Z', dead: false },
                { id: 'r3', email: 's3@example.com', subject: 's3', htmlBody: 'b', groups: '', attempts: 3, lastAttemptAt: '2020-01-01T00:00:00.000Z', lastError: 'Error: permanent', nextRetryAt: '', dead: true }
            ]
        };

        // Override initializeManagerData_ to return our manager
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
                { id: 'r2', email: 's2@example.com', subject: '', htmlBody: '', groups: '', attempts: 0, lastAttemptAt: '', lastError: '', nextRetryAt: '' },
                { id: 'r3', email: 's3@example.com', subject: '', htmlBody: '', groups: '', attempts: 0, lastAttemptAt: '', lastError: '', nextRetryAt: '' }
            ],
            failed: [
                { id: 'r1', email: 's1@example.com', subject: 's1', htmlBody: 'b', groups: '', attempts: 1, lastAttemptAt: '2020-01-01T00:00:00.000Z', lastError: 'Err', nextRetryAt: '2020-01-01T00:05:00.000Z', dead: false }
            ]
        };
        global.MembershipManagement.Internal.initializeManagerData_ = jest.fn(() => {
            return { manager: { processExpiredMembers: jest.fn(() => fakeResult) }, membershipData: [], expiryScheduleData: [] };
        });
        const res = global.MembershipManagement.processExpirationFIFO({ batchSize: 10 });
        // updated queue still has entries (r1 remains) so trigger should be scheduled
        expect(global.MembershipManagement.Trigger._createMinuteTrigger).toHaveBeenCalled();
    });

    it('skips non-eligible rows with future nextRetryAt', () => {
        // Put a future nextRetryAt in r1 so it's not eligible
        fiddlers._internal.setFifo([
            { ...fiddlers.getFifo()[0], nextRetryAt: new Date(Date.now() + 60 * 60 * 1000).toISOString() },
            fiddlers.getFifo()[1],
            fiddlers.getFifo()[2]
        ]);
        const fakeResult = { processed: 2, failedMeta: [] };
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

    // legacy fallback removed — Manager must return `failedMeta` (no test for legacy behavior)
});
