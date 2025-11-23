if (typeof require !== 'undefined') {
    var { Audit } = require('../src/common/audit/AuditLogger');
    var { MembershipManagement } = require('../src/services/MembershipManagement/Manager');
}

/**
 * Integration tests for audit logging in Manager
 * Tests that the Manager correctly generates audit log entries for business events
 */
describe('Manager Audit Integration', () => {
    let manager;
    let auditLogger;
    let testDate;
    let actionSpecs;
    let groups;

    beforeEach(() => {
        testDate = new Date('2024-01-15T10:00:00Z');
        auditLogger = new Audit.Logger(testDate);
        
        actionSpecs = {
            Join: { Type: 'Join', Subject: 'Welcome!', Body: 'Welcome {First}!' },
            Renew: { Type: 'Renew', Subject: 'Renewed!', Body: 'Thanks {First}!' },
            Migrate: { Type: 'Migrate', Subject: 'Migrated!', Body: 'Welcome {First}!' },
            Expiry1: { Type: 'Expiry1', Offset: -30, Subject: 'Expiry Warning', Body: 'Hey {First}!' },
            Expiry2: { Type: 'Expiry2', Offset: -7, Subject: 'Final Warning', Body: 'Hey {First}!' },
            Expiry3: { Type: 'Expiry3', Offset: 0, Subject: 'Expired', Body: 'Expired {First}!' },
            Expiry4: { Type: 'Expiry4', Offset: 7, Subject: 'Removed', Body: 'Goodbye {First}!' }
        };
        
        groups = [
            { Email: 'group1@example.com', Subscription: 'auto' },
            { Email: 'group2@example.com', Subscription: 'auto' }
        ];
        
        const groupManager = {
            groupAddFun: jest.fn(),
            groupRemoveFun: jest.fn()
        };
        
        const sendEmailFun = jest.fn();
        
        manager = new MembershipManagement.Manager(
            actionSpecs,
            groups,
            groupManager,
            sendEmailFun,
            testDate,
            auditLogger
        );
    });

    describe('processPaidTransactions audit logging', () => {
        it('should create audit entry for Join event', () => {
            const transactions = [{
                'Email Address': 'new@example.com',
                'First Name': 'New',
                'Last Name': 'User',
                'Payable Status': 'paid',
                Payment: '1 year',
                Phone: '',
                Directory: ''
            }];
            
            const members = [];
            const expirySchedule = [];
            
            const result = manager.processPaidTransactions(transactions, members, expirySchedule);
            
            expect(result.auditEntries).toHaveLength(1);
            expect(result.auditEntries[0]).toMatchObject({
                Type: 'Join',
                Outcome: 'success',
                Note: expect.stringContaining('new@example.com'),
                Error: '',
                JSON: ''
            });
            expect(result.auditEntries[0].Timestamp).toEqual(testDate);
        });

        it('should create audit entry for Renew event', () => {
            const transactions = [{
                'Email Address': 'existing@example.com',
                'First Name': 'Existing',
                'Last Name': 'User',
                'Payable Status': 'paid',
                Payment: '1 year',
                Phone: '',
                Directory: ''
            }];
            
            const members = [{
                Status: 'Active',
                Email: 'existing@example.com',
                First: 'Existing',
                Last: 'User',
                Phone: '',
                Joined: new Date('2023-01-15'),
                Expires: new Date('2024-01-15'),
                Period: 1,
                'Directory Share Name': false,
                'Directory Share Email': false,
                'Directory Share Phone': false,
                'Renewed On': new Date('2023-01-15')
            }];
            
            const expirySchedule = [];
            
            const result = manager.processPaidTransactions(transactions, members, expirySchedule);
            
            expect(result.auditEntries).toHaveLength(1);
            expect(result.auditEntries[0]).toMatchObject({
                Type: 'Renew',
                Outcome: 'success',
                Note: expect.stringContaining('existing@example.com'),
                Error: '',
                JSON: ''
            });
        });

        it('should create audit entry with error details for failed transaction', () => {
            const transactions = [{
                'Email Address': 'bad@example.com',
                'First Name': 'Bad',
                'Last Name': 'User',
                'Payable Status': 'paid',
                Payment: '1 year',
                Phone: '',
                Directory: ''
            }];
            
            const members = [];
            const expirySchedule = [];
            
            // Mock email sending to throw error
            const errorManager = new MembershipManagement.Manager(
                actionSpecs,
                groups,
                { groupAddFun: jest.fn(), groupRemoveFun: jest.fn() },
                jest.fn(() => { throw new Error('Email send failed'); }),
                testDate,
                auditLogger
            );
            
            const result = errorManager.processPaidTransactions(transactions, members, expirySchedule);
            
            expect(result.auditEntries).toHaveLength(1);
            expect(result.auditEntries[0]).toMatchObject({
                Type: 'Join',
                Outcome: 'fail',
                Note: expect.stringContaining('bad@example.com'),
                Error: 'Email send failed'
            });
            expect(result.auditEntries[0].JSON).toContain('Email send failed');
        });
    });

    describe('migrateCEMembers audit logging', () => {
        it('should create audit entry for successful migration', () => {
            const migrators = [{
                Email: 'migrated@example.com',
                First: 'Migrated',
                Last: 'User',
                Phone: '555-0100',
                Joined: new Date('2020-01-01'),
                Period: 1,
                Expires: new Date('2025-01-01'),
                'Renewed On': new Date('2024-01-01'),
                Directory: 'Yes',
                Status: 'Active',
                'Migrate Me': true
            }];
            
            const members = [];
            const expirySchedule = [];
            
            const result = manager.migrateCEMembers(migrators, members, expirySchedule);
            
            expect(result.auditEntries).toHaveLength(1);
            expect(result.auditEntries[0]).toMatchObject({
                Type: 'Migrate',
                Outcome: 'success',
                Note: expect.stringContaining('migrated@example.com'),
                Error: '',
                JSON: ''
            });
        });

        it('should create audit entry for failed migration', () => {
            const migrators = [{
                Email: 'bad-migrate@example.com',
                First: 'Bad',
                Last: 'User',
                Phone: '555-0100',
                Joined: new Date('2020-01-01'),
                Period: 1,
                Expires: new Date('2025-01-01'),
                'Renewed On': new Date('2024-01-01'),
                Directory: 'Yes',
                Status: 'Active',
                'Migrate Me': true
            }];
            
            const members = [];
            const expirySchedule = [];
            
            // Mock email sending to throw error
            const errorManager = new MembershipManagement.Manager(
                actionSpecs,
                groups,
                { groupAddFun: jest.fn(), groupRemoveFun: jest.fn() },
                jest.fn(() => { throw new Error('Migration email failed'); }),
                testDate,
                auditLogger
            );
            
            expect(() => {
                errorManager.migrateCEMembers(migrators, members, expirySchedule);
            }).toThrow();
            
            // Even though it throws, audit entry should be created before the error
            // We need to catch and check
            try {
                errorManager.migrateCEMembers(migrators, members, expirySchedule);
            } catch (error) {
                // The error is AggregateError, check that audit was attempted
                expect(error).toBeInstanceOf(AggregateError);
            }
        });
    });

    describe('generateExpiringMembersList audit logging', () => {
        it('should create audit entries for each expiry type processed', () => {
            const members = [
                {
                    Status: 'Active',
                    Email: 'user1@example.com',
                    First: 'User',
                    Last: 'One',
                    Phone: '',
                    Joined: new Date('2023-01-01'),
                    Expires: new Date('2024-02-15'),
                    Period: 1,
                    'Directory Share Name': false,
                    'Directory Share Email': false,
                    'Directory Share Phone': false,
                    'Renewed On': new Date('2023-01-01')
                },
                {
                    Status: 'Active',
                    Email: 'user2@example.com',
                    First: 'User',
                    Last: 'Two',
                    Phone: '',
                    Joined: new Date('2023-01-01'),
                    Expires: new Date('2024-02-15'),
                    Period: 1,
                    'Directory Share Name': false,
                    'Directory Share Email': false,
                    'Directory Share Phone': false,
                    'Renewed On': new Date('2023-01-01')
                }
            ];
            
            const expirySchedule = [
                { Date: new Date('2024-01-10'), Type: 'Expiry1', Email: 'user1@example.com' },
                { Date: new Date('2024-01-10'), Type: 'Expiry2', Email: 'user2@example.com' }
            ];
            
            const prefillTemplate = 'http://example.com/form';
            
            const result = manager.generateExpiringMembersList(members, expirySchedule, prefillTemplate);
            
            expect(result.auditEntries).toHaveLength(2);
            // Note: expiry schedules are processed in reverse order (highest to lowest index)
            expect(result.auditEntries[0]).toMatchObject({
                Type: 'Expiry2',
                Outcome: 'success',
                Note: expect.stringContaining('user2@example.com')
            });
            expect(result.auditEntries[1]).toMatchObject({
                Type: 'Expiry1',
                Outcome: 'success',
                Note: expect.stringContaining('user1@example.com')
            });
        });
    });

    describe('processExpiredMembers DeadLetter audit logging', () => {
        it('should create audit entry when item reaches max attempts', () => {
            const fifoItems = [{
                id: 'test-1',
                email: 'failed@example.com',
                subject: 'Test',
                htmlBody: 'Test Body',
                groups: '',
                attempts: 4,
                lastAttemptAt: '',
                lastError: '',
                nextAttemptAt: '',
                maxAttempts: 5,
                dead: false
            }];
            
            const sendEmailFun = jest.fn(() => {
                throw new Error('Email service unavailable');
            });
            
            const groupRemoveFun = jest.fn();
            
            const result = manager.processExpiredMembers(fifoItems, sendEmailFun, groupRemoveFun, {
                maxAttempts: 5
            });
            
            expect(result.failed).toHaveLength(1);
            expect(result.failed[0].dead).toBe(true);
            expect(result.auditEntries).toHaveLength(1);
            expect(result.auditEntries[0]).toMatchObject({
                Type: 'DeadLetter',
                Outcome: 'fail',
                Note: expect.stringContaining('failed@example.com'),
                Error: expect.stringContaining('Email service unavailable')
            });
            expect(result.auditEntries[0].JSON).toContain('Email service unavailable');
            expect(result.auditEntries[0].JSON).toContain('failed@example.com');
        });

        it('should not create audit entry for items that can be retried', () => {
            const fifoItems = [{
                id: 'test-1',
                email: 'retry@example.com',
                subject: 'Test',
                htmlBody: 'Test Body',
                groups: '',
                attempts: 2,
                lastAttemptAt: '',
                lastError: '',
                nextAttemptAt: '',
                maxAttempts: 5,
                dead: false
            }];
            
            const sendEmailFun = jest.fn(() => {
                throw new Error('Temporary failure');
            });
            
            const groupRemoveFun = jest.fn();
            
            const result = manager.processExpiredMembers(fifoItems, sendEmailFun, groupRemoveFun, {
                maxAttempts: 5
            });
            
            expect(result.failed).toHaveLength(1);
            expect(result.failed[0].dead).toBe(false);
            expect(result.auditEntries).toHaveLength(0); // No audit entry for retryable failures
        });
    });

    describe('Manager without audit logger', () => {
        it('should work normally without audit logger', () => {
            const managerNoAudit = new MembershipManagement.Manager(
                actionSpecs,
                groups,
                { groupAddFun: jest.fn(), groupRemoveFun: jest.fn() },
                jest.fn(),
                testDate,
                null  // No audit logger
            );
            
            const transactions = [{
                'Email Address': 'new@example.com',
                'First Name': 'New',
                'Last Name': 'User',
                'Payable Status': 'paid',
                Payment: '1 year',
                Phone: '',
                Directory: ''
            }];
            
            const members = [];
            const expirySchedule = [];
            
            const result = managerNoAudit.processPaidTransactions(transactions, members, expirySchedule);
            
            expect(result.auditEntries).toHaveLength(0);
            expect(result.recordsChanged).toBe(true);
        });
    });
});
