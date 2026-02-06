const { MembershipManagement } = require('../src/services/MembershipManagement/Manager');
// Import flat classes (no namespace nesting)
const AuditLogEntry = require('../src/common/audit/AuditLogEntry');
const AuditLogger = require('../src/common/audit/AuditLogger');
const { ValidatedMember } = require('../src/common/data/ValidatedMember');
const { ValidatedTransaction } = require('../src/common/data/ValidatedTransaction');
const { MemberPersistence } = require('../src/common/data/MemberPersistence');
const utils = MembershipManagement.Utils;

// @ts-check
// Some parts of the code (and GAS templates) reference PREFILL_FORM_TEMPLATE as a global.
// Define a harmless default for tests to avoid ReferenceErrors. Tests can override if needed.
const PREFILL_FORM_TEMPLATE = 'https://docs.google.com/forms/d/e/1FAIpQLSd1HNA6BbcJhBmYuSs6aJINbKfxlEyfklWanTgFC0TQ-0cmtg/viewform?usp=pp_url&entry.1981419329=Yes&entry.942593962=I+have+read+the+privacy+policy&entry.147802975=I+Agree&entry.1934601261=Share+Name&entry.1934601261=Share+Email&entry.1934601261=Share+Phone&entry.617015365={First}&entry.1319508840={Last}&entry.1099404401={Phone}';

// ============================================================================
// TABLE OF CONTENTS - Organized by Member Lifecycle
// ============================================================================
// Line ~50:  Structure Tests
// Line ~60:  Manager tests (setup)
//
// MEMBER ONBOARDING FLOW:
// Line ~220: processPaidTransactions - New member joins & renewals
// Line ~420: processMigrations - Migrate members from old system
//
// MEMBER EXPIRATION FLOW:
// Line ~620: generateExpiringMembersList - Generate expiry notifications
// Line ~770: processExpiredMembers - Process expired members (email & group removal)
//
// SUPPORTING FUNCTIONS:
// Line ~820: expirySchedule management - Schedule creation/updates
// Line ~890: Utility functions - convertJoinToRenew, similarity, findPossibleRenewals
// ============================================================================

// ============================================================================
// TEST DATA FACTORY FUNCTIONS
// ============================================================================
// Factory functions provide sensible defaults with the ability to override
// specific fields. This keeps tests DRY while maintaining readability.
// ============================================================================

const TestData = {
  /**
   * Create a FIFOItem with defaults that can be overridden
   * @param {Partial<MembershipManagement.FIFOItem>} overrides - Fields to override
   * @returns {MembershipManagement.FIFOItem}
   */
  fifoItem(overrides = {}) {
    return {
      id: 'test-id',
      email: 'test@example.com',
      subject: 'Test Subject',
      htmlBody: 'Test Body',
      groups: '',
      attempts: 0,
      lastAttemptAt: '',
      lastError: '',
      nextAttemptAt: '',
      ...overrides
    };
  },

  /**
   * Create an ExpiredMember with defaults that can be overridden
   * @param {Partial<MembershipManagement.ExpiredMember>} overrides
   * @returns {MembershipManagement.ExpiredMember}
   */
  expiredMember(overrides = {}) {
    return {
      email: 'test@example.com',
      subject: 'Test Subject',
      htmlBody: 'Test Body',
      groups: null,
      ...overrides
    };
  },

  /**
   * Create a paid transaction with defaults
   * @param {object} overrides
   * @returns {ValidatedTransaction}
   */
  paidTransaction(overrides = {}) {
    const defaults = {
      "Payable Status": "paid",
      "Email Address": "test@example.com",
      "First Name": "Test",
      "Last Name": "User",
      "Payment": "1 year",
      Phone: '(123) 456-7890',
      Directory: 'share name',
      Processed: null,
      Timestamp: null
    };
    const data = { ...defaults, ...overrides };
    
    // Convert string dates to Date objects for ValidatedTransaction
    const processed = data.Processed ? (typeof data.Processed === 'string' ? new Date(data.Processed) : data.Processed) : null;
    const timestamp = data.Timestamp ? (typeof data.Timestamp === 'string' ? new Date(data.Timestamp) : data.Timestamp) : null;
    
    return new ValidatedTransaction(
      data["Email Address"],
      data["First Name"],
      data["Last Name"],
      data.Phone,
      data.Payment,
      data.Directory,
      data["Payable Status"],
      processed,
      timestamp
    );
  },

  /**
   * Create an active member with defaults
   * @param {object} overrides
   */
  activeMember(overrides = {}) {
    return {
      Status: 'Active',
      Email: 'test@example.com',
      Period: 1,
      First: 'Test',
      Last: 'User',
      Joined: '2024-01-01',
      Expires: '2025-01-01',
      'Renewed On': '',
      Phone: '',
      'Directory Share Name': false,
      'Directory Share Email': false,
      'Directory Share Phone': false,
      ...overrides
    };
  },

  /**
   * Create an expiry schedule entry with defaults
   * @param {object} overrides
   */
  expiryScheduleEntry(overrides = {}) {
    return {
      Email: 'test@example.com',
      Type: utils.ActionType.Expiry1,
      Date: utils.dateOnly(new Date()),
      ...overrides
    };
  },

  /**
   * Create a migrator (member to be migrated from CE)
   * @param {object} overrides
   */
  migrator(overrides = {}) {
    return {
      Email: 'test@example.com',
      Period: 1,
      First: 'Test',
      Last: 'User',
      Phone: '(408) 555-1234',
      Joined: '2020-01-01',
      Expires: '2021-01-01',
      Directory: false,
      Status: 'Active',
      ...overrides
    };
  },

  /**
   * Create multiple paid transactions with sensible defaults
   * @param {number} count - Number of transactions to create
   * @returns {ValidatedTransaction[]}
   */
  paidTransactions(count = 3) {
    const names = [
      { "Email Address": "test1@example.com", "First Name": "John", "Last Name": "Doe", Phone: "(408) 386-9343" },
      { "Email Address": "test2@example.com", "First Name": "Jane", "Last Name": "Smith", Phone: "" },
      { "Email Address": "test3@example.com", "First Name": "Not", "Last Name": "Member", Phone: "" }
    ];
    return names.slice(0, count).map((name, i) => 
      TestData.paidTransaction({
        ...name,
        "Payment": `${i + 1} year${i > 0 ? 's' : ''}`,
        Directory: ""
      })
    );
  }
};

const transactionsFixture = {
  unpaid: [
    TestData.paidTransaction({ "Payable Status": "unpaid", "Email Address": "test1@example.com", "First Name": "Test", "Last Name": "User1" }),
    TestData.paidTransaction({ "Payable Status": "pending", "Email Address": "test2@example.com", "First Name": "Test", "Last Name": "User2" }),
  ],
  paidAndProcessed: [
    TestData.paidTransaction({ "Payable Status": "paid", "Email Address": "test3@example.com", "First Name": "Test", "Last Name": "User3", Processed: new Date("2025-06-15") }),
  ],
  get paid() { 
    return [
      TestData.paidTransaction({ "Email Address": "test1@example.com", "First Name": "John", "Last Name": "Doe", Phone: "(408) 386-9343", Payment: '1 year', Directory: "" }),
      TestData.paidTransaction({ "Email Address": "test2@example.com", "First Name": "Jane", "Last Name": "Smith", Phone: "(123) 456-7890", Payment: "2 years", Directory: "Share Name, Share Phone" }),
      TestData.paidTransaction({ "Email Address": "test3@example.com", "First Name": "Not", "Last Name": "Member", Phone: "(098) 765-4321", Payment: "3 year", Directory: "Share Email" })
    ];
  },
  get caseInsensitive() {
    return [
      TestData.paidTransaction({ "Payable Status": "Paid", "Email Address": "test1@example.com", "First Name": "John", "Last Name": "Doe" }),
      TestData.paidTransaction({ "Payable Status": "PAID", "Email Address": "test2@example.com", "First Name": "Jane", "Last Name": "Smith", "Payment": "2 years" }),
      TestData.paidTransaction({ "Email Address": "test3@example.com", "First Name": "Not", "Last Name": "Member", "Payment": "3 year" })
    ];
  },
  get differentTerms() {
    return [
      TestData.paidTransaction({ "Email Address": "test1@example.com", "First Name": "John", "Last Name": "Doe", "Payment": "3 years" }),
      TestData.paidTransaction({ "Email Address": "test2@example.com", "First Name": "Jane", "Last Name": "Smith" }),
      TestData.paidTransaction({ "Email Address": "test3@example.com", "First Name": "Not", "Last Name": "Member", "Payment": "3 year" })
    ];
  },
  get noTerm() {
    return [
      TestData.paidTransaction({ "Email Address": "test1@example.com", "First Name": "John", "Last Name": "Doe", "Payment": "" }),
      TestData.paidTransaction({ "Email Address": "test2@example.com", "First Name": "Jane", "Last Name": "Smith", "Payment": "" }),
      TestData.paidTransaction({ "Email Address": "test3@example.com", "First Name": "Not", "Last Name": "Member", "Payment": "" })
    ];
  }
};
const actionSpecsArray = [
  { Type: 'Migrate', Subject: 'Migrate', Body: '{Email} {Last} {Directory}' },
  { Type: 'Join', Subject: 'Welcome to the club', Body: 'Welcome to the club, {First} {Last}!' },
  { Type: 'Renew', Subject: 'Renewal', Body: 'Thank you for renewing, {First} {Last}!' },
  { Type: 'Expiry1', Subject: 'First Expiry', Body: 'Your membership is expiring soon, {First} {Last}!', Offset: -10 },
  { Type: 'Expiry2', Subject: 'Second Expiry', Body: 'Your membership is expiring soon, {First} {Last}!', Offset: -5 },
  { Type: 'Expiry3', Subject: 'Third Expiry', Body: 'Your membership is expiring soon, {First} {Last}!', Offset: 0 },
  { Type: 'Expiry4', Subject: 'Final Expiry', Body: 'Your membership has expired, {First} {Last}!', Offset: 10 },
]

