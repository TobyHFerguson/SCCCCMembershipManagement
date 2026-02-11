/**
 * Audit Contract Tests
 * 
 * Purpose: Guarantee that Manager business methods return exactly one audit entry per business event.
 * 
 * Contract Rules:
 * 1. Every business event (success or failure) MUST generate exactly one AuditLogEntry
 * 2. No other audit entries should be generated (no noise)
 * 3. Each audit entry must have: type, outcome, note/error, timestamp
 * 
 * Tests cover all Manager methods that process business events:
 * - processExpiredMembers (consumer pattern, processes FIFO items - business events: email sent, groups removed)
 * - migrateCEMembers (migrates members from old system)
 * - processPaidTransactions (handles joins and renewals)
 * 
 * Note: generateExpiringMembersList is NOT tested here - it's a generator/preparatory function that creates
 * a queue for later processing. The actual business events (emails sent, groups removed) happen in 
 * processExpiredMembers when the queue is consumed.
 */

// Import flat classes (no namespace nesting)
const AuditLogEntry = require('../src/common/audit/AuditLogEntry');
const AuditLogger = require('../src/common/audit/AuditLogger');

const ns = require('../src/1namespaces.js');
require('../src/services/MembershipManagement/utils.js');
require('../src/services/MembershipManagement/Manager.js');

const MembershipManagement = global.MembershipManagement;
const utils = MembershipManagement.Utils;

