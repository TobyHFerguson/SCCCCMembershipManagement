const { MembershipManagement } = require('../src/services/MembershipManagement/Manager');
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
   */
  paidTransaction(overrides = {}) {
    return {
      "Payable Status": "paid",
      "Email Address": "test@example.com",
      "First Name": "Test",
      "Last Name": "User",
      "Payment": "1 year",
      Phone: '',
      Directory: '',
      ...overrides
    };
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
   * @returns {Array}
   */
  paidTransactions(count = 3) {
    const names = [
      { "Email Address": "test1@example.com", "First Name": "John", "Last Name": "Doe", Phone: "(408) 386-9343" },
      { "Email Address": "test2@example.com", "First Name": "Jane", "Last Name": "Smith", Phone: "" },
      { "Email Address": "test3@example.com", "First Name": "Not", "Last Name": "Member", Phone: "" }
    ];
    return names.slice(0, count).map((name, i) => ({
      "Payable Status": "paid",
      "Payment": `${i + 1} year${i > 0 ? 's' : ''}`,
      Directory: "",
      ...name
    }));
  }
};

const transactionsFixture = {
  unpaid: [
    { "Payable Status": "unpaid", "Email Address": "test1@example.com" },
    { "Payable Status": "pending", "Email Address": "test2@example.com" },
  ],
  paidAndProcessed: [
    { "Payable Status": "paid", "Email Address": "test3@example.com", Processed: "2025-06-15" },
  ],
  get paid() { 
    return [
      TestData.paidTransaction({ "Email Address": "test1@example.com", "First Name": "John", "Last Name": "Doe", Phone: "(408) 386-9343", Directory: "" }),
      TestData.paidTransaction({ "Email Address": "test2@example.com", "First Name": "Jane", "Last Name": "Smith", "Payment": "2 years", Directory: "Share Name, Share Phone" }),
      TestData.paidTransaction({ "Email Address": "test3@example.com", "First Name": "Not", "Last Name": "Member", "Payment": "3 year", Directory: "Share Email" })
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
      const msgs = manager.generateExpiringMembersList(activeMembers, [expirySchedule[0], expirySchedule[2]], PREFILL_FORM_TEMPLATE);
      expect(msgs.length).toEqual(0);
    });
    it('should do nothing if no members are ready to be expired', () => {
      const msgs = manager.generateExpiringMembersList(activeMembers, [expirySchedule[0], expirySchedule[2]], PREFILL_FORM_TEMPLATE);
      expect(msgs.length).toEqual(0);
    });
    it('should generate expiring member messages with groups only for Expiry4', () => {
      const expectedExpiringMembers = [
        { email: "test4@example.com", subject: 'Final Expiry', htmlBody: 'Your membership has expired, Not Member!', groups: groups.map(g => g.Email).join(',') },
        { email: "test2@example.com", subject: 'Second Expiry', htmlBody: 'Your membership is expiring soon, Jane Smith!', groups: null }
      ];
      const expiringMembers = manager.generateExpiringMembersList(activeMembers, expirySchedule, PREFILL_FORM_TEMPLATE);
      expect(expiringMembers).toEqual(expectedExpiringMembers);
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
    it('should throw an aggregated error if there are errors', () => {
      const errorFunction = jest.fn(() => {
        throw new Error('This is a test error');
      });
      sendEmailFun = errorFunction;
      groupRemoveFun = errorFunction;
      activeMembers = [
        TestData.activeMember({ Email: "test1@example.com", First: "John", Last: "Doe", Joined: "2020-03-10", Expires: "2021-01-10" }),
        TestData.activeMember({ Email: "test2@example.com", First: "Jane", Last: "Smith", Joined: "2020-03-10", Expires: "2021-01-10" }),
      ];
      try {
        manager.generateExpiringMembersList(activeMembers, expirySchedule, PREFILL_FORM_TEMPLATE);
      } catch (error) {
        expect(error).toBeInstanceOf(AggregateError);
        expect(error.errors.length).toEqual(2);
        expect(error.errors[0].txnNum).toEqual(1);
      }
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
      const msgs = manager.generateExpiringMembersList(activeMembers, expirySchedule, PREFILL_FORM_TEMPLATE);
      expect(expirySchedule).toEqual(expectedExpirySchedule);
      expect(activeMembers).toEqual(expectedActiveMembers);
      expect(msgs.length).toEqual(1);
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
        const msgs = manager.generateExpiringMembersList(activeMembers, expirySchedule, PREFILL_FORM_TEMPLATE);
        // generator returns one message per unique email processed
        expect(msgs.length).toEqual(1);
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
        const expiringMembers = manager.generateExpiringMembersList(activeMembers, expirySchedule, PREFILL_FORM_TEMPLATE);
        
        // Status changed to Expired
        expect(activeMembers).toEqual(expectedActiveMembers);
        
        // Groups list populated for removal
        expect(expiringMembers.length).toBe(1);
        expect(expiringMembers[0].groups).toEqual(groups.map(g => g.Email).join(','));
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
        try {
          manager.migrateCEMembers(migrators, activeMembers, expirySchedule);
          fail('Expected error not thrown');
        } catch (error) {
          expect(activeMembers).toEqual([]);
        }
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
        try {
          manager.migrateCEMembers(migrators, activeMembers, expirySchedule);
          fail('Expected error not thrown');
        } catch (error) {
          expect(error).toBeInstanceOf(AggregateError);
          expect(error.errors.length).toEqual(1);
          expect(error.errors[0].message).toBe('This is a test error');
          expect(error.errors[0].rowNum).toBe(2);
          expect(error.errors[0].email).toBe("a@b.com");
        }
      });

      it('should indicate how many members were successfully migrated', () => {
        const numMigrations = manager.migrateCEMembers(migrators, activeMembers, expirySchedule);
        expect(numMigrations).toBe(1);
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
  });

  describe('processPaidTransactions', () => {
    describe('basic tests', () => {
      it('should create the new members', () => {
        const txns = transactionsFixture.paid.map(t => { return { ...t } }) // clone the array
        const expectedMembers = [
          { Email: "test1@example.com", Period: 1, First: "John", Last: "Doe", Phone: "(408) 386-9343", Joined: today, Expires: utils.addYearsToDate(today, 1), "Renewed On": "", Status: "Active", "Directory Share Name": false, "Directory Share Email": false, "Directory Share Phone": false },
          { Email: "test2@example.com", Period: 2, First: "Jane", Last: "Smith", Phone: '', Joined: today, Expires: utils.addYearsToDate(today, 2), "Renewed On": "", Status: "Active", "Directory Share Name": true, "Directory Share Email": false, "Directory Share Phone": true },
          { Email: "test3@example.com", Period: 3, First: "Not", Last: "Member", Phone: '', Joined: today, Expires: utils.addYearsToDate(today, 3), "Renewed On": "", Status: "Active", "Directory Share Name": false, "Directory Share Email": true, "Directory Share Phone": false }]

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
        const txns = [TestData.paidTransaction({ "Email Address": "test1@example.com", "First Name": "John", "Last Name": "Doe", "Directory": "Share Email" })]
        const members = [TestData.activeMember({ Email: "test1@example.com", First: "John", Last: "Doe", Joined: "2024-03-10", Expires: "2025-03-10" })]
        const expectedMembers = [
          { Email: "test1@example.com", Period: 1, First: "John", Last: "Doe", Phone: '', Joined: "2024-03-10", Expires: utils.addYearsToDate("2025-03-10", 1), "Renewed On": today, Status: "Active", "Directory Share Email": true, "Directory Share Name": false, "Directory Share Phone": false },
        ]
        manager.processPaidTransactions(txns, members, expirySchedule,);
        expect(members.length).toEqual(1)
        expect(members).toEqual(expectedMembers);
      });
      it('should treat a renewal for a member with an expired membership as a new member', () => {
        const txns = [TestData.paidTransaction({ "Email Address": "test1@example.com", "First Name": "John", "Last Name": "Doe", "Directory": "Share Email" })]
        const members = [TestData.activeMember({ Email: "test1@example.com", First: "John", Last: "Doe", Joined: "2024-03-10", Expires: "2025-03-10", Status: "Expired" })]
        const expectedMembers = [
          { Email: "test1@example.com", Period: 1, First: "John", Last: "Doe", Joined: "2024-03-10", Expires: "2025-03-10", "Renewed On": "", Status: "Expired", Phone: '', "Directory Share Name": false, "Directory Share Email": false, "Directory Share Phone": false },
          { Email: "test1@example.com", Period: 1, First: "John", Last: "Doe", Joined: today, Expires: utils.addYearsToDate(today, 1), "Renewed On": "", Status: "Active", Phone: '', "Directory Share Name": false, "Directory Share Email": true, "Directory Share Phone": false },
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

    describe('logging tests', () => {


      it('should produce interesting logs when processing transactions', () => {
        const txns = [{ ...transactionsFixture.paid[0] }, { ...transactionsFixture.paid[1] }];
        activeMembers = [{ Email: "test2@example.com", Period: 1, First: "John", Last: "Doe", Joined: "2020-03-10", Expires: "2021-01-10", "Renewed On": "", Status: 'Active' }];

        manager.processPaidTransactions(txns, activeMembers, expirySchedule,);
        expect(consoleSpy).toHaveBeenCalledWith('transaction on row 3 test2@example.com is a renewing member');
        expect(consoleSpy).toHaveBeenCalledWith('transaction on row 2 test1@example.com is a new member');
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
            Phone: '',
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

      it('if renewal is after expiry then new expiry is today + period', () => {
        activeMembers = [TestData.activeMember({ Email: "test1@example.com", First: "John", Last: "Doe", Joined: joinDate, Expires: utils.addDaysToDate(joinDate, -10) })]
        const expectedMembers = [
          {
            Email: "test1@example.com",
            Period: 1,
            First: "John",
            Last: "Doe",
            Phone: '',
            Joined: joinDate,
            Expires: utils.addYearsToDate(manager.today(), 1),
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
        { Status: 'Active', Email: 'captenphil@aol.com', First: 'Phil', Last: 'Stotts', Phone: '(831) 345-9634', Joined: '8/8/2017', Expires: '12/15/2026', Period: 3, 'Directory Share Name': false, 'Directory Share Email': false, 'Directory Share Phone': false, Migrated: '3/17/2025', 'Renewed On': '' },
        { Status: 'Active', Email: 'phil.stotts@gmail.com', First: 'Phil', Last: 'Stotts', Phone: '(831) 345-9634', Joined: '10/23/2025', Expires: '10/23/2027', Period: 2, 'Directory Share Name': true, 'Directory Share Email': true, 'Directory Share Phone': true, Migrated: '', 'Renewed On': '' }
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
        Migrated: new Date('3/17/2025'),
        'Renewed On': new Date('10/23/2025')
      };

      const result = manager.convertJoinToRenew(0, 1, membershipData, expirySchedule);
      expect(result.success).toBe(true);
      expect(membershipData.length).toBe(1);
      const merged = membershipData[0];
      expect(merged).toEqual(expectedMembershipData);

      expect(expirySchedule).toEqual(expectedExpirySchedule);
    });

    it('does not merge or delete INITIAL when LATEST.Joined > INITIAL.Expires', () => {
      const membershipData = [
        { Status: 'Active', Email: 'old@example.com', Joined: '1/1/2010', Expires: '1/1/2011', Period: 1 },
        { Status: 'Active', Email: 'new@example.com', Joined: '1/1/2015', Expires: '1/1/2016', Period: 2 }
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
  });

  describe('similarity', () => {
    it('should detect similar members', () => {
      const member = { Email: "test@example.com", First: "John", Last: "Doe", Phone: "123-456-7890" };
      const otherMember = { Email: "test@example.com", First: "Jane", Last: "Smith", Phone: "098-765-4321" };
      const similar = MembershipManagement.Manager.isSimilarMember(member, otherMember);
      expect(similar).toBe(true);
    });
    it('should not detect dissimilar members', () => {
      const member = { Email: "test@example.com", First: "John", Last: "Doe", Phone: "123-456-7890" };
      const otherMember = { Email: "test2@example.com", First: "Jane", Last: "Smith", Phone: "098-765-4321" };
      const similar = MembershipManagement.Manager.isSimilarMember(member, otherMember);
      expect(similar).toBe(false);
    });
    it('should not detect identity as similarity', () => {
      const member = { Email: "test@example.com", First: "John", Last: "Doe", Phone: "123-456-7890" };
      const similar = MembershipManagement.Manager.isSimilarMember(member, member);
      expect(similar).toBe(false);
    });
  });

  describe('test findPossibleRenewals()', () => {
    it('should find similar active member pairs where they joined again before their membership expired and which are active ', () => {
      const members = [
        { Email: "test@example.com", First: "John", Last: "Smith", Phone: "123-456-7890", Status: "Active", Joined: "2020-01-01", Expires: "2030-01-01" },
        { Email: 'foo@example.com', First: "John", Last: "Smith", Phone: "27", Status: "Active", Joined: "2025-01-01", Expires: "2040-01-01" },
        // { Email: "test2@example.com", First: "John", Last: "Smith", Phone: "098-765-4321", Status: "Active", Joined: "2020-01-01", Expires: "2023-01-01" },
        // { Email: "test3@example.com", First: "Jane", Last: "Blah", Phone: "098-765-4321", Status: "Active", Joined: "2021-01-01", Expires: "2024-01-01" }
      ];
      const pairs = MembershipManagement.Manager.findPossibleRenewals(members);
      expect(pairs).toEqual([[0, 1]]);
    });
    it('should not find similar member pairs where the second join is after the first expiry', () => {
      const members = [
        { Email: 'foo@example.com', First: "John", Last: "Smith", Phone: "27", Status: "Active", Joined: "2025-01-01", Expires: "2040-01-01" },
        { Email: "test@example.com", First: "John", Last: "Smith", Phone: "123-456-7890", Status: "Active", Joined: "2020-01-01", Expires: "2022-01-01" },
      ];
      const pairs = MembershipManagement.Manager.findPossibleRenewals(members);
      expect(pairs).toEqual([]);
    });
    it('should not find dissimilar member pairs', () => {
      const members = [
        { Email: "test@example.com", First: "John", Last: "Doe", Phone: "123-456-7890", Status: "Active" },
        { Email: "test2@example.com", First: "Jane", Last: "Smith", Phone: "098-765-4321", Status: "Active" }
      ];
      const pairs = MembershipManagement.Manager.findPossibleRenewals(members);
      expect(pairs).toEqual([]);
    });
    it('should ignore inactive members', () => {
      const members = [
        { Email: "inactive@example.com", First: "Inactive", Last: "Member", Phone: "123-456-7890", Status: "Inactive" },
        { Email: "active@example.com", First: "Active", Last: "Member", Phone: "0123-456-7890", Status: "Active" }
      ];
      const pairs = MembershipManagement.Manager.findPossibleRenewals(members);
      expect(pairs).toEqual([]);
    });
  });
});