describe('Structure Tests,', () => {
  it('should have the expected structure', () => {
    expect(MembershipManagement).toHaveProperty('Manager');
    expect(MembershipManagement).toHaveProperty('Utils');
    expect(MembershipManagement).toHaveProperty('Utils.ActionType');
    expect(MembershipManagement).toHaveProperty('Utils.addDaysToDate');
  });
});
describe('Manager tests', () => {
  const actionSpecs = Object.fromEntries(actionSpecsArray.map(spec => [spec.Type, spec]));
  const O1 = actionSpecs.Expiry1.Offset;
  const O2 = actionSpecs.Expiry2.Offset;
  const O3 = actionSpecs.Expiry3.Offset;
  const O4 = actionSpecs.Expiry4.Offset;
  const today = utils.dateOnly("2025-03-01")
  let manager;
  let activeMembers;
  let expiredMembers;
  let expirySchedule;
  let groupManager = {};
  let groupRemoveFun;
  let sendEmailFun;
  let groups;
  let numProcessed;
  let consoleSpy;

  beforeEach(() => {
    groupManager.groupRemoveFun = jest.fn();
    groupManager.groupAddFun = jest.fn();
    groupManager.groupEmailReplaceFun = jest.fn().mockReturnValue({ success: true });
    sendEmailFun = jest.fn();
    groups = [{ Email: "a@b.com" }, { Email: "member_discussions@sc3.club" }];
    manager = new MembershipManagement.Manager(actionSpecs, groups, groupManager, sendEmailFun, today);
    activeMembers = [];
    expiredMembers = [];
    expirySchedule = [];
    numProcessed = 0;
    consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => { });
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });
  describe('generateExpiringMembersList', () => {
    beforeEach(() => {
      activeMembers = [
        TestData.activeMember({ Email: "test1@example.com", First: "John", Last: "Doe", Joined: "2020-03-10", Expires: "2021-01-10" }),
        TestData.activeMember({ Email: "test2@example.com", First: "Jane", Last: "Smith", Joined: "2020-03-10", Expires: "2021-01-10" }),
        TestData.activeMember({ Email: "test3@example.com", First: "Not", Last: "Member", Joined: "2020-03-10", Expires: "2021-01-10" }),
        TestData.activeMember({ Email: "test4@example.com", First: "Not", Last: "Member", Joined: "2020-03-10", Expires: "2021-01-10" })
      ];
      expirySchedule = [
        TestData.expiryScheduleEntry({ Date: MembershipManagement.Utils.dateOnly(new Date('2050-01-01')), Type: utils.ActionType.Expiry1, Email: "test1@example.com" }),
        TestData.expiryScheduleEntry({ Date: MembershipManagement.Utils.dateOnly(today), Type: utils.ActionType.Expiry2, Email: "test2@example.com" }),
        TestData.expiryScheduleEntry({ Date: MembershipManagement.Utils.dateOnly(new Date('2045-01-01')), Type: utils.ActionType.Expiry3, Email: "test3@example.com" }),
        TestData.expiryScheduleEntry({ Date: MembershipManagement.Utils.dateOnly(today), Type: utils.ActionType.Expiry4, Email: "test4@example.com" })
      ];
    });

    it('should do nothing if there are no members to expire', () => {
      activeMembers = [];
      const result = manager.generateExpiringMembersList(activeMembers, [expirySchedule[0], expirySchedule[2]], PREFILL_FORM_TEMPLATE);
      expect(result.messages.length).toEqual(0);
    });
    it('should do nothing if no members are ready to be expired', () => {
      const result = manager.generateExpiringMembersList(activeMembers, [expirySchedule[0], expirySchedule[2]], PREFILL_FORM_TEMPLATE);
      expect(result.messages.length).toEqual(0);
    });
    it('should generate expiring member messages with groups only for Expiry4', () => {
      const expectedExpiringMembers = [
        { email: "test4@example.com", subject: 'Final Expiry', htmlBody: 'Your membership has expired, Not Member!', groups: groups.map(g => g.Email).join(',') },
        { email: "test2@example.com", subject: 'Second Expiry', htmlBody: 'Your membership is expiring soon, Jane Smith!', groups: null }
      ];
      const result = manager.generateExpiringMembersList(activeMembers, expirySchedule, PREFILL_FORM_TEMPLATE);
      expect(result.messages).toEqual(expectedExpiringMembers);
      expect(consoleSpy).toHaveBeenCalledWith("Expiry4 - test4@example.com");
      expect(consoleSpy).toHaveBeenCalledWith("Expiry2 - test2@example.com");
    })

    it('should log if a member to be expired isnt active', () => {
      activeMembers[0].Status = 'Inactive';
      expirySchedule = [
        { Date: today, Type: utils.ActionType.Expiry1, Email: "test1@example.com" },
      ]
      manager.generateExpiringMembersList(activeMembers, expirySchedule, PREFILL_FORM_TEMPLATE);
      expect(consoleSpy).toHaveBeenCalledWith("Skipping member test1@example.com - they're not an active member");
    })
    it('should remove the expiry schedule even if the member cannot be expired', () => {
      const expectedExpirySchedule = expirySchedule.filter(e => e.Date > new Date(today)).map(e => { return { ...e } });
      manager.generateExpiringMembersList(activeMembers, expirySchedule, PREFILL_FORM_TEMPLATE);
      expect(expirySchedule).toEqual(expectedExpirySchedule);
    })
    it('should process just the first entry if only one is due', () => {
      activeMembers = [
        TestData.activeMember({ Email: "a@b.com", First: "John", Last: "Doe", Joined: "2020-03-10", Expires: "2026-11-14" }),
      ];
      expirySchedule = [
        TestData.expiryScheduleEntry({ Date: today, Type: utils.ActionType.Expiry1, Email: "a@b.com" }),
        TestData.expiryScheduleEntry({ Date: utils.addDaysToDate(today, 5), Type: utils.ActionType.Expiry2, Email: "a@b.com" }),
      ];
      const expectedActiveMembers = [
        TestData.activeMember({ Email: "a@b.com", First: "John", Last: "Doe", Joined: "2020-03-10", Expires: "2026-11-14" }),
      ];
      const expectedExpirySchedule = [
        TestData.expiryScheduleEntry({ Date: utils.addDaysToDate(today, 5), Type: utils.ActionType.Expiry2, Email: "a@b.com" }),
      ];
      const result = manager.generateExpiringMembersList(activeMembers, expirySchedule, PREFILL_FORM_TEMPLATE);
      expect(expirySchedule).toEqual(expectedExpirySchedule);
      expect(activeMembers).toEqual(expectedActiveMembers);
      expect(result.messages.length).toEqual(1);
    });

    describe('multiple expiry schedules on the same day for the same address', () => {
      let expectedActiveMembers;
      beforeEach(() => {
        activeMembers = [
          TestData.activeMember({ Email: "test1@example.com", First: "John", Last: "Doe", Joined: "2020-03-10", Expires: "2021-01-10" }),
          TestData.activeMember({ Email: "test2@example.com", First: "John", Last: "Doe", Joined: "2020-03-10", Expires: "2021-01-10" }),
        ];
        expirySchedule = [
          TestData.expiryScheduleEntry({ Date: today, Type: utils.ActionType.Expiry2, Email: "test1@example.com" }),
          TestData.expiryScheduleEntry({ Date: today, Type: utils.ActionType.Expiry4, Email: "test1@example.com" }),
          TestData.expiryScheduleEntry({ Date: '2099-10-10', Type: utils.ActionType.Expiry2, Email: "test2@example.com" })
        ];
      })
      it('should count both schedules as having been processed', () => {
        const result = manager.generateExpiringMembersList(activeMembers, expirySchedule, PREFILL_FORM_TEMPLATE);
        // generator returns one message per unique email processed
        expect(result.messages.length).toEqual(1);
      })
      it('should log the anomaly', () => {
        manager.generateExpiringMembersList(activeMembers, expirySchedule, PREFILL_FORM_TEMPLATE);
        expect(consoleSpy).toHaveBeenCalledWith("Skipping test1@example.com for Expiry2 - already processed");
      })
      it('should process only the latest expiry', () => {
        expectedActiveMembers = [
          { ...activeMembers[0], Status: 'Expired' },
          { ...activeMembers[1], Status: 'Active' }
        ];
        manager.generateExpiringMembersList(activeMembers, expirySchedule, PREFILL_FORM_TEMPLATE);
        expect(activeMembers).toEqual(expectedActiveMembers);
      })
    });
    describe('Expiry4 processing', () => {
      let expectedActiveMembers;
      beforeEach(() => {
        expirySchedule = [TestData.expiryScheduleEntry({ Date: today, Type: utils.ActionType.Expiry4, Email: "test1@example.com" })];
        activeMembers = [TestData.activeMember({ Email: "test1@example.com", First: "John", Last: "Doe", Joined: "2020-03-10", Expires: "2021-01-10" })];
        expectedActiveMembers = [{ ...activeMembers[0], Status: 'Expired' }];
      });
      it('should set member status to Expired and add them to all groups for removal', () => {
        const result = manager.generateExpiringMembersList(activeMembers, expirySchedule, PREFILL_FORM_TEMPLATE);
        
        // Status changed to Expired
        expect(activeMembers).toEqual(expectedActiveMembers);
        
        // Groups list populated for removal
        expect(result.messages.length).toBe(1);
        expect(result.messages[0].groups).toEqual(groups.map(g => g.Email).join(','));
      })
    });
  });
  describe('processExpiredMembers', () => {
    beforeEach(() => {
      expiredMembers = /** @type {MembershipManagement.FIFOItem[]} */[
        TestData.fifoItem({ id: 'id1', email: "test1@example.com", subject: "Subject 1", htmlBody: "Body 1", groups: groups.map(g => g.Email).join(',') }),
        TestData.fifoItem({ id: 'id2', email: "test2@example.com", subject: "Subject 2", htmlBody: "Body 2" })
      ];
    })
    describe('successful processing', () => {
      it('should do nothing if there are no expired members', () => {
        const res = manager.processExpiredMembers([], sendEmailFun, groupManager.groupRemoveFun);
        expect(res.processed.length).toBe(0);
        expect(res.failed.length).toBe(0);
        expect(sendEmailFun).not.toHaveBeenCalled();
        expect(groupManager.groupRemoveFun).not.toHaveBeenCalled();
      })
      it('should send emails to the expired members', () => {
        const expectedMsgs = expiredMembers.map(em => { return { to: em.email, subject: em.subject, htmlBody: em.htmlBody } });
        const res = manager.processExpiredMembers(expiredMembers, sendEmailFun, groupManager.groupRemoveFun);
        expect(res.processed.length).toBe(2);
        expect(res.failed.length).toBe(0);
        expect(sendEmailFun).toHaveBeenCalledTimes(2);
        expect(sendEmailFun).toHaveBeenNthCalledWith(1, expectedMsgs[0]);
        expect(sendEmailFun).toHaveBeenNthCalledWith(2, expectedMsgs[1]);
      })
      it('should remove members from their groups', () => {
        manager.processExpiredMembers(expiredMembers, sendEmailFun, groupManager.groupRemoveFun);
        expect(groupManager.groupRemoveFun).toHaveBeenCalledTimes(2);
        expect(groupManager.groupRemoveFun).toHaveBeenNthCalledWith(1, expiredMembers[0].email, groups[1].Email);
        expect(groupManager.groupRemoveFun).toHaveBeenNthCalledWith(2, expiredMembers[0].email, groups[0].Email);
      })
      it('should generate audit entries for successful processing', () => {
        // Create a manager with an audit logger
        const auditLogger = new AuditLogger(today);
        const managerWithAudit = new MembershipManagement.Manager(actionSpecs, groups, groupManager, sendEmailFun, today, auditLogger);
        
        const res = managerWithAudit.processExpiredMembers(expiredMembers, sendEmailFun, groupManager.groupRemoveFun);
        expect(res.processed.length).toBe(2);
        expect(res.auditEntries).toBeDefined();
        expect(res.auditEntries.length).toBe(2);
        expect(res.auditEntries[0]).toMatchObject({
          Type: 'ProcessExpiredMember',
          Outcome: 'success',
          Note: expect.stringContaining('Successfully processed expiration for test1@example.com')
        });
        expect(res.auditEntries[1]).toMatchObject({
          Type: 'ProcessExpiredMember',
          Outcome: 'success',
          Note: expect.stringContaining('Successfully processed expiration for test2@example.com')
        });
      })
    });
    describe('input validation and error handling', () => {
      it('should throw an error if the first argument is not an array', () => {
        expect(() => {
          manager.processExpiredMembers(null, sendEmailFun, groupManager.groupRemoveFun);
        }).toThrow('fifoItems must be an array');
      });
      it('should throw an error if the second argument is not a function', () => {
        expect(() => {
          manager.processExpiredMembers(expiredMembers, null, groupManager.groupRemoveFun);
        }).toThrow('sendEmailFun must be a function');
      });
      it('should throw an error if the third argument is not a function', () => {
        expect(() => {
          manager.processExpiredMembers(expiredMembers, sendEmailFun, null);
        }).toThrow('groupRemoveFun must be a function');
      });
      it('should record email sending failures with error details and attempt count', () => {
        sendEmailFun = jest.fn((m) => { if (m.to === 'test1@example.com') throw new Error('email') });
        const results = manager.processExpiredMembers(expiredMembers, sendEmailFun, groupManager.groupRemoveFun);
        
        expect(results.processed.length).toBe(1);
        expect(results.failed.length).toBe(1);
        
        const failedItem = results.failed[0];
        expect(failedItem.id).toBe('id1');
        expect(failedItem.email).toBe('test1@example.com');
        expect(failedItem.attempts).toBe(1);
        expect(failedItem.lastError).toBe('Error: email');
        expect(failedItem.groups).toBe(groups.map(g => g.Email).join(','));
      })
      it('should preserve reduced groups list on partial success so retry does not re-attempt removed groups', () => {
        // Set up: 3 groups, second group fails
        const threeGroups = [{ Email: "group1@sc3.club" }, { Email: "group2@sc3.club" }, { Email: "group3@sc3.club" }];
        const member = TestData.fifoItem({
          groups: threeGroups.map(g => g.Email).join(',')
        });
        
        // Email succeeds, but group removal fails on group2 (the middle one, processed backward)
        groupManager.groupRemoveFun = jest.fn((email, groupEmail) => { 
          if (groupEmail === 'group2@sc3.club') throw new Error('group removal failed') 
        });
        
        const results = manager.processExpiredMembers([member], sendEmailFun, groupManager.groupRemoveFun);
        
        expect(results.processed.length).toBe(0);
        expect(results.failed.length).toBe(1);
        
        // Verify group removal was attempted backward: group3, then group2 (failed)
        expect(groupManager.groupRemoveFun).toHaveBeenCalledTimes(2);
        expect(groupManager.groupRemoveFun).toHaveBeenNthCalledWith(1, 'test@example.com', 'group3@sc3.club');
        expect(groupManager.groupRemoveFun).toHaveBeenNthCalledWith(2, 'test@example.com', 'group2@sc3.club');
        
        const failedItem = results.failed[0];
        // Critical assertion: groups should be reduced to only group1,group2 (group3 was successfully removed)
        expect(failedItem.groups).toBe('group1@sc3.club,group2@sc3.club');
        expect(failedItem.attempts).toBe(1);
        expect(failedItem.lastError).toBe('Error: group removal failed');
      })
    });

    describe('email skipping when subject or htmlBody missing', () => {
      it('should skip email sending when subject is missing but still process groups', () => {
        const member = TestData.fifoItem({
          subject: '',
          htmlBody: 'Body text',
          groups: groups.map(g => g.Email).join(',')
        });
        
        const results = manager.processExpiredMembers([member], sendEmailFun, groupManager.groupRemoveFun);
        
        expect(sendEmailFun).not.toHaveBeenCalled();
        expect(groupManager.groupRemoveFun).toHaveBeenCalledTimes(2);
        expect(results.processed.length).toBe(1);
        expect(results.failed.length).toBe(0);
      });

      it('should skip email sending when htmlBody is missing but still process groups', () => {
        const member = TestData.fifoItem({
          subject: 'Subject text',
          htmlBody: '',
          groups: groups.map(g => g.Email).join(',')
        });
        
        const results = manager.processExpiredMembers([member], sendEmailFun, groupManager.groupRemoveFun);
        
        expect(sendEmailFun).not.toHaveBeenCalled();
        expect(groupManager.groupRemoveFun).toHaveBeenCalledTimes(2);
        expect(results.processed.length).toBe(1);
        expect(results.failed.length).toBe(0);
      });

      it('should skip email sending when both subject and htmlBody are missing', () => {
        const member = TestData.fifoItem({
          subject: '',
          htmlBody: '',
          groups: groups.map(g => g.Email).join(',')
        });
        
        const results = manager.processExpiredMembers([member], sendEmailFun, groupManager.groupRemoveFun);
        
        expect(sendEmailFun).not.toHaveBeenCalled();
        expect(groupManager.groupRemoveFun).toHaveBeenCalledTimes(2);
        expect(results.processed.length).toBe(1);
        expect(results.failed.length).toBe(0);
      });

      it('should process member without groups when email fields are missing', () => {
        const member = TestData.fifoItem({
          subject: '',
          htmlBody: '',
          groups: ''
        });
        
        const results = manager.processExpiredMembers([member], sendEmailFun, groupManager.groupRemoveFun);
        
        expect(sendEmailFun).not.toHaveBeenCalled();
        expect(groupManager.groupRemoveFun).not.toHaveBeenCalled();
        expect(results.processed.length).toBe(1);
        expect(results.failed.length).toBe(0);
      });

      it('should send email when both subject and htmlBody are present', () => {
        const member = TestData.fifoItem({
          subject: 'Test Subject',
          htmlBody: 'Test Body'
        });
        
        const results = manager.processExpiredMembers([member], sendEmailFun, groupManager.groupRemoveFun);
        
        expect(sendEmailFun).toHaveBeenCalledTimes(1);
        expect(sendEmailFun).toHaveBeenCalledWith({
          to: member.email,
          subject: 'Test Subject',
          htmlBody: 'Test Body'
        });
        expect(results.processed.length).toBe(1);
        expect(results.failed.length).toBe(0);
      });
    });

    describe('audit trail', () => {
      it('should generate audit entries for dead letter failures', () => {
        const auditLogger = new AuditLogger(today);
        const managerWithAudit = new MembershipManagement.Manager(actionSpecs, groups, groupManager, sendEmailFun, today, auditLogger);
        
        sendEmailFun.mockImplementation(() => { throw new Error('Email service down'); });
        
        const member = TestData.fifoItem({
          id: 'test-id-1',
          email: 'fail@example.com',
          subject: 'Test',
          htmlBody: 'Body',
          attempts: 4  // Will fail on 5th attempt and go to dead letter
        });
        
        const results = managerWithAudit.processExpiredMembers([member], sendEmailFun, groupManager.groupRemoveFun, { maxAttempts: 5 });
        
        expect(results.failed.length).toBe(1);
        expect(results.failed[0].dead).toBe(true);
        expect(results.auditEntries).toBeDefined();
        expect(results.auditEntries.length).toBe(1);
        expect(results.auditEntries[0]).toMatchObject({
          Type: 'DeadLetter',
          Outcome: 'fail',
          Note: expect.stringContaining('Failed to process expiration for fail@example.com after 5 attempts')
        });
      });
    });
  });

  describe('processMigrations', () => {
    describe('Active Members only', () => {
      let migrators;
      let migratorsPre;
      let migratorsPost;
      let expectedMigrators;
      let members;
      let expectedMembers;
      beforeEach(() => {
        migrators = [
          TestData.migrator({
            Email: "a@b.com", First: "John", Last: "Doe", Phone: '(408) 386-9343', Joined: "2020-03-10", Expires: "2021-01-10", Directory: true, "Migrate Me": true,
            "board_announcements@sc3.club": false, "member_discussions@sc3.club": true
          }),
          TestData.migrator({ Email: "a@b.com", First: "Not", Last: "Me", Phone: '(408) 386-9343', Joined: "2020-03-10", Expires: "2021-01-10", Directory: true })
        ];
      });
      it('should migrate only marked members, record the date of migration and removing any unused keys', () => {
        const expectedMigrators = [{ ...migrators[0], Migrated: today }, { ...migrators[1] }];
        const m = { ...migrators[0], Migrated: today, Directory: 'Yes' };
        delete m["Migrate Me"];
        delete m["board_announcements@sc3.club"];
        delete m["member_discussions@sc3.club"]
        const expectedMembers = [m];
        manager.migrateCEMembers(migrators, activeMembers, expirySchedule);
        expect(activeMembers).toEqual(expectedMembers);
        expect(migrators).toEqual(expectedMigrators);
      });
      it('should not migrate members if an error is thrown', () => {
        groupManager.groupAddFun = jest.fn(() => { throw new Error('This is a test error') });
        manager = new MembershipManagement.Manager(actionSpecs, groups, groupManager, sendEmailFun, today);
        const result = manager.migrateCEMembers(migrators, activeMembers, expirySchedule);
        
        // Should return errors instead of throwing
        expect(result.errors).toBeDefined();
        expect(result.errors.length).toBeGreaterThan(0);
        
        // Member should not be added to activeMembers when there's an error
        expect(activeMembers).toEqual([]);
      });
      it('should not migrate members that have already been migrated', () => {
        migrators = [{ ...migrators[0], Migrated: today }];
        manager.migrateCEMembers(migrators, activeMembers, expirySchedule);
        expect(activeMembers).toEqual([]);
      });
      it('should not migrate members who have no email address, & log that fact', () => {
        const m = { ...migrators[0] };
        delete m.Email
        migratorsPre = [{ ...m }];
        migratorsPost = [{ ...m }];
        manager.migrateCEMembers(migratorsPre, activeMembers, expirySchedule);
        expect(migratorsPost).toEqual(migratorsPre)
        expect(activeMembers).toEqual([]);
        expect(expirySchedule).toEqual([]);
        expect(consoleSpy).toHaveBeenCalledWith(`Skipping row 2, no email address`);
      });
      it('should migrate expired members, and log the fact', () => {
        let members = [TestData.activeMember({ Email: "a@b.com", First: "John", Last: "Doe", Phone: '(408) 386-9343', Joined: "1900-03-10", Expires: "1901-01-10", Status: "Expired" })];
        // Override Directory to match old behavior for test
        members[0].Directory = 'Yes';
        migrators = [
          TestData.migrator({
            Email: "a@b.com", First: "John", Last: "Doe", Phone: '(408) 386-9343', Joined: "2020-03-10", Expires: "2021-01-10", Directory: true, "Migrate Me": true,
            "board_announcements@sc3.club": false, "member_discussions@sc3.club": true
          }),
        ];
        let expectedMigrators = [{ ...migrators[0], Migrated: today }];
        let expectedMembers = [members[0],
        { Email: "a@b.com", Period: 1, First: "John", Last: "Doe", Phone: '(408) 386-9343', Joined: "2020-03-10", Expires: "2021-01-10", Directory: 'Yes', Migrated: today, Status: "Active" }
        ];
        manager.migrateCEMembers(migrators, members, expirySchedule);
        expect(migrators).toEqual(expectedMigrators);
        expect(members).toEqual(expectedMembers);
        expect(groupManager.groupAddFun).toHaveBeenCalledTimes(1);
      });
      it('should not migrate members that are already recorded as being active, and log the fact', () => {
        members = [TestData.activeMember({ Email: "a@b.com", First: "John", Last: "Doe", Phone: '(408) 386-9343', Joined: "1900-03-10", Expires: "1901-01-10" })];
        members[0].Directory = 'Yes';
        migrators = [
          TestData.migrator({
            Email: "a@b.com", First: "John", Last: "Doe", Phone: '(408) 386-9343', Joined: "2020-03-10", Expires: "2021-01-10", Directory: true, "Migrate Me": true,
            "board_announcements@sc3.club": false, "member_discussions@sc3.club": true
          }),
        ];
        expectedMigrators = [{ ...migrators[0] }];
        expectedMembers = [{ ...members[0] }];
        manager.migrateCEMembers(migrators, members, expirySchedule);
        expect(migrators).toEqual(expectedMigrators);
        expect(members).toEqual(expectedMembers);
        expect(consoleSpy).toHaveBeenCalledWith(`Skipping ${migrators[0].Email} on row 2, already an active member`);
      });

      describe('expiry Schedule ', () => {
        it('should create an action schedule for the migrated member for events after today', () => {
          migrators = [{ ...migrators[0], Expires: utils.addDaysToDate(today, 1) }]; // expiry 2 is today, so only expiry 3 & 4 expected
          manager.migrateCEMembers(migrators, activeMembers, expirySchedule);
          expect(expirySchedule.length).toEqual(2);
        });
      })

      it('should add migrated members to groups in keys', () => {
        manager.migrateCEMembers(migrators, activeMembers, expirySchedule);
        expect(groupManager.groupAddFun).toHaveBeenCalledTimes(1);
        expect(groupManager.groupAddFun).toHaveBeenCalledWith(migrators[0].Email, "member_discussions@sc3.club");
      });

      it('should send emails to the members', () => {
        manager.migrateCEMembers(migrators, activeMembers, expirySchedule);
        expect(sendEmailFun).toHaveBeenCalledTimes(1);
        const m = { ...migrators[0], Directory: migrators[0].Directory ? 'Yes' : 'No' };
        expect(sendEmailFun).toHaveBeenCalledWith({ to: m.Email, subject: utils.expandTemplate(actionSpecs.Migrate.Subject, m), htmlBody: utils.expandTemplate(actionSpecs.Migrate.Body, m) });
      });

      it('should provide logging information', () => {
        manager.migrateCEMembers(migrators, activeMembers, expirySchedule);
        expect(consoleSpy).toHaveBeenCalledWith("Migrating Active member a@b.com, row 2 - joining groups and sending member an email")
        expect(consoleSpy).toHaveBeenCalledWith('Migrated a@b.com, row 2');
      });

      it('should continue even when there are errors', () => {
        groupManager.groupAddFun = jest.fn(() => { throw new Error('This is a test error') });
        manager = new MembershipManagement.Manager(actionSpecs, groups, groupManager, sendEmailFun, today);
        const result = manager.migrateCEMembers(migrators, activeMembers, expirySchedule);
        
        // Should return errors array instead of throwing
        expect(result.errors).toBeDefined();
        expect(result.errors.length).toEqual(1);
        expect(result.errors[0].message).toBe('This is a test error');
        expect(result.errors[0].rowNum).toBe(2);
        expect(result.errors[0].email).toBe("a@b.com");
        
        // Should still provide auditEntries even when there are errors
        expect(result.auditEntries).toBeDefined();
      });

      it('should indicate how many members were successfully migrated', () => {
        const result = manager.migrateCEMembers(migrators, activeMembers, expirySchedule);
        expect(result.numMigrations).toBe(1);
        expect(result.errors).toBeDefined();
        expect(result.errors.length).toBe(0);
      });
    });
    describe('Inactive Members', () => {
      let migrators;
      beforeEach(() => {
        migrators = [
          TestData.migrator({ Email: "a@b.com", First: "John", Last: "Doe", Phone: '(408) 386-9343', Joined: "2020-03-10", Expires: "2021-01-10", Directory: true, "Migrate Me": true, Status: "Expired" }),
          TestData.migrator({ Email: "a@b.com", First: "Not", Last: "Me", Phone: '(408) 386-9343', Joined: "2020-03-10", Expires: "2021-01-10", Directory: true, Status: "Expired" })
        ];
      });
      it('should migrate expired members without groups, emails, or expiry schedules', () => {
        const expectedMigrators = [{ ...migrators[0], Migrated: today }, { ...migrators[1] }];
        const m = { ...migrators[0], Migrated: today, Directory: 'Yes' };
        delete m["Migrate Me"];
        const expectedMembers = [m];
        
        manager.migrateCEMembers(migrators, activeMembers, expirySchedule);
        
        // Records migration but strips unnecessary fields
        expect(activeMembers).toEqual(expectedMembers);
        expect(migrators).toEqual(expectedMigrators);
        
        // No expiry schedule for expired members
        expect(expirySchedule).toEqual([]);
        
        // No groups added
        expect(groupManager.groupAddFun).toHaveBeenCalledTimes(0);
        
        // No emails sent
        expect(sendEmailFun).toHaveBeenCalledTimes(0);
        
        // Logs appropriate message
        expect(consoleSpy).toHaveBeenCalledWith('Migrating Inactive member a@b.com, row 2 - no groups will be joined or emails sent');
      });
    });

    describe('audit trail', () => {
      it('should generate audit entries for successful migrations', () => {
        const auditLogger = new AuditLogger(today);
        const managerWithAudit = new MembershipManagement.Manager(actionSpecs, groups, groupManager, sendEmailFun, today, auditLogger);
        
        const migrators = [
          TestData.migrator({ Email: "member1@example.com", "Migrate Me": true, Status: "Active" }),
          TestData.migrator({ Email: "member2@example.com", "Migrate Me": true, Status: "Active" })
        ];
        
        const result = managerWithAudit.migrateCEMembers(migrators, activeMembers, expirySchedule);
        
        expect(result.auditEntries).toBeDefined();
        expect(result.auditEntries.length).toBe(2);
        expect(result.auditEntries[0]).toMatchObject({
          Type: 'Migrate',
          Outcome: 'success',
          Note: expect.stringContaining('Member migrated: member1@example.com')
        });
      });
      
      it('should generate audit entries for migration failures', () => {
        const auditLogger = new AuditLogger(today);
        groupManager.groupAddFun = jest.fn(() => { throw new Error('Group service error'); });
        const managerWithAudit = new MembershipManagement.Manager(actionSpecs, groups, groupManager, sendEmailFun, today, auditLogger);
        
        const migrators = [TestData.migrator({ 
          Email: "fail@example.com", 
          "Migrate Me": true, 
          Status: "Active",
          "member_discussions@sc3.club": true  // Add a group key so groupAddFun gets called
        })];
        
        const result = managerWithAudit.migrateCEMembers(migrators, activeMembers, expirySchedule);
        
        // Should return errors instead of throwing
        expect(result.errors).toBeDefined();
        expect(result.errors.length).toBe(1);
        
        // Should still generate audit entries for failures
        expect(result.auditEntries).toBeDefined();
        expect(result.auditEntries.length).toBe(1);
        expect(result.auditEntries[0]).toMatchObject({
          Type: 'Migrate',
          Outcome: 'fail',
          Note: expect.stringContaining('Failed to migrate fail@example.com')
        });
      });
    });
  });

  describe('processPaidTransactions', () => {
    describe('basic tests', () => {
      it('should create the new members', () => {
        const txns = transactionsFixture.paid.map(t => { return { ...t } }) // clone the array
        const expectedMembers = [
          { Email: "test1@example.com", Period: 1, First: "John", Last: "Doe", Phone: "(408) 386-9343", Joined: today, Expires: utils.addYearsToDate(today, 1), "Renewed On": null, Status: "Active", "Directory Share Name": false, "Directory Share Email": false, "Directory Share Phone": false },
          { Email: "test2@example.com", Period: 2, First: "Jane", Last: "Smith", Phone: '(123) 456-7890', Joined: today, Expires: utils.addYearsToDate(today, 2), "Renewed On": null, Status: "Active", "Directory Share Name": true, "Directory Share Email": false, "Directory Share Phone": true },
          { Email: "test3@example.com", Period: 3, First: "Not", Last: "Member", Phone: '(098) 765-4321', Joined: today, Expires: utils.addYearsToDate(today, 3), "Renewed On": null, Status: "Active", "Directory Share Name": false, "Directory Share Email": true, "Directory Share Phone": false }]

        manager.processPaidTransactions(txns, activeMembers, expirySchedule,);
        expect(activeMembers.length).toEqual(3)
        expect(activeMembers).toEqual(expectedMembers);
      });
      it('should return status flags indicating changes and pending payments', () => {
        // Empty transactions - no changes, no pending
        let result = manager.processPaidTransactions([], activeMembers, expirySchedule);
        expect(result.recordsChanged).toBe(false);
        expect(result.hasPendingPayments).toBe(false);
        expect(result.errors).toEqual([]);

        // Paid transactions - changes made, no pending
        const paidTxns = transactionsFixture.paid.map(t => ({ ...t }));
        result = manager.processPaidTransactions(paidTxns, activeMembers, expirySchedule);
        expect(result.recordsChanged).toBe(true);
        expect(result.hasPendingPayments).toBe(false);

        // Unpaid transactions - no changes, has pending
        activeMembers = [];
        expirySchedule = [];
        const unpaidTxns = transactionsFixture.unpaid.map(t => ({ ...t }));
        result = manager.processPaidTransactions(unpaidTxns, activeMembers, expirySchedule);
        expect(result.recordsChanged).toBe(false);
        expect(result.hasPendingPayments).toBe(true);

        // Already processed - no changes, no pending
        activeMembers = [];
        expirySchedule = [];
        const processedTxns = transactionsFixture.paidAndProcessed.map(t => ({ ...t }));
        result = manager.processPaidTransactions(processedTxns, activeMembers, expirySchedule);
        expect(result.recordsChanged).toBe(false);
        expect(result.hasPendingPayments).toBe(false);
      });
      it('should handle membership renewals for active members', () => {
        const txns = [TestData.paidTransaction({ "Email Address": "test1@example.com", "First Name": "John", "Last Name": "Doe", "Directory": "Share Email", Phone: '(123) 456-7890' })]
        const members = [TestData.activeMember({ Email: "test1@example.com", First: "John", Last: "Doe", Joined: "2024-03-10", Expires: "2025-03-10" })]
        const expectedMembers = [
          { Email: "test1@example.com", Period: 1, First: "John", Last: "Doe", Phone: '(123) 456-7890', Joined: "2024-03-10", Expires: utils.addYearsToDate("2025-03-10", 1), "Renewed On": today, Status: "Active", "Directory Share Email": true, "Directory Share Name": false, "Directory Share Phone": false },
        ]
        manager.processPaidTransactions(txns, members, expirySchedule,);
        expect(members.length).toEqual(1)
        expect(members).toEqual(expectedMembers);
      });
      it('should treat a renewal for a member with an expired membership as a new member', () => {
        const txns = [TestData.paidTransaction({ "Email Address": "test1@example.com", "First Name": "John", "Last Name": "Doe", "Directory": "Share Email" })]
        const members = [TestData.activeMember({ Email: "test1@example.com", First: "John", Last: "Doe", Joined: "2024-03-10", Expires: "2025-03-10", Status: "Expired", Phone: '(123) 456-7890' })]
        const expectedMembers = [
          { Email: "test1@example.com", Period: 1, First: "John", Last: "Doe", Joined: "2024-03-10", Expires: "2025-03-10", "Renewed On": "", Status: "Expired", Phone: '(123) 456-7890', "Directory Share Name": false, "Directory Share Email": false, "Directory Share Phone": false },
          { Email: "test1@example.com", Period: 1, First: "John", Last: "Doe", Joined: today, Expires: utils.addYearsToDate(today, 1), "Renewed On": null, Status: "Active", Phone: '(123) 456-7890', "Directory Share Name": false, "Directory Share Email": true, "Directory Share Phone": false },
        ]
        manager.processPaidTransactions(txns, members, expirySchedule,);
        expect(members).toEqual(expectedMembers);
      })
    });

    describe('group and email handling', () => {
      it('should add new members to groups and send join emails', () => {
        const txns = [TestData.paidTransaction({ "Email Address": "test1@example.com", "First Name": "John", "Last Name": "Doe" })]
        manager.processPaidTransactions(txns, activeMembers, expirySchedule,);
        
        // Added to all groups
        expect(groupManager.groupAddFun).toHaveBeenCalledTimes(2);
        expect(groupManager.groupAddFun).toHaveBeenCalledWith("test1@example.com", "a@b.com");
        expect(groupManager.groupAddFun).toHaveBeenCalledWith("test1@example.com", "member_discussions@sc3.club");
        
        // Join email sent
        expect(sendEmailFun).toHaveBeenCalledTimes(1);
        expect(sendEmailFun).toHaveBeenCalledWith({
          to: activeMembers[0].Email,
          subject: utils.expandTemplate(actionSpecs.Join.Subject, activeMembers[0]),
          htmlBody: utils.expandTemplate(actionSpecs.Join.Body, activeMembers[0])
        });
      })

      it('should not add renewed members to groups but should send renewal emails', () => {
        const txns = [TestData.paidTransaction({ "Email Address": "test1@example.com", "First Name": "John", "Last Name": "Doe" })]
        activeMembers = [TestData.activeMember({ Email: "test1@example.com", First: "John", Last: "Doe", Joined: "2024-03-10", Expires: "2025-03-10" })]
        manager.processPaidTransactions(txns, activeMembers, expirySchedule,);
        
        // Not added to groups
        expect(groupManager.groupAddFun).toHaveBeenCalledTimes(0);
        
        // Renewal email sent
        expect(sendEmailFun).toHaveBeenCalledWith({
          to: activeMembers[0].Email,
          subject: utils.expandTemplate(actionSpecs.Renew.Subject, activeMembers[0]),
          htmlBody: utils.expandTemplate(actionSpecs.Renew.Body, activeMembers[0])
        });
        expect(sendEmailFun).toHaveBeenCalledTimes(1);
      });
    })

    describe('member information updates during renewals', () => {
      it('should update phone number when member renews with different phone', () => {
        const oldPhone = '(408) 111-1111';
        const newPhone = '(408) 222-2222';
        const txns = [TestData.paidTransaction({ 
          "Email Address": "test1@example.com", 
          "First Name": "John", 
          "Last Name": "Doe",
          Phone: newPhone
        })];
        activeMembers = [TestData.activeMember({ 
          Email: "test1@example.com", 
          First: "John", 
          Last: "Doe", 
          Phone: oldPhone,
          Joined: "2024-03-10", 
          Expires: "2025-03-10" 
        })];
        
        manager.processPaidTransactions(txns, activeMembers, expirySchedule);
        
        expect(activeMembers[0].Phone).toBe(newPhone);
        expect(activeMembers[0].Email).toBe("test1@example.com"); // Email unchanged
      });

      it('should update email when member renews with different email (same name+phone)', () => {
        const oldEmail = 'john.old@example.com';
        const newEmail = 'john.new@example.com';
        const phone = '(408) 386-9343';
        
        const txns = [TestData.paidTransaction({ 
          "Email Address": newEmail, 
          "First Name": "John", 
          "Last Name": "Doe",
          Phone: phone
        })];
        activeMembers = [TestData.activeMember({ 
          Email: oldEmail, 
          First: "John", 
          Last: "Doe", 
          Phone: phone,
          Joined: "2024-03-10", 
          Expires: "2025-03-10" 
        })];
        
        manager.processPaidTransactions(txns, activeMembers, expirySchedule);
        
        expect(activeMembers[0].Email).toBe(newEmail);
        expect(activeMembers[0].Phone).toBe(phone); // Phone unchanged
        
        // Should call groupEmailReplaceFun to update email in groups
        expect(groupManager.groupEmailReplaceFun).toHaveBeenCalledWith(oldEmail, newEmail);
      });

      it('should not match as renewal if both email AND phone are different', () => {
        const txns = [TestData.paidTransaction({ 
          "Email Address": "john.new@example.com", 
          "First Name": "John", 
          "Last Name": "Doe",
          Phone: '(408) 999-9999'  // Different phone
        })];
        activeMembers = [TestData.activeMember({ 
          Email: "john.old@example.com",  // Different email
          First: "John", 
          Last: "Doe", 
          Phone: '(408) 111-1111',  // Different phone
          Joined: "2024-03-10", 
          Expires: "2025-03-10" 
        })];
        
        const initialMemberCount = activeMembers.length;
        manager.processPaidTransactions(txns, activeMembers, expirySchedule);
        
        // Should be treated as new member (not renewal)
        expect(activeMembers.length).toBe(initialMemberCount + 1);
        expect(activeMembers[0].Email).toBe("john.old@example.com"); // Original unchanged
        expect(activeMembers[1].Email).toBe("john.new@example.com"); // New member added
        
        // Should add new member to groups
        expect(groupManager.groupAddFun).toHaveBeenCalled();
      });

      it('should update phone if transaction has different phone during renewal', () => {
        const existingPhone = '(408) 386-9343';
        const newPhone = '(555) 123-4567';
        const txns = [TestData.paidTransaction({ 
          "Email Address": "test1@example.com", 
          "First Name": "John", 
          "Last Name": "Doe",
          Phone: newPhone  // Different phone in transaction
        })];
        activeMembers = [TestData.activeMember({ 
          Email: "test1@example.com", 
          First: "John", 
          Last: "Doe", 
          Phone: existingPhone,
          Joined: "2024-03-10", 
          Expires: "2025-03-10" 
        })];
        
        manager.processPaidTransactions(txns, activeMembers, expirySchedule);
        
        expect(activeMembers[0].Phone).toBe(newPhone); // Phone updated
      });
    })

    describe('logging tests', () => {


      it('should produce interesting logs when processing transactions', () => {
        const txns = [{ ...transactionsFixture.paid[0]}, { ...transactionsFixture.paid[1]}];
        activeMembers = [{ Email: "test1@example.com", Period: 1, First: "John", Last: "Doe", Joined: "2020-03-10", Expires: "2025-03-10", "Renewed On": "", Status: 'Active' }];

        manager.processPaidTransactions(txns, activeMembers, expirySchedule,);
        expect(consoleSpy).toHaveBeenCalledWith('transaction on row 2 test1@example.com is a renewing Active member');
        expect(consoleSpy).toHaveBeenCalledWith('transaction on row 3 test2@example.com is a new member');
      });
    });
    describe('membership expiry period tests', () => {
      let txns;
      const joinDate = utils.dateOnly("2024-03-10");
      beforeEach(() => {
        txns = [{ "Payable Status": "paid", "Email Address": "test1@example.com", "First Name": "John", "Last Name": "Doe", "Payment": "1 year", Phone: "(408) 386-9343" }];
      })
      it('if renewal is before expiry then new expiry is  old expiry + period', () => {
        txns = [{ ...transactionsFixture.paid[0] }];
        activeMembers = [TestData.activeMember({ Email: "test1@example.com", First: "John", Last: "Doe", Joined: joinDate, Expires: utils.addDaysToDate(today, 10) })]
        const expectedMembers = [
          {
            Email: "test1@example.com",
            Period: 1, First: "John",
            Last: "Doe",
            Phone: '(408) 386-9343',  // Phone from transaction
            Joined: joinDate,
            Expires: utils.addYearsToDate(activeMembers[0].Expires, 1),
            "Renewed On": manager.today(),
            Status: "Active",
            "Directory Share Name": false,
            "Directory Share Email": false,
            "Directory Share Phone": false
          },
        ]
        manager.processPaidTransactions(txns, activeMembers, expirySchedule);
        expect(activeMembers).toEqual(expectedMembers);
      });

      it('if transaction comes after member expiry, creates new membership (not renewal)', () => {
        // Member expired in the past - temporal validation prevents renewal match
        activeMembers = [TestData.activeMember({ Email: "test1@example.com", First: "John", Last: "Doe", Joined: joinDate, Expires: utils.addDaysToDate(joinDate, -10), Phone: '(555) 111-1111' })]
        const expectedMembers = [
          // Original expired member unchanged
          {
            Email: "test1@example.com",
            Period: 1,
            First: "John",
            Last: "Doe",
            Phone: '(555) 111-1111',
            Joined: joinDate,
            Expires: utils.addDaysToDate(joinDate, -10),
            "Renewed On": '',
            Status: "Active",
            "Directory Share Name": false,
            "Directory Share Email": false,
            "Directory Share Phone": false
          },
          // New membership created
          {
            Email: "test1@example.com",
            Period: 1,
            First: "John",
            Last: "Doe",
            Phone: '(408) 386-9343',
            Joined: manager.today(),
            Expires: utils.addYearsToDate(manager.today(), 1),
            "Renewed On": null,
            Status: "Active",
            "Directory Share Name": false,
            "Directory Share Email": false,
            "Directory Share Phone": false
          },
        ]
        manager.processPaidTransactions(txns, activeMembers, expirySchedule);
        expect(activeMembers).toEqual(expectedMembers);
        // Should add new member to groups
        expect(groupManager.groupAddFun).toHaveBeenCalled();
      });
    })

    describe('period calculation', () => {
      let txns
      it('should return correct period for transactions with different payment terms', () => {
        const expectedMembers = [{ Email: "test1@example.com", Period: 3, first: "John", last: "Doe" },
        { Email: "test2@example.com", Period: 1, first: "Jane", last: "Smith", },
        { Email: "test3@example.com", Period: 3, first: "Not", last: "Member" }
        ];
        txns = transactionsFixture.differentTerms.map(t => { return { ...t } }) // clone the array
        manager.processPaidTransactions(txns, activeMembers, expirySchedule,);
        expect(activeMembers.map(m => m.Period)).toEqual(expectedMembers.map(m => m.Period));

      });

      it('should return period as 1 if payment term is not specified', () => {
        txns = transactionsFixture.noTerm.map(t => { return { ...t } }) // clone the array    
        manager.processPaidTransactions(txns, activeMembers, expirySchedule,);
        expect(activeMembers.map(m => m.Period)).toEqual([1, 1, 1])
      });
      describe('error handling', () => {
        it('should return errors if there are any', () => {
          const transactions = transactionsFixture.paid.map(t => { return { ...t } }) // clone the array
          sendEmailFun = jest.fn(() => { throw new Error('This is a test error') });
          manager = new MembershipManagement.Manager(actionSpecs, groups, groupManager, sendEmailFun, today);
          const { _, __, errors } = manager.processPaidTransactions(transactions, activeMembers, expirySchedule,);
          expect(errors.length).toEqual(3);
          expect(errors[0].message).toEqual('This is a test error');
        })
      });
    })
  });



  describe('expirySchedule', () => {
    it('should create an expirySchedule', () => {
      const txn = TestData.paidTransaction({ "Email Address": "test1@example.com", "First Name": "John", "Last Name": "Doe" })
      const expirySchedule = []
      const expected = [
        TestData.expiryScheduleEntry({ Email: txn["Email Address"], Type: utils.ActionType.Expiry1, Date: utils.addDaysToDate(today, 365 + O1) }),
        TestData.expiryScheduleEntry({ Email: txn["Email Address"], Type: utils.ActionType.Expiry2, Date: utils.addDaysToDate(today, 365 + O2) }),
        TestData.expiryScheduleEntry({ Email: txn["Email Address"], Type: utils.ActionType.Expiry3, Date: utils.addDaysToDate(today, 365 + O3) }),
        TestData.expiryScheduleEntry({ Email: txn["Email Address"], Type: utils.ActionType.Expiry4, Date: utils.addDaysToDate(today, 365 + O4) })
      ];
      manager.processPaidTransactions([txn], activeMembers, expirySchedule)
      expect(expirySchedule).toEqual(expected);
    })

    it('should update an existing expirySchedule', () => {
      const exp = utils.addDaysToDate(today, 60)
      const activeMembers = [TestData.activeMember({ Email: "test1@example.com", First: "John", Last: "Doe", Joined: utils.dateOnly('2021-01-01'), Expires: exp })];
      const expirySchedule = [
        TestData.expiryScheduleEntry({ Email: "test1@example.com", Type: utils.ActionType.Join, Date: today }),
        TestData.expiryScheduleEntry({ Email: "test1@example.com", Type: utils.ActionType.Expiry1, Date: utils.addDaysToDate(today, 365 + O1) }),
        TestData.expiryScheduleEntry({ Email: "test1@example.com", Type: utils.ActionType.Expiry2, Date: utils.addDaysToDate(today, 365 + O2) }),
        TestData.expiryScheduleEntry({ Email: "test1@example.com", Type: utils.ActionType.Expiry3, Date: utils.addDaysToDate(today, 365 + O3) }),
        TestData.expiryScheduleEntry({ Email: "test1@example.com", Type: utils.ActionType.Expiry4, Date: utils.addDaysToDate(today, 365 + O4) })
      ]
      const txns = [
        TestData.paidTransaction({ "Email Address": "test1@example.com", "First Name": "John", "Last Name": "Doe" }),
        TestData.paidTransaction({ "Email Address": "test2@example.com", "First Name": "Jane", "Last Name": "Smith", "Payment": "3 years" })
      ]
      const exp1 = utils.calculateExpirationDate(today, exp, 1)
      const exp3 = utils.calculateExpirationDate(today, today, 3)
      const expected = [
        { Email: "test1@example.com", Type: utils.ActionType.Expiry1, Date: utils.addDaysToDate(exp1, O1) },
        { Email: "test1@example.com", Type: utils.ActionType.Expiry2, Date: utils.addDaysToDate(exp1, O2) },
        { Email: "test1@example.com", Type: utils.ActionType.Expiry3, Date: utils.addDaysToDate(exp1, O3), },
        { Email: "test1@example.com", Type: utils.ActionType.Expiry4, Date: utils.addDaysToDate(exp1, O4), },
        { Email: "test2@example.com", Type: utils.ActionType.Expiry1, Date: utils.addDaysToDate(exp3, O1) },
        { Email: "test2@example.com", Type: utils.ActionType.Expiry2, Date: utils.addDaysToDate(exp3, O2) },
        { Email: "test2@example.com", Type: utils.ActionType.Expiry3, Date: utils.addDaysToDate(exp3, O3), },
        { Email: "test2@example.com", Type: utils.ActionType.Expiry4, Date: utils.addDaysToDate(exp3, O4), },
      ]
      manager.processPaidTransactions(txns, activeMembers, expirySchedule);
      expect(expirySchedule).toEqual(expected);
    });

    describe('audit trail', () => {
      it('should generate audit entries for successful joins', () => {
        const auditLogger = new AuditLogger(today);
        const managerWithAudit = new MembershipManagement.Manager(actionSpecs, groups, groupManager, sendEmailFun, today, auditLogger);
        
        const txns = [TestData.paidTransaction({ "Email Address": "newmember@example.com", "First Name": "New", "Last Name": "Member" })];
        
        const result = managerWithAudit.processPaidTransactions(txns, activeMembers, expirySchedule);
        
        expect(result.auditEntries).toBeDefined();
        expect(result.auditEntries.length).toBe(1);
        expect(result.auditEntries[0]).toMatchObject({
          Type: 'Join',
          Outcome: 'success',
          Note: expect.stringContaining('Member joined: newmember@example.com')
        });
      });

      it('should generate audit entries for successful renewals', () => {
        const auditLogger = new AuditLogger(today);
        const managerWithAudit = new MembershipManagement.Manager(actionSpecs, groups, groupManager, sendEmailFun, today, auditLogger);
        
        const members = [TestData.activeMember({ Email: "renewing@example.com", First: "Test", Last: "User", Expires: utils.addDaysToDate(today, 10) })];
        const txns = [TestData.paidTransaction({ "Email Address": "renewing@example.com", "First Name": "Test", "Last Name": "User" })];
        
        const result = managerWithAudit.processPaidTransactions(txns, members, expirySchedule);
        
        expect(result.auditEntries).toBeDefined();
        expect(result.auditEntries.length).toBe(1);
        expect(result.auditEntries[0]).toMatchObject({
          Type: 'Renew',
          Outcome: 'success',
          Note: expect.stringContaining('Member renewed: renewing@example.com')
        });
      });

      it('should generate audit entries for transaction processing failures', () => {
        const auditLogger = new AuditLogger(today);
        sendEmailFun.mockImplementation(() => { throw new Error('Email service down'); });
        const managerWithAudit = new MembershipManagement.Manager(actionSpecs, groups, groupManager, sendEmailFun, today, auditLogger);
        
        const txns = [TestData.paidTransaction({ "Email Address": "fail@example.com", "First Name": "Fail", "Last Name": "Test" })];
        
        const result = managerWithAudit.processPaidTransactions(txns, activeMembers, expirySchedule);
        
        expect(result.errors.length).toBe(1);
        expect(result.auditEntries).toBeDefined();
        expect(result.auditEntries.length).toBe(1);
        expect(result.auditEntries[0]).toMatchObject({
          Type: 'ProcessTransaction',
          Outcome: 'fail',
          Note: expect.stringContaining('Failed to process transaction for fail@example.com'),
          Error: expect.stringContaining('Email service down')
        });
      });

      it('should generate enhanced audit entry for renewal with email change', () => {
        const auditLogger = new AuditLogger(today);
        const managerWithAudit = new MembershipManagement.Manager(actionSpecs, groups, groupManager, sendEmailFun, today, auditLogger);
        
        // Existing member with old email
        const members = [TestData.activeMember({ 
          Status: 'Active',
          Email: "john@oldcompany.com", 
          First: "John", 
          Last: "Doe",
          Phone: "(555) 555-1234",
          Joined: utils.dateOnly("2024-01-01"),
          Expires: utils.addDaysToDate(today, 10)
        })];
        
        // Transaction with new email but same name+phone (renewal)
        const txns = [TestData.paidTransaction({ 
          "Email Address": "john@newcompany.com", 
          "First Name": "John", 
          "Last Name": "Doe",
          Phone: "(555) 555-1234",
          Payment: "1 year"
        })];
        
        const result = managerWithAudit.processPaidTransactions(txns, members, expirySchedule);
        
        // Should have exactly ONE audit entry (not two)
        expect(result.auditEntries).toBeDefined();
        expect(result.auditEntries.length).toBe(1);
        
        // Should be enhanced entry with email change details
        expect(result.auditEntries[0]).toMatchObject({
          Type: 'Renew',
          Outcome: 'success',
          Note: expect.stringContaining('Detected renewal with email change: john@oldcompany.com → john@newcompany.com (name+phone match)')
        });
        
        // Member should have updated email
        expect(members[0].Email).toBe("john@newcompany.com");
      });

      it('should generate standard audit entry for renewal without email change', () => {
        const auditLogger = new AuditLogger(today);
        const managerWithAudit = new MembershipManagement.Manager(actionSpecs, groups, groupManager, sendEmailFun, today, auditLogger);
        
        const members = [TestData.activeMember({ 
          Email: "same@example.com", 
          First: "Same", 
          Last: "Person",
          Expires: utils.addDaysToDate(today, 10)
        })];
        
        const txns = [TestData.paidTransaction({ 
          "Email Address": "same@example.com", 
          "First Name": "Same", 
          "Last Name": "Person"
        })];
        
        const result = managerWithAudit.processPaidTransactions(txns, members, expirySchedule);
        
        // Should have exactly ONE standard audit entry
        expect(result.auditEntries).toBeDefined();
        expect(result.auditEntries.length).toBe(1);
        expect(result.auditEntries[0]).toMatchObject({
          Type: 'Renew',
          Outcome: 'success',
          Note: expect.stringContaining('Member renewed: same@example.com')
        });
        
        // Should NOT mention email change
        expect(result.auditEntries[0].Note).not.toContain('email change');
      });
    });

    describe('renewal detection using isPossibleRenewal and convertJoinToRenew', () => {
      it('should detect and process renewal when transaction matches existing member', () => {
        // Test case from issue: Renewal case
        // Existing member with same email as transaction
        const members = [
          TestData.activeMember({
            Status: "Active",
            Email: "membership-automation@sc3.club",
            First: "Membership",
            Last: "Automation",
            Phone: "(408) 386 9343",
            Joined: utils.dateOnly("2025-01-01"),
            Expires: utils.addDaysToDate(today, 1), // tomorrow
            Period: 1,
            "Directory Share Name": true,
            "Directory Share Email": false,
            "Directory Share Phone": false,
            Migrated: "",
            "Renewed On": ""
          })
        ];
        
        // Transaction for the same member
        const txns = [
          TestData.paidTransaction({
            Timestamp: "11/14/2025 5:07:10",
            "Email Address": "membership-automation@sc3.club",
            "Are you 18 years of age or older?": "Yes",
            Privacy: "I have read the privacy policy",
            "Membership Agreement": "I Agree",
            Directory: "Share Name, Share Email",
            "First Name": "Membership",
            "Last Name": "Automation",
            Phone: "(408) 386-9343",
            Payment: "1 year - $0.50",
            "Payable Order ID": "DK-TF-VZD2",
            "Payable Total": "$0.50",
            "Payable Status": "paid"
          })
        ];

        manager.processPaidTransactions(txns, members, expirySchedule);

        // Should have exactly one member (renewal, not duplicate)
        expect(members.length).toBe(1);
        
        // Member should still have original email
        expect(members[0].Email).toBe("membership-automation@sc3.club");
        
        // Should be marked as renewed today
        expect(members[0]["Renewed On"]).toEqual(today);
        
        // Expires should be extended by 1 year from tomorrow
        const expectedExpires = utils.addYearsToDate(utils.addDaysToDate(today, 1), 1);
        expect(members[0].Expires).toEqual(expectedExpires);
        
        // Joined date should remain the original
        expect(members[0].Joined).toEqual(utils.dateOnly("2025-01-01"));
        
        // Migrated should be unchanged
        expect(members[0].Migrated).toBe(""); 

        // Should send renewal email
        expect(sendEmailFun).toHaveBeenCalledTimes(1);
        expect(sendEmailFun).toHaveBeenCalledWith({
          to: "membership-automation@sc3.club",
          subject: utils.expandTemplate(actionSpecs.Renew.Subject, members[0]),
          htmlBody: utils.expandTemplate(actionSpecs.Renew.Body, members[0])
        });
      });

      it('should create new member when transaction does not match any existing member (different first letter)', () => {
        // Test case from issue: Join case
        // Existing member with different first name letter
        const members = [
          TestData.activeMember({
            Status: "Active",
            Email: "toby.ferguson@sc3.club",
            First: "Toby",
            Last: "Ferguson",
            Phone: "(408) 386 9343",
            Joined: utils.dateOnly("2025-01-01"),
            Expires: utils.addDaysToDate(today, -1), // expired yesterday
            Period: 1,
            "Directory Share Name": true,
            "Directory Share Email": false,
            "Directory Share Phone": false
          })
        ];
        
        // Transaction with different first name letter (M vs T)
        const txns = [
          TestData.paidTransaction({
            "Email Address": "membership-automation@sc3.club",
            "First Name": "Membership",
            "Last Name": "Automation",
            Phone: "(408) 386-9343",
            Payment: "1 year - $0.50",
            Directory: "Share Name, Share Email"
          })
        ];

        manager.processPaidTransactions(txns, members, expirySchedule);

        // Should have two members (one existing, one new)
        expect(members.length).toBe(2);
        
        // First member should be unchanged (expired)
        expect(members[0].Email).toBe("toby.ferguson@sc3.club");
        expect(members[0].First).toBe("Toby");
        
        // Second member should be the new join
        expect(members[1].Email).toBe("membership-automation@sc3.club");
        expect(members[1].First).toBe("Membership");
        expect(members[1].Last).toBe("Automation");
        expect(members[1].Joined).toEqual(today);
        expect(members[1].Expires).toEqual(utils.addYearsToDate(today, 1));
        expect(members[1]["Renewed On"]).toBe(null);
        
        // Should send join email
        expect(sendEmailFun).toHaveBeenCalledWith({
          to: "membership-automation@sc3.club",
          subject: utils.expandTemplate(actionSpecs.Join.Subject, members[1]),
          htmlBody: utils.expandTemplate(actionSpecs.Join.Body, members[1])
        });
        
        // Should add new member to groups
        expect(groupManager.groupAddFun).toHaveBeenCalledTimes(2);
        expect(groupManager.groupAddFun).toHaveBeenCalledWith("membership-automation@sc3.club", "a@b.com");
        expect(groupManager.groupAddFun).toHaveBeenCalledWith("membership-automation@sc3.club", "member_discussions@sc3.club");
      });

      it('should NOT match when names differ (no false positives)', () => {
        const members = [
          TestData.activeMember({
            Status: "Active",
            Email: "alice@example.com",
            First: "Alice",
            Last: "Johnson",
            Phone: "555-0000",
            Joined: utils.dateOnly("2023-01-01"),
            Expires: utils.addDaysToDate(today, 5),
            Period: 1
          })
        ];
        
        const txns = [
          TestData.paidTransaction({
            "Email Address": "bob@example.com",
            "First Name": "Bob",
            "Last Name": "Smith",
            Phone: "(555) 555-0000", // Same phone but different names
            Payment: "1 year"
          })
        ];

        manager.processPaidTransactions(txns, members, expirySchedule);

        // Should create new member - names don't match
        expect(members.length).toBe(2);
        expect(members[0].Email).toBe("alice@example.com");
        expect(members[1].Email).toBe("bob@example.com");
      });

      it('should remove old expiry schedule entries using OLD email before updating member email', () => {
        // Setup: Member with existing expiry schedule entries
        const oldEmail = "john@oldcompany.com";
        const newEmail = "john@newcompany.com";
        
        const members = [TestData.activeMember({ 
          Status: 'Active',
          Email: oldEmail, 
          First: "John", 
          Last: "Doe",
          Phone: "(555) 555-1234",
          Joined: utils.dateOnly("2024-01-01"),
          Expires: utils.addDaysToDate(today, 10),
          Period: 1
        })];
        
        // Create existing expiry schedule for old email
        const existingSchedule = [
          TestData.expiryScheduleEntry({ Email: oldEmail, Type: utils.ActionType.Expiry1, Date: utils.addDaysToDate(today, 10 + O1) }),
          TestData.expiryScheduleEntry({ Email: oldEmail, Type: utils.ActionType.Expiry2, Date: utils.addDaysToDate(today, 10 + O2) }),
          TestData.expiryScheduleEntry({ Email: oldEmail, Type: utils.ActionType.Expiry3, Date: utils.addDaysToDate(today, 10 + O3) }),
          TestData.expiryScheduleEntry({ Email: oldEmail, Type: utils.ActionType.Expiry4, Date: utils.addDaysToDate(today, 10 + O4) })
        ];
        
        // Transaction with new email but same name+phone
        const txns = [TestData.paidTransaction({ 
          "Email Address": newEmail, 
          "First Name": "John", 
          "Last Name": "Doe",
          Phone: "(555) 555-1234",
          Payment: "1 year"
        })];
        
        manager.processPaidTransactions(txns, members, existingSchedule);
        
        // Member should have new email
        expect(members[0].Email).toBe(newEmail);
        
        // Old email's schedule entries should be GONE
        const oldEmailEntries = existingSchedule.filter(e => e.Email === oldEmail);
        expect(oldEmailEntries.length).toBe(0);
        
        // New email should have new schedule entries
        const newEmailEntries = existingSchedule.filter(e => e.Email === newEmail);
        expect(newEmailEntries.length).toBe(4); // 4 expiry notifications
        
        // Verify new schedule has correct dates
        const newExpires = utils.addYearsToDate(utils.addDaysToDate(today, 10), 1);
        expect(newEmailEntries[0]).toMatchObject({
          Email: newEmail,
          Type: utils.ActionType.Expiry1,
          Date: utils.addDaysToDate(newExpires, O1)
        });
      });
    });
  });

  describe('addRenewedMemberToActionSchedule', () => {
    let expirySchedule;
    let emailSpecs;
    let member;

    beforeEach(() => {
      expirySchedule = [
        TestData.expiryScheduleEntry({ Date: new Date('2023-01-01'), Type: utils.ActionType.Expiry1 }),
        TestData.expiryScheduleEntry({ Date: new Date('2023-02-01'), Type: utils.ActionType.Expiry2 })
      ];
      emailSpecs = actionSpecsArray
      member = TestData.activeMember({
        Email: 'test@example1.com',
        First: 'John',
        Last: 'Doe',
        Joined: new Date('2022-01-01'),
        Expires: new Date('2023-01-01'),
        "Renewed On": new Date('2023-01-01')
      });
    });

    it('should remove existing action schedule entries for the member', () => {
      const member = TestData.activeMember({ Email: "test1@example.com", First: "John", Last: "Doe", Joined: utils.dateOnly('2021-01-01'), Expires: utils.addYearsToDate(today, 1), "Renewed On": today });
      const expected = [
        TestData.expiryScheduleEntry({ Email: member.Email, Type: utils.ActionType.Expiry1, Date: utils.addDaysToDate(member.Expires, O1) }),
        TestData.expiryScheduleEntry({ Email: member.Email, Type: utils.ActionType.Expiry2, Date: utils.addDaysToDate(member.Expires, O2) }),
        TestData.expiryScheduleEntry({ Email: member.Email, Type: utils.ActionType.Expiry3, Date: utils.addDaysToDate(member.Expires, O3) }),
        TestData.expiryScheduleEntry({ Email: member.Email, Type: utils.ActionType.Expiry4, Date: utils.addDaysToDate(member.Expires, O4) })
      ]
      expirySchedule = [TestData.expiryScheduleEntry({ Email: member.Email, Type: utils.ActionType.Expiry3, Date: utils.dateOnly('2021-01-10') })]
      manager.addRenewedMemberToActionSchedule_(member, expirySchedule, emailSpecs);
      expect(expirySchedule).toEqual(expected);

    });

    it('should add new action schedule entries for the renewed member', () => {
      const member = TestData.activeMember({ Email: "test1@example.com", First: "John", Last: "Doe", Joined: utils.dateOnly('2021-01-01'), Expires: utils.addYearsToDate(today, 1), "Renewed On": today });
      const expected = [
        TestData.expiryScheduleEntry({ Email: member.Email, Type: utils.ActionType.Expiry1, Date: utils.addDaysToDate(member.Expires, O1) }),
        TestData.expiryScheduleEntry({ Email: member.Email, Type: utils.ActionType.Expiry2, Date: utils.addDaysToDate(member.Expires, O2) }),
        TestData.expiryScheduleEntry({ Email: member.Email, Type: utils.ActionType.Expiry3, Date: utils.addDaysToDate(member.Expires, O3) }),
        TestData.expiryScheduleEntry({ Email: member.Email, Type: utils.ActionType.Expiry4, Date: utils.addDaysToDate(member.Expires, O4) })
      ]
      expirySchedule = []
      manager.addRenewedMemberToActionSchedule_(member, expirySchedule, emailSpecs);
      expect(expirySchedule).toEqual(expected);
    });

  });
  describe('convertJoinToRenew utility (additional tests)', () => {
    it('merges INITIAL into LATEST when LATEST.Joined <= INITIAL.Expires', () => {
      const membershipData = [
        { Status: 'Active', Email: 'captenphil@aol.com', First: 'Phil', Last: 'Stotts', Phone: '(831) 345-9634', Joined: '8/8/2017', Expires: '12/15/2026', Period: 3, 'Directory Share Name': false, 'Directory Share Email': false, 'Directory Share Phone': false, 'Renewed On': '' },
        { Status: 'Active', Email: 'phil.stotts@gmail.com', First: 'Phil', Last: 'Stotts', Phone: '(831) 345-9634', Joined: '10/23/2025', Expires: '10/23/2027', Period: 2, 'Directory Share Name': true, 'Directory Share Email': true, 'Directory Share Phone': true, 'Renewed On': '' }
      ];

      const expirySchedule = [
        { Email: 'captenphil@aol.com', Type: utils.ActionType.Expiry1, Date: utils.dateOnly('12/1/2026') },
        { Email: 'captenphil@aol.com', Type: utils.ActionType.Expiry2, Date: utils.dateOnly('12/16/2026') },
        { Email: 'captenphil@aol.com', Type: utils.ActionType.Expiry3, Date: utils.dateOnly('12/31/2026') },
        { Email: 'captenphil@aol.com', Type: utils.ActionType.Expiry4, Date: utils.dateOnly('1/15/2027') }
      ];

      const expectedExpirySchedule = [
        { Email: 'phil.stotts@gmail.com', Type: utils.ActionType.Expiry1, Date: utils.dateOnly('12/5/2028') },
        { Email: 'phil.stotts@gmail.com', Type: utils.ActionType.Expiry2, Date: utils.dateOnly('12/10/2028') },
        { Email: 'phil.stotts@gmail.com', Type: utils.ActionType.Expiry3, Date: utils.dateOnly('12/15/2028') },
        { Email: 'phil.stotts@gmail.com', Type: utils.ActionType.Expiry4, Date: utils.dateOnly('12/25/2028') }
      ];

      const expectedMembershipData = {
        Status: 'Active',
        Email: 'phil.stotts@gmail.com',
        First: 'Phil',
        Last: 'Stotts',
        Phone: '(831) 345-9634',
        Joined: new Date('8/8/2017'),
        Expires: new Date('12/15/2028'),
        Period: 2,
        'Directory Share Name': true,
        'Directory Share Email': true,
        'Directory Share Phone': true,
        'Renewed On': new Date('10/23/2025')
      };

      const result = manager.convertJoinToRenew(0, 1, membershipData, expirySchedule);
      expect(result.success).toBe(true);
      expect(membershipData.length).toBe(1);
      const merged = membershipData[0];
      expect(merged).toEqual(expectedMembershipData);

      expect(expirySchedule).toEqual(expectedExpirySchedule);
    });

    it('does not merge or delete INITIAL when LATEST.Joined > INITIAL.Expires (fails isPossibleRenewal)', () => {
      // This test verifies that rows which don't pass isPossibleRenewal validation are rejected
      // These members don't share email or phone, so they can't be a possible renewal
      const membershipData = [
        { Status: 'Active', Email: 'old@example.com', First: 'Test', Last: 'User', Phone: '111-111-1111', Joined: '1/1/2010', Expires: '1/1/2011', Period: 1 },
        { Status: 'Active', Email: 'new@example.com', First: 'Test', Last: 'User', Phone: '222-222-2222', Joined: '1/1/2015', Expires: '1/1/2016', Period: 2 }
      ];

      const result = manager.convertJoinToRenew(0, 1, membershipData);
      expect(result.success).toBe(false);
      // No mutation should have occurred
      expect(membershipData.length).toBe(2);
      expect(membershipData[0].Email).toBe('old@example.com');
      expect(utils.dateOnly(membershipData[0].Joined).getTime()).toBe(utils.dateOnly('1/1/2010').getTime());
      expect(membershipData[1].Email).toBe('new@example.com');
      expect(utils.dateOnly(membershipData[1].Joined).getTime()).toBe(utils.dateOnly('1/1/2015').getTime());
    });

    it('does not merge when all criteria match except later joined is after earlier expires', () => {
      // This is a more comprehensive test where all criteria WOULD match except the date constraint
      const membershipData = [
        { Status: 'Active', Email: 'test@example.com', First: 'Test', Last: 'User', Phone: '(555) 123-4567', Joined: '1/1/2020', Expires: '1/1/2021', Period: 1 },
        { Status: 'Active', Email: 'test@example.com', First: 'Test', Last: 'User', Phone: '(555) 123-4567', Joined: '1/2/2021', Expires: '1/2/2022', Period: 1 }
      ];

      const result = manager.convertJoinToRenew(0, 1, membershipData);
      expect(result.success).toBe(false);
      expect(result.message).toContain('not a valid possible renewal pair');
      // No mutation should have occurred
      expect(membershipData.length).toBe(2);
    });

    it('should preserve ValidatedMember instance type after conversion', () => {
      // This test ensures that convertJoinToRenew doesn't accidentally replace
      // ValidatedMember instances with plain objects (which would break .toArray())
      const member1 = new ValidatedMember(
        'old@example.com', 'Active', 'Test', 'User', '555-1111',
        new Date('2020-01-01'), new Date('2021-01-01'), 1,
        true, false, true, null
      );
      const member2 = new ValidatedMember(
        'old@example.com', 'Active', 'Test', 'User', '555-1111',
        new Date('2020-06-01'), new Date('2022-06-01'), 2,
        true, true, true, null
      );

      const membershipData = [member1, member2];
      const expirySchedule = [];

      const result = manager.convertJoinToRenew(0, 1, membershipData, expirySchedule);

      expect(result.success).toBe(true);
      expect(membershipData.length).toBe(1);
      
      // Critical assertions: verify instance type is preserved
      expect(membershipData[0]).toBeInstanceOf(ValidatedMember);
      expect(membershipData[0].toArray).toBeDefined();
      expect(typeof membershipData[0].toArray).toBe('function');
      
      // Verify .toArray() actually works (doesn't throw)
      expect(() => membershipData[0].toArray()).not.toThrow();
      
      // Verify the result is an array with proper structure
      const arr = membershipData[0].toArray();
      expect(Array.isArray(arr)).toBe(true);
      expect(arr.length).toBe(12); // ValidatedMember.HEADERS.length
    });

    it('should work with MemberPersistence.writeChangedCells after conversion', () => {
      // Integration test: verify that convertJoinToRenew results can be written
      // to spreadsheet using MemberPersistence (which requires ValidatedMember instances)
      const member1 = new ValidatedMember(
        'test@example.com', 'Active', 'Test', 'User', '555-1111',
        new Date('2020-01-01'), new Date('2021-01-01'), 1,
        true, false, true, null
      );
      const member2 = new ValidatedMember(
        'test@example.com', 'Active', 'Test', 'User', '555-1111',
        new Date('2020-06-01'), new Date('2022-06-01'), 2,
        true, true, true, null
      );

      const membershipData = [member1, member2];
      const originalRows = membershipData.map(m => m.toArray());
      const expirySchedule = [];

      const result = manager.convertJoinToRenew(0, 1, membershipData, expirySchedule);
      expect(result.success).toBe(true);

      // Mock sheet for MemberPersistence
      const mockRange = { setValue: jest.fn() };
      const mockSheet = {
        getRange: jest.fn().mockReturnValue(mockRange)
      };

      // This should NOT throw "toArray is not a function"
      expect(() => {
        MemberPersistence.writeChangedCells(
          mockSheet,
          [originalRows[0]], // Only first row remains after merge
          membershipData,
          ValidatedMember.HEADERS
        );
      }).not.toThrow();
    });
  });

  describe('isPossibleRenewal', () => {
    describe('MUST match these pairs', () => {
      it('should match identical records (same email, phone, name)', () => {
        const member1 = { Email: "toby@mail.com", Phone: "(408) 386-9343", First: "Toby", Last: "Ferguson", Joined: "1/1/2025", Expires: "1/1/2026", Status: "Active" };
        const member2 = { Email: "toby@mail.com", Phone: "(408) 386-9343", First: "Toby", Last: "Ferguson", Joined: "1/12/2025", Expires: "1/12/2028", Status: "Active" };
        expect(MembershipManagement.Manager.isPossibleRenewal(member1, member2)).toBe(true);
      });

      it('should match when email is different but phone matches', () => {
        const member1 = { Email: "toby@mail.com", Phone: "(408) 386-9343", First: "Toby", Last: "Ferguson", Joined: "1/1/2025", Expires: "1/1/2026", Status: "Active" };
        const member2 = { Email: "foo", Phone: "(408) 386-9343", First: "Toby", Last: "Ferguson", Joined: "1/12/2025", Expires: "1/12/2028", Status: "Active" };
        expect(MembershipManagement.Manager.isPossibleRenewal(member1, member2)).toBe(true);
      });

      it('should match when phone is different but email matches', () => {
        const member1 = { Email: "toby@mail.com", Phone: "(408) 386-9343", First: "Toby", Last: "Ferguson", Joined: "1/1/2025", Expires: "1/1/2026", Status: "Active" };
        const member2 = { Email: "toby@mail.com", Phone: "(123) 456-1234", First: "Toby", Last: "Ferguson", Joined: "1/12/2025", Expires: "1/12/2028", Status: "Active" };
        expect(MembershipManagement.Manager.isPossibleRenewal(member1, member2)).toBe(true);
      });

      it('should match with different case first letter of first name', () => {
        const member1 = { Email: "toby@mail.com", Phone: "(408) 386-9343", First: "Toby", Last: "Ferguson", Joined: "1/1/2025", Expires: "1/1/2026", Status: "Active" };
        const member2 = { Email: "toby@mail.com", Phone: "(408) 386-9343", First: "toby", Last: "Ferguson", Joined: "1/12/2025", Expires: "1/12/2028", Status: "Active" };
        expect(MembershipManagement.Manager.isPossibleRenewal(member1, member2)).toBe(true);
      });

      it('should match with different case first letter of last name', () => {
        const member1 = { Email: "toby@mail.com", Phone: "(408) 386-9343", First: "Toby", Last: "Ferguson", Joined: "1/1/2025", Expires: "1/1/2026", Status: "Active" };
        const member2 = { Email: "toby@mail.com", Phone: "(408) 386-9343", First: "Toby", Last: "ferguson", Joined: "1/12/2025", Expires: "1/12/2028", Status: "Active" };
        expect(MembershipManagement.Manager.isPossibleRenewal(member1, member2)).toBe(true);
      });

      it('should match with same first letter of first name (different names)', () => {
        const member1 = { Email: "toby@mail.com", Phone: "(408) 386-9343", First: "Toby", Last: "Ferguson", Joined: "1/1/2025", Expires: "1/1/2026", Status: "Active" };
        const member2 = { Email: "toby@mail.com", Phone: "(408) 386-9343", First: "Tom", Last: "Ferguson", Joined: "1/12/2025", Expires: "1/12/2028", Status: "Active" };
        expect(MembershipManagement.Manager.isPossibleRenewal(member1, member2)).toBe(true);
      });

      it('should match with same first letter of last name (different names)', () => {
        const member1 = { Email: "toby@mail.com", Phone: "(408) 386-9343", First: "Toby", Last: "Ferguson", Joined: "1/1/2025", Expires: "1/1/2026", Status: "Active" };
        const member2 = { Email: "toby@mail.com", Phone: "(408) 386-9343", First: "Toby", Last: "Foxtrot", Joined: "1/12/2025", Expires: "1/12/2028", Status: "Active" };
        expect(MembershipManagement.Manager.isPossibleRenewal(member1, member2)).toBe(true);
      });
    });

    describe('MUST NOT match these pairs', () => {
      it('should not match when first letters of first name are different', () => {
        const member1 = { Email: "toby@mail.com", Phone: "(408) 386-9343", First: "Toby", Last: "Ferguson", Joined: "1/1/2025", Expires: "1/1/2026", Status: "Active" };
        const member2 = { Email: "toby@mail.com", Phone: "(408) 386-9343", First: "John", Last: "Ferguson", Joined: "1/12/2025", Expires: "1/12/2028", Status: "Active" };
        expect(MembershipManagement.Manager.isPossibleRenewal(member1, member2)).toBe(false);
      });

      it('should not match when first letters of last name are different', () => {
        const member1 = { Email: "toby@mail.com", Phone: "(408) 386-9343", First: "Toby", Last: "Ferguson", Joined: "1/1/2025", Expires: "1/1/2026", Status: "Active" };
        const member2 = { Email: "toby@mail.com", Phone: "(408) 386-9343", First: "Toby", Last: "Smith", Joined: "1/12/2025", Expires: "1/12/2028", Status: "Active" };
        expect(MembershipManagement.Manager.isPossibleRenewal(member1, member2)).toBe(false);
      });

      it('should not match when neither phone nor email match', () => {
        const member1 = { Email: "toby@mail.com", Phone: "(408) 386-9343", First: "Toby", Last: "Ferguson", Joined: "1/1/2025", Expires: "1/1/2026", Status: "Active" };
        const member2 = { Email: "toby@email.com", Phone: "(408) 386-9342", First: "Toby", Last: "Ferguson", Joined: "1/12/2025", Expires: "1/12/2028", Status: "Active" };
        expect(MembershipManagement.Manager.isPossibleRenewal(member1, member2)).toBe(false);
      });

      it('should not match when later joined is after earlier expires (expired)', () => {
        const member1 = { Email: "toby@mail.com", Phone: "(408) 386-9343", First: "Toby", Last: "Ferguson", Joined: "1/1/2025", Expires: "1/1/2026", Status: "Active" };
        const member2 = { Email: "toby@mail.com", Phone: "(408) 386-9343", First: "Toby", Last: "Ferguson", Joined: "1/2/2026", Expires: "1/2/2028", Status: "Active" };
        expect(MembershipManagement.Manager.isPossibleRenewal(member1, member2)).toBe(false);
      });

      it('should not match inactive members', () => {
        const member1 = { Email: "toby@mail.com", Phone: "(408) 386-9343", First: "Toby", Last: "Ferguson", Joined: "1/1/2025", Expires: "1/1/2026", Status: "Inactive" };
        const member2 = { Email: "toby@mail.com", Phone: "(408) 386-9343", First: "Toby", Last: "Ferguson", Joined: "1/12/2025", Expires: "1/12/2028", Status: "Active" };
        expect(MembershipManagement.Manager.isPossibleRenewal(member1, member2)).toBe(false);
      });

      it('should not match expired members', () => {
        const member1 = { Email: "toby@mail.com", Phone: "(408) 386-9343", First: "Toby", Last: "Ferguson", Joined: "1/1/2025", Expires: "1/1/2026", Status: "Expired" };
        const member2 = { Email: "toby@mail.com", Phone: "(408) 386-9343", First: "Toby", Last: "Ferguson", Joined: "1/12/2025", Expires: "1/12/2028", Status: "Active" };
        expect(MembershipManagement.Manager.isPossibleRenewal(member1, member2)).toBe(false);
      });

      it('should still not match same object reference (identity)', () => {
        const member = { Email: "toby@mail.com", Phone: "(408) 386-9343", First: "Toby", Last: "Ferguson", Joined: "1/1/2025", Expires: "1/1/2026", Status: "Active" };
        expect(MembershipManagement.Manager.isPossibleRenewal(member, member)).toBe(false);
      });

      it('should MATCH when both joined on the same date (different objects with equal data)', () => {
        const member1 = { Email: "toby@mail.com", Phone: "(408) 386-9343", First: "Toby", Last: "Ferguson", Joined: "1/1/2025", Expires: "1/1/2026", Status: "Active" };
        const member2 = { Email: "toby@mail.com", Phone: "(408) 386-9343", First: "Toby", Last: "Ferguson", Joined: "1/1/2025", Expires: "1/1/2028", Status: "Active" };
        // Different objects with equal data fields should match (this is a change from previous logic)
        expect(MembershipManagement.Manager.isPossibleRenewal(member1, member2)).toBe(true);
      });
    });

    describe('Status handling (Active members only)', () => {
      it('should NOT match Expired member with Active member', () => {
        const member1 = { Email: "toby@mail.com", Phone: "(408) 386-9343", First: "Toby", Last: "Ferguson", Joined: "1/1/2024", Expires: "1/1/2025", Status: "Expired" };
        const member2 = { Email: "toby@mail.com", Phone: "(408) 386-9343", First: "Toby", Last: "Ferguson", Joined: "12/15/2024", Expires: "12/15/2025", Status: "Active" };
        expect(MembershipManagement.Manager.isPossibleRenewal(member1, member2)).toBe(false);
      });

      it('should NOT match Lapsed member with Active member', () => {
        const member1 = { Email: "toby@mail.com", Phone: "(408) 386-9343", First: "Toby", Last: "Ferguson", Joined: "1/1/2024", Expires: "1/1/2025", Status: "Lapsed" };
        const member2 = { Email: "toby@mail.com", Phone: "(408) 386-9343", First: "Toby", Last: "Ferguson", Joined: "12/20/2024", Expires: "12/20/2025", Status: "Active" };
        expect(MembershipManagement.Manager.isPossibleRenewal(member1, member2)).toBe(false);
      });

      it('should NOT match two Expired members', () => {
        const member1 = { Email: "toby@mail.com", Phone: "(408) 386-9343", First: "Toby", Last: "Ferguson", Joined: "1/1/2023", Expires: "1/1/2024", Status: "Expired" };
        const member2 = { Email: "toby@mail.com", Phone: "(408) 386-9343", First: "Toby", Last: "Ferguson", Joined: "12/15/2023", Expires: "12/15/2024", Status: "Expired" };
        expect(MembershipManagement.Manager.isPossibleRenewal(member1, member2)).toBe(false);
      });
    });
  });

  describe('findExistingMemberForTransaction', () => {
    it('should return POSSIBLE_RENEWAL for Active member matching name+email/phone with valid temporal relationship', () => {
      const txn = { "Email Address": "john@example.com", "First Name": "John", "Last Name": "Doe", Phone: "(555) 555-1234" };
      const members = [
        { Email: "john@example.com", First: "John", Last: "Doe", Phone: "(555) 555-1234", Status: "Active", Joined: "2023-01-01", Expires: "2025-01-01" }
      ];
      const today = "2024-12-15"; // Before expiry
      const result = MembershipManagement.Manager.findExistingMemberForTransaction(txn, members, today);
      expect(result.found).toBe(true);
      expect(result.matchType).toBe('POSSIBLE_RENEWAL');
      expect(result.index).toBe(0);
      expect(result.member.Email).toBe("john@example.com");
    });

    it('should return NEW_MEMBER when no match found', () => {
      const txn = { "Email Address": "jane@example.com", "First Name": "Jane", "Last Name": "Smith", Phone: "555-5678" };
      const members = [
        { Email: "john@example.com", First: "John", Last: "Doe", Phone: "(555) 555-1234", Status: "Active", Joined: "2023-01-01", Expires: "2025-01-01" }
      ];
      const today = "2024-12-15";
      const result = MembershipManagement.Manager.findExistingMemberForTransaction(txn, members, today);
      expect(result.found).toBe(false);
      expect(result.matchType).toBe('NEW_MEMBER');
      expect(result.index).toBe(-1);
      expect(result.member).toBeNull();
    });

    it('should match POSSIBLE_RENEWAL even with different email if name+phone match and temporal valid', () => {
      const txn = { "Email Address": "john@newcompany.com", "First Name": "John", "Last Name": "Doe", Phone: "(555) 555-1234" };
      const members = [
        { Email: "john@oldcompany.com", First: "John", Last: "Doe", Phone: "(555) 555-1234", Status: "Active", Joined: "2023-01-01", Expires: "2025-01-01" }
      ];
      const today = "2024-12-15"; // Before expiry
      const result = MembershipManagement.Manager.findExistingMemberForTransaction(txn, members, today);
      expect(result.found).toBe(true);
      expect(result.matchType).toBe('POSSIBLE_RENEWAL');
      expect(result.index).toBe(0);
      expect(result.member.Email).toBe("john@oldcompany.com");
    });

    it('should return NEW_MEMBER when transaction comes after existing membership expires', () => {
      const txn = { "Email Address": "john@example.com", "First Name": "John", "Last Name": "Doe", Phone: "(555) 555-1234" };
      const members = [
        { Email: "john@example.com", First: "John", Last: "Doe", Phone: "(555) 555-1234", Status: "Active", Joined: "2023-01-01", Expires: "2024-01-01" }
      ];
      const today = "2024-12-15"; // Well after expiry - not a valid renewal
      const result = MembershipManagement.Manager.findExistingMemberForTransaction(txn, members, today);
      expect(result.found).toBe(false);
      expect(result.matchType).toBe('NEW_MEMBER');
      expect(result.index).toBe(-1);
      expect(result.member).toBeNull();
    });

    describe('isSimilarMember (deprecated alias)', () => {
      it('should delegate to isPossibleRenewal', () => {
        const member1 = { Email: "toby@mail.com", Phone: "(408) 386-9343", First: "Toby", Last: "Ferguson", Joined: "1/1/2025", Expires: "1/1/2026", Status: "Active" };
        const member2 = { Email: "toby@mail.com", Phone: "(408) 386-9343", First: "Toby", Last: "Ferguson", Joined: "1/12/2025", Expires: "1/12/2028", Status: "Active" };
        expect(MembershipManagement.Manager.isSimilarMember(member1, member2)).toBe(MembershipManagement.Manager.isPossibleRenewal(member1, member2));
      });
    });
  });

  describe('test findPossibleRenewals()', () => {
    describe('MUST match these pairs', () => {
      it('should find identical records', () => {
        const members = [
          { Email: "toby@mail.com", Phone: "(408) 386-9343", First: "Toby", Last: "Ferguson", Joined: "1/1/2025", Expires: "1/1/2026", Status: "Active" },
          { Email: "toby@mail.com", Phone: "(408) 386-9343", First: "Toby", Last: "Ferguson", Joined: "1/12/2025", Expires: "1/12/2028", Status: "Active" }
        ];
        const pairs = MembershipManagement.Manager.findPossibleRenewals(members);
        expect(pairs).toEqual([[0, 1]]);
      });

      it('should find pairs with different email but same phone', () => {
        const members = [
          { Email: "toby@mail.com", Phone: "(408) 386-9343", First: "Toby", Last: "Ferguson", Joined: "1/1/2025", Expires: "1/1/2026", Status: "Active" },
          { Email: "foo", Phone: "(408) 386-9343", First: "Toby", Last: "Ferguson", Joined: "1/12/2025", Expires: "1/12/2028", Status: "Active" }
        ];
        const pairs = MembershipManagement.Manager.findPossibleRenewals(members);
        expect(pairs).toEqual([[0, 1]]);
      });

      it('should find pairs with different phone but same email', () => {
        const members = [
          { Email: "toby@mail.com", Phone: "(408) 386-9343", First: "Toby", Last: "Ferguson", Joined: "1/1/2025", Expires: "1/1/2026", Status: "Active" },
          { Email: "toby@mail.com", Phone: "(123) 456-1234", First: "Toby", Last: "Ferguson", Joined: "1/12/2025", Expires: "1/12/2028", Status: "Active" }
        ];
        const pairs = MembershipManagement.Manager.findPossibleRenewals(members);
        expect(pairs).toEqual([[0, 1]]);
      });

      it('should find pairs with different case first letters', () => {
        const members = [
          { Email: "toby@mail.com", Phone: "(408) 386-9343", First: "Toby", Last: "Ferguson", Joined: "1/1/2025", Expires: "1/1/2026", Status: "Active" },
          { Email: "toby@mail.com", Phone: "(408) 386-9343", First: "toby", Last: "ferguson", Joined: "1/12/2025", Expires: "1/12/2028", Status: "Active" }
        ];
        const pairs = MembershipManagement.Manager.findPossibleRenewals(members);
        expect(pairs).toEqual([[0, 1]]);
      });

      it('should find pairs with same first letter first name (Tom vs Toby)', () => {
        const members = [
          { Email: "toby@mail.com", Phone: "(408) 386-9343", First: "Toby", Last: "Ferguson", Joined: "1/1/2025", Expires: "1/1/2026", Status: "Active" },
          { Email: "toby@mail.com", Phone: "(408) 386-9343", First: "Tom", Last: "Ferguson", Joined: "1/12/2025", Expires: "1/12/2028", Status: "Active" }
        ];
        const pairs = MembershipManagement.Manager.findPossibleRenewals(members);
        expect(pairs).toEqual([[0, 1]]);
      });

      it('should find pairs with same first letter last name (Ferguson vs Foxtrot)', () => {
        const members = [
          { Email: "toby@mail.com", Phone: "(408) 386-9343", First: "Toby", Last: "Ferguson", Joined: "1/1/2025", Expires: "1/1/2026", Status: "Active" },
          { Email: "toby@mail.com", Phone: "(408) 386-9343", First: "Toby", Last: "Foxtrot", Joined: "1/12/2025", Expires: "1/12/2028", Status: "Active" }
        ];
        const pairs = MembershipManagement.Manager.findPossibleRenewals(members);
        expect(pairs).toEqual([[0, 1]]);
      });
    });

    describe('MUST NOT match these pairs', () => {
      it('should not find pairs with different first name first letter', () => {
        const members = [
          { Email: "toby@mail.com", Phone: "(408) 386-9343", First: "Toby", Last: "Ferguson", Joined: "1/1/2025", Expires: "1/1/2026", Status: "Active" },
          { Email: "toby@mail.com", Phone: "(408) 386-9343", First: "John", Last: "Ferguson", Joined: "1/12/2025", Expires: "1/12/2028", Status: "Active" }
        ];
        const pairs = MembershipManagement.Manager.findPossibleRenewals(members);
        expect(pairs).toEqual([]);
      });

      it('should not find pairs with different last name first letter', () => {
        const members = [
          { Email: "toby@mail.com", Phone: "(408) 386-9343", First: "Toby", Last: "Ferguson", Joined: "1/1/2025", Expires: "1/1/2026", Status: "Active" },
          { Email: "toby@mail.com", Phone: "(408) 386-9343", First: "Toby", Last: "Smith", Joined: "1/12/2025", Expires: "1/12/2028", Status: "Active" }
        ];
        const pairs = MembershipManagement.Manager.findPossibleRenewals(members);
        expect(pairs).toEqual([]);
      });

      it('should not find pairs with neither phone nor email matching', () => {
        const members = [
          { Email: "toby@mail.com", Phone: "(408) 386-9343", First: "Toby", Last: "Ferguson", Joined: "1/1/2025", Expires: "1/1/2026", Status: "Active" },
          { Email: "toby@email.com", Phone: "(408) 386-9342", First: "Toby", Last: "Ferguson", Joined: "1/12/2025", Expires: "1/12/2028", Status: "Active" }
        ];
        const pairs = MembershipManagement.Manager.findPossibleRenewals(members);
        expect(pairs).toEqual([]);
      });

      it('should not find pairs where later joined is after earlier expires', () => {
        const members = [
          { Email: "toby@mail.com", Phone: "(408) 386-9343", First: "Toby", Last: "Ferguson", Joined: "1/1/2025", Expires: "1/1/2026", Status: "Active" },
          { Email: "toby@mail.com", Phone: "(408) 386-9343", First: "Toby", Last: "Ferguson", Joined: "1/2/2026", Expires: "1/2/2028", Status: "Active" }
        ];
        const pairs = MembershipManagement.Manager.findPossibleRenewals(members);
        expect(pairs).toEqual([]);
      });

      it('should ignore inactive members', () => {
        const members = [
          { Email: "toby@mail.com", Phone: "(408) 386-9343", First: "Toby", Last: "Ferguson", Joined: "1/1/2025", Expires: "1/1/2026", Status: "Inactive" },
          { Email: "toby@mail.com", Phone: "(408) 386-9343", First: "Toby", Last: "Ferguson", Joined: "1/12/2025", Expires: "1/12/2028", Status: "Active" }
        ];
        const pairs = MembershipManagement.Manager.findPossibleRenewals(members);
        expect(pairs).toEqual([]);
      });

      it('should ignore expired members', () => {
        const members = [
          { Email: "toby@mail.com", Phone: "(408) 386-9343", First: "Toby", Last: "Ferguson", Joined: "1/1/2025", Expires: "1/1/2026", Status: "Active" },
          { Email: "toby@mail.com", Phone: "(408) 386-9343", First: "Toby", Last: "Ferguson", Joined: "1/12/2025", Expires: "1/12/2028", Status: "Expired" }
        ];
        const pairs = MembershipManagement.Manager.findPossibleRenewals(members);
        expect(pairs).toEqual([]);
      });
    });

    it('should find multiple pairs in larger dataset', () => {
      const members = [
        { Email: "toby@mail.com", Phone: "(408) 386-9343", First: "Toby", Last: "Ferguson", Joined: "1/1/2025", Expires: "1/1/2026", Status: "Active" },
        { Email: "toby@mail.com", Phone: "(408) 386-9343", First: "Toby", Last: "Ferguson", Joined: "1/12/2025", Expires: "1/12/2028", Status: "Active" },
        { Email: "jane@mail.com", Phone: "(555) 123-4567", First: "Jane", Last: "Doe", Joined: "3/1/2024", Expires: "3/1/2025", Status: "Active" },
        { Email: "jane@mail.com", Phone: "(555) 123-4567", First: "Jane", Last: "Doe", Joined: "2/15/2025", Expires: "2/15/2026", Status: "Active" },
        { Email: "different@mail.com", Phone: "(999) 999-9999", First: "Unique", Last: "Person", Joined: "6/1/2024", Expires: "6/1/2025", Status: "Active" }
      ];
      const pairs = MembershipManagement.Manager.findPossibleRenewals(members);
      expect(pairs).toEqual([[0, 1], [2, 3]]);
    });
  });

  // ============================================================================
  // EMAIL NORMALIZATION TESTS
  // ============================================================================
  
  describe('normalizeEmail', () => {
    it('lowercases uppercase email', () => {
      expect(MembershipManagement.Manager.normalizeEmail('USER@EXAMPLE.COM')).toBe('user@example.com');
    });

    it('lowercases mixed case email', () => {
      expect(MembershipManagement.Manager.normalizeEmail('User@Example.COM')).toBe('user@example.com');
    });

    it('trims whitespace from email', () => {
      expect(MembershipManagement.Manager.normalizeEmail('  user@example.com  ')).toBe('user@example.com');
    });

    it('trims and lowercases together', () => {
      expect(MembershipManagement.Manager.normalizeEmail('  USER@EXAMPLE.COM  ')).toBe('user@example.com');
    });

    it('handles already normalized email', () => {
      expect(MembershipManagement.Manager.normalizeEmail('user@example.com')).toBe('user@example.com');
    });

    it('returns empty string for null', () => {
      expect(MembershipManagement.Manager.normalizeEmail(null)).toBe('');
    });

    it('returns empty string for undefined', () => {
      expect(MembershipManagement.Manager.normalizeEmail(undefined)).toBe('');
    });

    it('returns empty string for non-string', () => {
      expect(MembershipManagement.Manager.normalizeEmail(123)).toBe('');
    });

    it('handles email with plus addressing', () => {
      expect(MembershipManagement.Manager.normalizeEmail('User+Tag@Example.COM')).toBe('user+tag@example.com');
    });
  });

  describe('email normalization in member operations', () => {
    const testActionSpecs = Object.fromEntries(actionSpecsArray.map(spec => [spec.Type, spec]));
    
    describe('addNewMember_', () => {
      it('normalizes email when creating new member', () => {
        const groups = [{ Email: 'test@sc3.club' }];
        const groupManager = { groupAddFun: jest.fn(), groupRemoveFun: jest.fn(), groupEmailReplaceFun: jest.fn() };
        const manager = new MembershipManagement.Manager(testActionSpecs, groups, groupManager);

        const txn = {
          "Email Address": "USER@EXAMPLE.COM",
          "First Name": "John",
          "Last Name": "Doe",
          Phone: "(555) 555-1234",
          Period: 1
        };
        const membershipData = [];
        const expirySchedule = [];

        const newMember = manager.addNewMember_(txn, expirySchedule, membershipData);

        expect(newMember.Email).toBe('user@example.com');
        expect(membershipData[0].Email).toBe('user@example.com');
      });

      it('returns ValidatedMember instance with toArray method', () => {
        const manager = new MembershipManagement.Manager(
          { Join: { Subject: 'Welcome', Body: 'Thanks for joining' } },
          [{ Email: 'test@sc3.club', Subscription: 'auto' }],
          { groupAddFun: jest.fn(), groupRemoveFun: jest.fn(), groupEmailReplaceFun: jest.fn() },
          jest.fn(),
          new Date('2025-03-01')
        );

        const txn = {
          "Email Address": "newmember@example.com",
          "First Name": "John",
          "Last Name": "Doe",
          Phone: "(555) 555-1234",
          Period: 1,
          Directory: "Share Email"
        };
        const membershipData = [];
        const expirySchedule = [];

        const newMember = manager.addNewMember_(txn, expirySchedule, membershipData);

        // Should be ValidatedMember instance
        expect(newMember).toBeInstanceOf(ValidatedMember);
        
        // Should have toArray method
        expect(typeof newMember.toArray).toBe('function');
        
        // toArray should work
        const arr = newMember.toArray();
        expect(Array.isArray(arr)).toBe(true);
        expect(arr[0]).toBe('Active'); // Status
        expect(arr[1]).toBe('newmember@example.com'); // Email (normalized)
        
        // Should be in membershipData array
        expect(membershipData.length).toBe(1);
        expect(membershipData[0]).toBeInstanceOf(ValidatedMember);
        expect(membershipData[0].toArray).toBeDefined();
      });
    });

    describe('changeMemberEmail_', () => {
      it('normalizes new email when changing', () => {
        const groups = [{ Email: 'test@sc3.club' }];
        const groupManager = { 
          groupAddFun: jest.fn(), 
          groupRemoveFun: jest.fn(), 
          groupEmailReplaceFun: jest.fn().mockReturnValue({ success: true })
        };
        const manager = new MembershipManagement.Manager(testActionSpecs, groups, groupManager);

        const member = { Email: 'old@example.com', First: 'John', Last: 'Doe' };
        const expirySchedule = [];

        manager.changeMemberEmail_('old@example.com', 'NEW@EXAMPLE.COM', member, expirySchedule);

        expect(member.Email).toBe('new@example.com');
      });

      it('does not call groupEmailReplaceFun when normalized emails are the same', () => {
        const groups = [{ Email: 'test@sc3.club' }];
        const groupManager = { 
          groupAddFun: jest.fn(), 
          groupRemoveFun: jest.fn(), 
          groupEmailReplaceFun: jest.fn().mockReturnValue({ success: true })
        };
        const manager = new MembershipManagement.Manager(testActionSpecs, groups, groupManager);

        const member = { Email: 'user@example.com', First: 'John', Last: 'Doe' };
        const expirySchedule = [];

        manager.changeMemberEmail_('USER@example.com', 'user@EXAMPLE.COM', member, expirySchedule);

        expect(groupManager.groupEmailReplaceFun).not.toHaveBeenCalled();
        expect(member.Email).toBe('user@example.com');
      });
    });

    describe('isPossibleRenewal with case variations', () => {
      it('matches members with different case emails', () => {
        const member1 = { 
          Email: "toby@mail.com", 
          Phone: "(408) 386-9343", 
          First: "Toby", 
          Last: "Ferguson", 
          Joined: "1/1/2025", 
          Expires: "1/1/2026", 
          Status: "Active" 
        };
        const member2 = { 
          Email: "TOBY@MAIL.COM", 
          Phone: "(408) 386-9343", 
          First: "Toby", 
          Last: "Ferguson", 
          Joined: "1/12/2025", 
          Expires: "1/12/2028", 
          Status: "Active" 
        };
        expect(MembershipManagement.Manager.isPossibleRenewal(member1, member2)).toBe(true);
      });

      it('matches members with mixed case emails', () => {
        const member1 = { 
          Email: "Toby@Mail.Com", 
          Phone: "(408) 386-9343", 
          First: "Toby", 
          Last: "Ferguson", 
          Joined: "1/1/2025", 
          Expires: "1/1/2026", 
          Status: "Active" 
        };
        const member2 = { 
          Email: "toby@mail.com", 
          Phone: "(408) 386-9343", 
          First: "Toby", 
          Last: "Ferguson", 
          Joined: "1/12/2025", 
          Expires: "1/12/2028", 
          Status: "Active" 
        };
        expect(MembershipManagement.Manager.isPossibleRenewal(member1, member2)).toBe(true);
      });
    });

    describe('schedule operations with normalized emails', () => {
      it('createScheduleEntries_ normalizes email', () => {
        const groups = [{ Email: 'test@sc3.club' }];
        const groupManager = { groupAddFun: jest.fn(), groupRemoveFun: jest.fn(), groupEmailReplaceFun: jest.fn() };
        const manager = new MembershipManagement.Manager(testActionSpecs, groups, groupManager, undefined, '2024-01-01');

        const entries = manager.createScheduleEntries_('USER@EXAMPLE.COM', '2024-12-31');

        entries.forEach(entry => {
          expect(entry.Email).toBe('user@example.com');
        });
      });

      it('removeMemberFromExpirySchedule_ matches case-insensitively', () => {
        const groups = [{ Email: 'test@sc3.club' }];
        const groupManager = { groupAddFun: jest.fn(), groupRemoveFun: jest.fn(), groupEmailReplaceFun: jest.fn() };
        const manager = new MembershipManagement.Manager(testActionSpecs, groups, groupManager);

        const schedule = [
          { Email: 'user@example.com', Date: new Date('2024-12-31'), Type: 'Expiry1' },
          { Email: 'other@example.com', Date: new Date('2024-12-31'), Type: 'Expiry1' }
        ];

        manager.removeMemberFromExpirySchedule_('USER@EXAMPLE.COM', schedule);

        expect(schedule.length).toBe(1);
        expect(schedule[0].Email).toBe('other@example.com');
      });
    });
  });
});