describe('Audit Contract Tests', () => {
  let auditLogger;
  let manager;
  let actionSpecs;
  let groups;
  let groupManager;
  let sendEmailFun;
  let today;

  beforeEach(() => {
    today = new Date('2024-01-15');
    auditLogger = new AuditLogger();
    
    actionSpecs = {
      Expiry1: { Type: 'Expiry1', Subject: 'Expiring soon', Body: 'Your membership expires on {Expires}', Offset: -30 },
      Expiry2: { Type: 'Expiry2', Subject: 'Expiring very soon', Body: 'Last chance', Offset: -7 },
      Expiry3: { Type: 'Expiry3', Subject: 'Expired', Body: 'Membership expired', Offset: 0 },
      Expiry4: { Type: 'Expiry4', Subject: 'Final notice', Body: 'Removing from groups', Offset: 7 },
      Join: { Type: 'Join', Subject: 'Welcome!', Body: 'Welcome {First}' },
      Renew: { Type: 'Renew', Subject: 'Renewed!', Body: 'Thanks {First}' },
      Migrate: { Type: 'Migrate', Subject: 'Migrated', Body: 'Migrated {Email}' }
    };
    
    groups = [
      { Email: 'group1@example.com' },
      { Email: 'group2@example.com' }
    ];
    
    groupManager = {
      groupAddFun: jest.fn(),
      groupRemoveFun: jest.fn(),
      groupEmailReplaceFun: jest.fn()
    };
    
    sendEmailFun = jest.fn();
    
    manager = new MembershipManagement.Manager(
      /** @type {any} */ (actionSpecs),
      /** @type {any} */ (groups),
      groupManager,
      sendEmailFun,
      today,
      auditLogger
    );
  });

  describe('processExpiredMembers - business event processor', () => {
    it('generates exactly one success audit entry per processed item', () => {
      const fifoItems = [
        { id: '1', email: 't1@test.com', subject: 's1', htmlBody: 'b1', groups: '', attempts: 0 },
        { id: '2', email: 't2@test.com', subject: 's2', htmlBody: 'b2', groups: '', attempts: 0 }
      ];
      
      const mockSendEmail = jest.fn();
      const mockGroupRemove = jest.fn();
      
      const result = manager.processExpiredMembers(fifoItems, mockSendEmail, mockGroupRemove);
      
      // Should have exactly one audit entry per successfully processed item
      expect(result.processed.length).toBe(2);
      expect(result.auditEntries.length).toBe(2);
      
      result.auditEntries.forEach(entry => {
        expect(entry.Type).toBe('ProcessExpiredMember');
        expect(entry.Outcome).toBe('success');
        expect(entry.Note).toContain('Successfully processed expiration for');
        expect(entry.Timestamp).toBeDefined();
      });
    });

    it('generates exactly one DeadLetter audit entry per dead item', () => {
      const fifoItems = [
        { id: '1', email: 't1@test.com', subject: 's1', htmlBody: 'b1', groups: '', attempts: 4, maxAttempts: 5 }
      ];
      
      const mockSendEmail = jest.fn(() => { throw new Error('Email send failed'); });
      const mockGroupRemove = jest.fn();
      
      const result = manager.processExpiredMembers(fifoItems, mockSendEmail, mockGroupRemove, { maxAttempts: 5 });
      
      // Should have exactly one DeadLetter audit entry for the failed item that reached max attempts
      expect(result.failed.length).toBe(1);
      expect(result.failed[0].dead).toBe(true);
      expect(result.auditEntries.length).toBe(1);
      expect(result.auditEntries[0].Type).toBe('DeadLetter');
      expect(result.auditEntries[0].Outcome).toBe('fail');
      expect(result.auditEntries[0].Error).toContain('Email send failed');
    });

    it('generates no audit entries for failed items that will be retried (not a final business event)', () => {
      const fifoItems = [
        { id: '1', email: 't1@test.com', subject: 's1', htmlBody: 'b1', groups: '', attempts: 2 }
      ];
      
      const mockSendEmail = jest.fn(() => { throw new Error('Transient error'); });
      const mockGroupRemove = jest.fn();
      
      const result = manager.processExpiredMembers(fifoItems, mockSendEmail, mockGroupRemove, { maxAttempts: 5 });
      
      // Failed but not dead - will be retried, so no audit entry (not a final business event)
      expect(result.failed.length).toBe(1);
      expect(result.failed[0].dead).toBe(false);
      expect(result.auditEntries.length).toBe(0); // no noise - retry isn't a business event
    });
  });

  describe('migrateCEMembers - business event processor', () => {
    it('generates exactly one success audit entry per migrated member', () => {
      const migrators = [
        { Email: 'm1@test.com', First: 'John', Last: 'Doe', Phone: '123', Joined: '2023-01-01', Period: 1, Expires: '2024-01-01', 'Renewed On': '', Directory: true, 'Migrate Me': true, Migrated: '', Status: 'Active' },
        { Email: 'm2@test.com', First: 'Jane', Last: 'Smith', Phone: '456', Joined: '2023-02-01', Period: 1, Expires: '2024-02-01', 'Renewed On': '', Directory: false, 'Migrate Me': true, Migrated: '', Status: 'Active' }
      ];
      
      const members = [];
      const expirySchedule = [];
      
      const result = manager.migrateCEMembers(migrators, members, expirySchedule);
      
      // Should have exactly one audit entry per migrated member
      expect(result.numMigrations).toBe(2);
      expect(result.auditEntries.length).toBe(2);
      
      result.auditEntries.forEach(entry => {
        expect(entry.Type).toBe('Migrate');
        expect(entry.Outcome).toBe('success');
        expect(entry.Note).toContain('Member migrated:');
      });
    });

    it('generates exactly one failure audit entry per migration error', () => {
      const migrators = [
        { Email: 'good@test.com', First: 'Good', Last: 'User', Phone: '123', Joined: '2023-01-01', Period: 1, Expires: '2024-01-01', 'Renewed On': '', Directory: true, 'Migrate Me': true, Migrated: '', Status: 'Active' },
        { Email: 'bad@test.com', First: 'Bad', Last: 'User', Phone: '456', Joined: '2023-02-01', Period: 1, Expires: '2024-02-01', 'Renewed On': '', Directory: false, 'Migrate Me': true, Migrated: '', Status: 'Active' }
      ];
      
      const members = [];
      const expirySchedule = [];
      
      // Mock sendEmailFun to fail for specific email
      sendEmailFun.mockImplementation((msg) => {
        if (msg.to === 'bad@test.com') {
          throw new Error('Email send failed');
        }
      });
      
      const result = manager.migrateCEMembers(migrators, members, expirySchedule);
      
      // Should have one success and one failure audit entry
      expect(result.numMigrations).toBe(1); // only one succeeded
      expect(result.errors.length).toBe(1);
      expect(result.auditEntries.length).toBe(2); // one success + one failure
      
      const successEntry = result.auditEntries.find(e => e.Outcome === 'success');
      const failEntry = result.auditEntries.find(e => e.Outcome === 'fail');
      
      expect(successEntry).toBeDefined();
      expect(successEntry.Note).toContain('good@test.com');
      
      expect(failEntry).toBeDefined();
      expect(failEntry.Type).toBe('Migrate');
      expect(failEntry.Note).toContain('Failed to migrate bad@test.com');
      expect(failEntry.Error).toContain('Email send failed');
    });
  });

  describe('processPaidTransactions - business event processor', () => {
    it('generates exactly one Join audit entry per new member', () => {
      const txns = [
        { 'Email Address': 'new1@test.com', 'First Name': 'John', 'Last Name': 'Doe', Phone: '123', Payment: '1 year', 'Payable Status': 'Paid', Processed: null },
        { 'Email Address': 'new2@test.com', 'First Name': 'Jane', 'Last Name': 'Smith', Phone: '456', Payment: '2 year', 'Payable Status': 'Paid', Processed: null }
      ];
      
      const membershipData = [];
      const expirySchedule = [];
      
      const result = manager.processPaidTransactions(txns, membershipData, expirySchedule);
      
      // Should have exactly one Join audit entry per new member
      expect(membershipData.length).toBe(2);
      expect(result.auditEntries.length).toBe(2);
      
      result.auditEntries.forEach(entry => {
        expect(entry.Type).toBe('Join');
        expect(entry.Outcome).toBe('success');
        expect(entry.Note).toContain('Member joined:');
      });
    });

    it('generates exactly one Renew audit entry per renewed member', () => {
      const txns = [
        { 'Email Address': 'existing@test.com', 'First Name': 'John', 'Last Name': 'Doe', Phone: '123', Payment: '1 year', 'Payable Status': 'Paid', Processed: null }
      ];
      
      const membershipData = [
        { Email: 'existing@test.com', First: 'John', Last: 'Doe', Status: 'Active', Joined: '2023-01-01', Expires: '2025-04-01', Period: 1, 'Renewed On': '' }  // Future date for valid temporal match
      ];
      const expirySchedule = [];
      
      const result = manager.processPaidTransactions(txns, membershipData, expirySchedule);
      
      // Should have exactly one Renew audit entry
      expect(result.auditEntries.length).toBe(1);
      expect(result.auditEntries[0].Type).toBe('Renew');
      expect(result.auditEntries[0].Outcome).toBe('success');
      expect(result.auditEntries[0].Note).toContain('Member renewed:');
    });

    it('generates no audit entries for unpaid or processed transactions (not business events)', () => {
      const txns = [
        { 'Email Address': 'unpaid@test.com', 'First Name': 'Un', 'Last Name': 'Paid', 'Payable Status': 'Pending', Processed: null },
        { 'Email Address': 'processed@test.com', 'First Name': 'Pro', 'Last Name': 'Cessed', 'Payable Status': 'Paid', Processed: '2024-01-01' }
      ];
      
      const membershipData = [];
      const expirySchedule = [];
      
      const result = manager.processPaidTransactions(txns, membershipData, expirySchedule);
      
      // No business events occurred, so no audit entries
      expect(result.recordsChanged).toBe(false);
      expect(result.auditEntries.length).toBe(0);
    });

    it('generates exactly one failure audit entry per transaction error', () => {
      const txns = [
        { 'Email Address': 'good@test.com', 'First Name': 'Good', 'Last Name': 'User', Payment: '1 year', 'Payable Status': 'Paid', Processed: null },
        { 'Email Address': 'bad@test.com', 'First Name': 'Bad', 'Last Name': 'User', Payment: '1 year', 'Payable Status': 'Paid', Processed: null }
      ];
      
      const membershipData = [];
      const expirySchedule = [];
      
      // Mock sendEmailFun to fail for specific email
      sendEmailFun.mockImplementation((msg) => {
        if (msg.to === 'bad@test.com') {
          throw new Error('Email delivery failed');
        }
      });
      
      const result = manager.processPaidTransactions(txns, membershipData, expirySchedule);
      
      // Should have one success and one failure audit entry
      expect(result.auditEntries.length).toBe(2);
      expect(result.errors.length).toBe(1);
      
      const successEntry = result.auditEntries.find(e => e.Outcome === 'success');
      const failEntry = result.auditEntries.find(e => e.Outcome === 'fail');
      
      expect(successEntry).toBeDefined();
      expect(failEntry).toBeDefined();
      expect(failEntry.Type).toBe('ProcessTransaction');
      expect(failEntry.Note).toContain('Failed to process transaction for bad@test.com');
      expect(failEntry.Error).toContain('Email delivery failed');
    });
  });

  describe('Audit entry schema validation', () => {
    it('all audit entries have required fields: Type, Outcome, Note/Error, Timestamp', () => {
      const txns = [
        { 'Email Address': 'test@test.com', 'First Name': 'Test', 'Last Name': 'User', Payment: '1 year', 'Payable Status': 'Paid', Processed: null }
      ];
      
      const membershipData = [];
      const expirySchedule = [];
      
      const result = manager.processPaidTransactions(txns, membershipData, expirySchedule);
      
      expect(result.auditEntries.length).toBeGreaterThan(0);
      
      result.auditEntries.forEach(entry => {
        expect(entry.Type).toBeDefined();
        expect(entry.Outcome).toBeDefined();
        expect(entry.Outcome).toMatch(/^(success|fail)$/);
        expect(entry.Timestamp).toBeDefined();
        
        // Either Note or Error must be present
        expect(entry.Note || entry.Error).toBeDefined();
      });
    });
  });
});
