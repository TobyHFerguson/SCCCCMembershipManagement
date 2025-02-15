const Manager = require('../src/JavaScript/Manager');
(utils = require('../src/JavaScript/utils')); 
const transactionsFixture = {
  unpaid: [
    { "Payable Status": "unpaid", "Email Address": "test1@example.com" },
    { "Payable Status": "pending", "Email Address": "test2@example.com" }
  ],
  paid: [
    { "Payable Status": "paid", "Email Address": "test1@example.com", "First Name": "John", "Last Name": "Doe", "Payment": "1 year", Phone: "(408) 386-9343" },
    { "Payable Status": "paid", "Email Address": "test2@example.com", "First Name": "Jane", "Last Name": "Smith", "Payment": "2 years" },
    { "Payable Status": "paid", "Email Address": "test3@example.com", "First Name": "Not", "Last Name": "Member", "Payment": "3 year" },

  ],
  caseInsensitive: [
    { "Payable Status": "Paid", "Email Address": "test1@example.com", "First Name": "John", "Last Name": "Doe", "Payment": "1 year" },
    { "Payable Status": "PAID", "Email Address": "test2@example.com", "First Name": "Jane", "Last Name": "Smith", "Payment": "2 years" },
    { "Payable Status": "paid", "Email Address": "test3@example.com", "First Name": "Not", "Last Name": "Member", "Payment": "3 year" },

  ],
  differentTerms: [
    { "Payable Status": "paid", "Email Address": "test1@example.com", "First Name": "John", "Last Name": "Doe", "Payment": "3 years" },
    { "Payable Status": "paid", "Email Address": "test2@example.com", "First Name": "Jane", "Last Name": "Smith", "Payment": "1 year" },
    { "Payable Status": "paid", "Email Address": "test3@example.com", "First Name": "Not", "Last Name": "Member", "Payment": "3 year" },

  ],
  noTerm: [
    { "Payable Status": "paid", "Email Address": "test1@example.com", "First Name": "John", "Last Name": "Doe", "Payment": "" },
    { "Payable Status": "paid", "Email Address": "test2@example.com", "First Name": "Jane", "Last Name": "Smith" },
    { "Payable Status": "paid", "Email Address": "test3@example.com", "First Name": "Not", "Last Name": "Member" },

  ]
};
const actionSpecs = [
  { Type: 'Migrate', Subject: 'Migrate', Body: 'Migrate' },
  { Type: 'Join', Subject: 'Welcome to the club', Body: 'Welcome to the club, {First} {Last}!' },
  { Type: 'Renew', Subject: 'Renewal', Body: 'Thank you for renewing, {First} {Last}!' },
  { Type: 'Expiry1', Subject: 'First Expiry', Body: 'Your membership is expiring soon, {First} {Last}!', Offset: -10 },
  { Type: 'Expiry2', Subject: 'Second Expiry', Body: 'Your membership is expiring soon, {First} {Last}!', Offset: -5 },
  { Type: 'Expiry3', Subject: 'Third Expiry', Body: 'Your membership is expiring soon, {First} {Last}!', Offset: 0 },
  { Type: 'Expiry4', Subject: 'Final Expiry', Body: 'Your membership has expired, {First} {Last}!', Offset: 10 },
]

describe('Manager tests', () => {
  const actionSpecByType = new Map(actionSpecs.map(as => [as.Type, as]));
  const O1 = actionSpecByType.get('Expiry1').Offset;
  const O2 = actionSpecByType.get('Expiry2').Offset;
  const O3 = actionSpecByType.get('Expiry3').Offset;
  const O4 = actionSpecByType.get('Expiry4').Offset;
  const today = '2025-06-15';
  let manager;
  let activeMembers;
  let expiredMembers;
  let actionSchedule;
  let groupAddFun;
  let groupRemoveFun;
  let sendEmailFun;
  let groupEmails;
  let numProcessed;

  beforeEach(() => {
    manager = new Manager(today);
    activeMembers = [];
    expiredMembers = [];
    actionSchedule = [];
    numProcessed = 0;
    groupRemoveFun = jest.fn();
    groupAddFun = jest.fn();
    sendEmailFun = jest.fn();
    groupEmails = [{ Email: "a@b.com" }];
  });

  describe('logging tests', () => {
    let consoleSpy;

    beforeEach(() => {
      consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => { });
    });

    afterEach(() => {
      consoleSpy.mockRestore();
    });

    it('should produce interesting logs when processing transactions', () => {
      const txns = [{ ...transactionsFixture.paid[0] }, { ...transactionsFixture.paid[1] }];
      activeMembers = [{ Email: "test2@example.com", Period: 1, First: "John", Last: "Doe", Joined: "2020-03-10", Expires: "2021-01-10", "Renewed On": "" }];

      manager.processPaidTransactions(txns, activeMembers, groupAddFun, sendEmailFun, actionSpecs, actionSchedule, groupEmails);
      expect(consoleSpy).toHaveBeenCalledWith('transaction on row 3 test2@example.com is a renewing member');
      expect(consoleSpy).toHaveBeenCalledWith('transaction on row 2 test1@example.com is a new member');
    });
  });

  describe('Aggregated Error tests', () => {
    beforeEach(() => {
      const errorFunction = jest.fn(() => {
        throw new Error('This is a test error');
      });
      sendEmailFun = errorFunction;
      groupRemoveFun = errorFunction;
    });

    it('should throw an aggregated error if there are errors', () => {
      activeMembers = [
        { Email: "test1@example.com", Period: 1, First: "John", Last: "Doe", Joined: "2020-03-10", Expires: "2021-01-10", "Renewed On": "" },
        { Email: "test2@example.com", Period: 1, First: "Jane", Last: "Smith", Joined: "2020-03-10", Expires: "2021-01-10", "Renewed On": "" },
      ];
      try {
        manager.processExpirations(activeMembers, expiredMembers, actionSchedule, actionSpecs, groupRemoveFun, sendEmailFun, groupEmails);
      } catch (error) {
        expect(error).toBeInstanceOf(AggregateError);
        expect(error.errors.length).toEqual(2);
        expect(error.errors[0].txnNum).toEqual(1);
      }
    });
  });

  describe('processExpirations', () => {
    beforeEach(() => {
      actionSchedule = [
        { Date: new Date('2050-01-01'), Type: utils.ActionType.Expiry1, Email: "test1@example.com" },
        { Date: today, Type: utils.ActionType.Expiry2, Email: "test1@example.com" },
        { Date: new Date('2045-01-01'), Type: utils.ActionType.Expiry1, Email: "test1@example.com" },
        { Date: today, Type: utils.ActionType.Expiry4, Email: "test1@example.com" }
      ];
    });

    it('should do nothing if there are no members to expire', () => {
      numProcessed = manager.processExpirations(activeMembers, expiredMembers, actionSchedule, actionSpecs, groupRemoveFun, sendEmailFun, groupEmails);
      expect(numProcessed).toEqual(0);
    });

    it('should expire a member if they are fully expired', () => {
      activeMembers = [{ Email: "test1@example.com", Period: 1, First: "John", Last: "Doe", Joined: "2020-03-10", Expires: "2021-01-10", "Renewed On": "" }];
      const expectedExpiredMembers = [{ Email: "test1@example.com", Period: 1, First: "John", Last: "Doe", Joined: "2020-03-10", Expires: "2021-01-10", "Renewed On": "" }];
      numProcessed = manager.processExpirations(activeMembers, expiredMembers, actionSchedule, actionSpecs, groupRemoveFun, sendEmailFun, groupEmails);
      expect(numProcessed).toEqual(2);
      expect(activeMembers.length).toEqual(0);
      expect(expiredMembers.length).toEqual(1);
      expect(expiredMembers).toEqual(expectedExpiredMembers);
      expect(groupRemoveFun).toHaveBeenCalledTimes(1);
      expect(groupRemoveFun).toHaveBeenCalledWith(groupEmails[0].Email, expectedExpiredMembers[0].Email);
      expect(sendEmailFun).toHaveBeenCalledTimes(2);
      expect(sendEmailFun).toHaveBeenCalledWith({ to: expectedExpiredMembers[0].Email, subject: actionSpecByType.get('Expiry4').Subject, htmlBody: actionSpecByType.get('Expiry4').Body.replace('{First}', expectedExpiredMembers[0].First).replace('{Last}', expectedExpiredMembers[0].Last) });
      expect(sendEmailFun).toHaveBeenCalledWith({ to: expectedExpiredMembers[0].Email, subject: actionSpecByType.get('Expiry2').Subject, htmlBody: actionSpecByType.get('Expiry2').Body.replace('{First}', expectedExpiredMembers[0].First).replace('{Last}', expectedExpiredMembers[0].Last) });
    });
  });

  describe('migrations', () => {
    let migrators;
    beforeEach(() => {
      migrators = [{ Email: "a@b.com", Period: 1, First: "John", Last: "Doe", Phone: '(408) 386-9343', Joined: "2020-03-10", Expires: "2021-01-10" }];
    });

    it('should migrate members and record the date of migration', () => {
      const expectedMigrators = [{ ...migrators[0], Migrated: today }];
      const expectedMembers = [{ Email: "a@b.com", Period: 1, First: "John", Last: "Doe", Phone: '(408) 386-9343', Joined: '2020-03-10', Expires: '2021-01-10', "Migrated": today }];
      manager.migrateCEMembers(migrators, activeMembers, actionSchedule, actionSpecs, groupAddFun, sendEmailFun, groupEmails);
      expect(activeMembers).toEqual(expectedMembers);
      expect(migrators).toEqual(expectedMigrators);
    });

    it('should not migrate members that have already been migrated', () => {
      migrators = [{ ...migrators[0], Migrated: today }];
      manager.migrateCEMembers(migrators, activeMembers, actionSchedule, actionSpecs, groupAddFun, sendEmailFun, groupEmails);
      expect(activeMembers).toEqual([]);
    });

    it('should create an action schedule for the migrated member', () => {
      manager.migrateCEMembers(migrators, activeMembers, actionSchedule, actionSpecs, groupAddFun, sendEmailFun, groupEmails);
      expect(actionSchedule.length).toEqual(4);
    });

    it('should add migrated members to the groups', () => {
      manager.migrateCEMembers(migrators, activeMembers, actionSchedule, actionSpecs, groupAddFun, sendEmailFun, groupEmails);
      expect(groupAddFun).toHaveBeenCalledTimes(1);
      expect(groupAddFun).toHaveBeenCalledWith(migrators[0].Email, groupEmails[0].Email);
    });

    it('should send emails to the members', () => {
      manager.migrateCEMembers(migrators, activeMembers, actionSchedule, actionSpecs, groupAddFun, sendEmailFun, groupEmails);
      expect(sendEmailFun).toHaveBeenCalledTimes(1);
      expect(sendEmailFun).toHaveBeenCalledWith({ to: migrators[0].Email, subject: actionSpecByType.get('Migrate').Subject, htmlBody: actionSpecByType.get('Migrate').Body.replace('{First}', migrators[0].First).replace('{Last}', migrators[0].Last) });
    });

    it('should provide logging information', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => { });
      manager.migrateCEMembers(migrators, activeMembers, actionSchedule, actionSpecs, groupAddFun, sendEmailFun, groupEmails);
      expect(consoleSpy).toHaveBeenCalledWith('Migrating a@b.com, row 2');
      expect(consoleSpy).toHaveBeenCalledWith('Migrated a@b.com, row 2');
    });

    it('should continue even when there are errors', () => {
      groupAddFun = jest.fn(() => { throw new Error('This is a test error') });
      try {
        manager.migrateCEMembers(migrators, activeMembers, actionSchedule, actionSpecs, groupAddFun, sendEmailFun, groupEmails);
      } catch (error) {
        expect(error).toBeInstanceOf(AggregateError);
        expect(error.errors.length).toEqual(1);
        expect(error.errors[0].rowNum).toBe(2);
        expect(error.errors[0].email).toBe("a@b.com")
      }
    });

    it('should indicate how many members were successfully migrated', () => {
      const numMigrations = manager.migrateCEMembers(migrators, activeMembers, actionSchedule, actionSpecs, groupAddFun, sendEmailFun, groupEmails);
      expect(numMigrations).toBe(1);
    });
  });

  describe('processPaidTransactions_', () => {
    beforeEach(() => {
      groupAddFun = jest.fn();
      sendEmailFun = jest.fn();
    });

    describe('basic tests', () => {
      it('should create the new members', () => {
        const txns = transactionsFixture.paid
        const members = []
        const expectedMembers = [
          { Email: "test1@example.com", Period: 1, First: "John", Last: "Doe", Phone: "(408) 386-9343", Joined: today, Expires: "2026-01-10", "Renewed On": "" },
          { Email: "test2@example.com", Period: 2, First: "Jane", Last: "Smith", Phone: '', Joined: today, Expires: "2027-01-10", "Renewed On": "" },
          { Email: "test3@example.com", Period: 3, First: "Not", Last: "Member", Phone: '', Joined: today, Expires: "2028-01-10", "Renewed On": "" }]

        manager.processPaidTransactions(txns, members, groupAddFun, sendEmailFun, actionSpecs, [], []);
        members.forEach(e => { e.Joined = utils.getDateString(e.Joined); e.Expires = utils.getDateString(e.Expires) });
        expectedMembers.forEach(e => { e.Joined = utils.getDateString(e.Joined); e.Expires = utils.getDateString(e.Expires) });
        expect(members.length).toEqual(3)
        expect(members).toEqual(expectedMembers);
      });

      it('should handle membership renewals', () => {
        const txns = [{ "Payable Status": "paid", "Email Address": "test1@example.com", "First Name": "John", "Last Name": "Doe", "Payment": "1 year" },
        ]
        const members = [{ Email: "test1@example.com", Period: 1, First: "John", Last: "Doe", Joined: "2024-03-10", Expires: "2025-03-10", "Renewed On": "" },]
        const expectedMembers = [
          { Email: "test1@example.com", Period: 1, First: "John", Last: "Doe", Joined: "2024-03-10", Expires: utils.addYearsToDate("2025-03-10", 1), "Renewed On": today },
        ]
        manager.processPaidTransactions(txns, members, groupAddFun, sendEmailFun, actionSpecs, []);
        members.forEach(e => { e.Joined = utils.getDateString(e.Joined); e.Expires = utils.getDateString(e.Expires) });
        expectedMembers.forEach(e => { e.Joined = utils.getDateString(e.Joined); e.Expires = utils.getDateString(e.Expires) });
        expect(members.length).toEqual(1)
        expect(members).toEqual(expectedMembers);
      });
    });

    describe('group addition tests', () => {
      it('should add a member to a group when the member is added', () => {
        const txns = [{ "Payable Status": "paid", "Email Address": "test1@example.com", "First Name": "John", "Last Name": "Doe", "Payment": "1 year" }]
        const members = []
        manager.processPaidTransactions(txns, members, groupAddFun, sendEmailFun, actionSpecs, [], [{ Email: "group@email.com" }]);
        manager.processPaidTransactions(txns, members, groupAddFun);
        expect(groupAddFun).toHaveBeenCalledTimes(1);
        expect(groupAddFun).toHaveBeenCalledWith("test1@example.com", "group@email.com")
      })

      it('should not add a member to a group when the member is renewed', () => {
        const txns = [{ "Payable Status": "paid", "Email Address": "test1@example.com", "First Name": "John", "Last Name": "Doe", "Payment": "1 year" }]
        const members = [{ Email: "test1@example.com", Period: 1, First: "John", Last: "Doe", Joined: "2024-03-10", Expires: "2025-03-10", "Renewed On": "" },]
        manager.processPaidTransactions(txns, members, groupAddFun, sendEmailFun, actionSpecs, []);
        manager.processPaidTransactions(txns, members, groupAddFun);
        expect(groupAddFun).toHaveBeenCalledTimes(0);
      });
    });

    describe('sending emails', () => {
      it('should send an email when a member is added', () => {
        const txns = [{ "Payable Status": "paid", "Email Address": "test1@example.com", "First Name": "John", "Last Name": "Doe", "Payment": "1 year" }]
        const members = []
        manager.processPaidTransactions(txns, members, groupAddFun, sendEmailFun, actionSpecs, [], []);
        expect(sendEmailFun).toHaveBeenCalledWith({
          to: members[0].Email,
          subject: utils.expandTemplate(actionSpecByType.get('Join').Subject, members[0]),
          htmlBody: utils.expandTemplate(actionSpecByType.get('Join').Body, members[0])
        });
        expect(sendEmailFun).toHaveBeenCalledTimes(1);
      });

      it('should send an email when the member is renewed', () => {
        const txns = [{ "Payable Status": "paid", "Email Address": "test1@example.com", "First Name": "John", "Last Name": "Doe", "Payment": "1 year" }]
        const members = [{ Email: "test1@example.com", Period: 1, First: "John", Last: "Doe", Joined: "2024-03-10", Expires: "2025-03-10", "Renewed On": "" },]
        manager.processPaidTransactions(txns, members, groupAddFun, sendEmailFun, actionSpecs, []);
        expect(sendEmailFun).toHaveBeenCalledWith({
          to: members[0].Email,
          subject: utils.expandTemplate(actionSpecByType.get('Renew').Subject, members[0]),
          htmlBody: utils.expandTemplate(actionSpecByType.get('Renew').Body, members[0])
        });
        expect(sendEmailFun).toHaveBeenCalledTimes(1);
      });
    })

    describe('membership expiry period tests', () => {
      it('if renewal is before expiry then new expiry is  old expiry + period', () => {
        const members = [{ Email: "test1@example.com", Period: 1, First: "John", Last: "Doe", Joined: manager.today(), Expires: utils.addDaysToDate(manager.today(), 10), "Renewed On": "" },]
        const expectedMembers = [
          { Email: "test1@example.com", Period: 1, First: "John", Last: "Doe", Joined: utils.getDateString(), Expires: utils.addDaysToDate(new Date(), 365 + 10), "Renewed On": manager.today() },
        ]
        manager.processPaidTransactions(transactionsFixture.paid, members);
        members.forEach(e => { e.Joined = utils.getDateString(e.Joined); e.Expires = utils.getDateString(e.Expires) });
        expectedMembers.forEach(e => { e.Joined = utils.getDateString(e.Joined); e.Expires = utils.getDateString(e.Expires) });
      });

      it('if renewal is after expiry then new expiry is today + period', () => {
        const members = [{ Email: "test1@example.com", Period: 1, First: "John", Last: "Doe", Joined: manager.today(), Expires: utils.addDaysToDate(manager.today(), -10), "Renewed On": "" },]
        const expectedMembers = [
          { Email: "test1@example.com", Period: 1, First: "John", Last: "Doe", Joined: utils.getDateString(), Expires: utils.addDaysToDate(new Date(), 365), "Renewed On": manager.today() },
        ]
        manager.processPaidTransactions(transactionsFixture.paid, members);
        members.forEach(e => { e.Joined = utils.getDateString(e.Joined); e.Expires = utils.getDateString(e.Expires) });
        expectedMembers.forEach(e => { e.Joined = utils.getDateString(e.Joined); e.Expires = utils.getDateString(e.Expires) });
      });
    })

    describe('period calculation', () => {
      it('should return correct period for transactions with different payment terms', () => {
        const members = [];
        const expectedMembers = [{ Email: "test1@example.com", Period: 3, first: "John", last: "Doe" },
        { Email: "test2@example.com", Period: 1, first: "Jane", last: "Smith", },
        { Email: "test3@example.com", Period: 3, first: "Not", last: "Member" }
        ];
        manager.processPaidTransactions(transactionsFixture.differentTerms, members, groupAddFun, sendEmailFun, actionSpecs, [], []);
        expect(members.map(m => m.Period)).toEqual(expectedMembers.map(m => m.Period));

      });

      it('should return period as 1 if payment term is not specified', () => {
        const members = []
        manager.processPaidTransactions(transactionsFixture.noTerm, members, groupAddFun, sendEmailFun, actionSpecs, [], []);
        expect(members.map(m => m.Period)).toEqual([1, 1, 1])
      });
    })
  });


  describe('test the utils.getDateString function', () => {
    it('should return a date string in the format yyyy-mm-dd', () => {
      const date = new Date('2021-01-01');
      const result = utils.getDateString(date);
      expect(result).toEqual('2021-01-01');
    });

    it('should work with date objects', () => {
      const date = new Date('2021-01-01');
      const result = utils.getDateString(date);
      expect(result).toEqual('2021-01-01');
    });
  });

  describe('addDaysToDate  ', () => {
    it('should add a number of days to a date', () => {
      const date = '2021-01-01';
      const result = utils.addDaysToDate(date, 2);
      expect(result).toEqual(new Date('2021-01-03'));
    });

    it('shoud work with negative numbers', () => {
      const date = new Date('2021-01-01');
      const result = utils.addDaysToDate(date, -2);
      expect(result).toEqual(new Date('2020-12-30'));
    });

    it('should work with zero', () => {
      const date = new Date('2021-01-01');
      const result = utils.addDaysToDate(date, 0);
      expect(result).toEqual(new Date('2021-01-01'));
    });

    it('should work with a string date', () => {
      const date = '2021-01-01';
      const result = utils.addDaysToDate(date, 2);
      expect(result).toEqual(new Date('2021-01-03'));
    });
  })

  describe.skip('Action Spec tests', () => {

    // it('should calculate windows', () => {
    //     triggers.setActionSpec(actionSpec);
    //     triggers.setToday('2000-03-10')
    //     let date = '2000-03-07';
    //     expect(triggers.inWindow(date, 'Expiry1')).toBeFalsy();
    //     expect(triggers.inWindow(date, 'Expiry2')).toBeFalsy();
    //     expect(triggers.inWindow(date, 'Expiry3')).toBeFalsy();
    //     expect(triggers.inWindow(date, 'Expiry4')).toBeFalsy();
    //     date = '2000-03-08';
    //     expect(triggers.inWindow(date, 'Expiry1')).toBeTruthy();
    //     expect(triggers.inWindow(date, 'Expiry2')).toBeFalsy();
    //     expect(triggers.inWindow(date, 'Expiry3')).toBeFalsy();
    //     expect(triggers.inWindow(date, 'Expiry4')).toBeFalsy();
    //     date = '2000-03-09';
    //     expect(triggers.inWindow(date, 'Expiry1')).toBeTruthy();
    //     expect(triggers.inWindow(date, 'Expiry2')).toBeFalsy();
    //     expect(triggers.inWindow(date, 'Expiry3')).toBeFalsy();
    //     expect(triggers.inWindow(date, 'Expiry4')).toBeFalsy();
    //     date = '2000-03-10';
    //     expect(triggers.inWindow(date, 'Expiry1')).toBeTruthy();
    //     expect(triggers.inWindow(date, 'Expiry2')).toBeTruthy();
    //     expect(triggers.inWindow(date, 'Expiry3')).toBeTruthy();
    //     expect(triggers.inWindow(date, 'Expiry4')).toBeFalsy();
    //     date = '2000-03-11';
    //     expect(triggers.inWindow(date, 'Expiry1')).toBeTruthy();
    //     expect(triggers.inWindow(date, 'Expiry2')).toBeTruthy();
    //     expect(triggers.inWindow(date, 'Expiry3')).toBeTruthy();
    //     expect(triggers.inWindow(date, 'Expiry4')).toBeTruthy();
    // })
  });

  describe('calculateExpirationDate', () => {
    test('should calculate expiration date based on period in years from today if no existing expiration date is provided', () => {
      const period = 2;
      const result = manager.calculateExpirationDate(period);
      const expectedDate = new Date(today);
      expectedDate.setFullYear(expectedDate.getFullYear() + period);
      expect(utils.getDateString(result)).toEqual(utils.getDateString(expectedDate));
    });

    test('should calculate expiration date based on period in years from existing expiration date if provided', () => {
      const period = 3;
      const existingExpirationDate = new Date('2030-01-01');
      const result = manager.calculateExpirationDate(period, existingExpirationDate);
      const expectedDate = new Date('2033-01-01');
      expect(utils.getDateString(result)).toEqual(utils.getDateString(expectedDate));
    });

    test('should return the greater of period added to today or the existing expiration date', () => {
      const period = 1;
      const existingExpirationDate = new Date();
      existingExpirationDate.setFullYear(existingExpirationDate.getFullYear() + 2);
      const result = manager.calculateExpirationDate(period, existingExpirationDate);
      const expectedDate = new Date();
      expectedDate.setFullYear(expectedDate.getFullYear() + period + 2);
      expect(utils.getDateString(result)).toEqual(utils.getDateString(expectedDate));
    });

    test('should handle leap years correctly', () => {
      const period = 1;
      const existingExpirationDate = new Date('2052-02-29');
      const result = manager.calculateExpirationDate(period, existingExpirationDate);
      const expectedDate = new Date('2053-03-01')
      expect(utils.getDateString(result)).toEqual(utils.getDateString(expectedDate));
    });

    test('should handle negative periods correctly', () => {
      const period = -1;
      const existingExpirationDate = new Date('2050-01-01');
      const result = manager.calculateExpirationDate(period, existingExpirationDate);
      const expectedDate = new Date('2049-01-01');
      expect(utils.getDateString(result)).toEqual(utils.getDateString(expectedDate));
    });
  });

  describe('actionSchedule', () => {
    it('should create an actionSchedule', () => {
      const txn = { "Payable Status": "paid", "Email Address": "test1@example.com", "First Name": "John", "Last Name": "Doe", "Payment": "1 year" }
      const actionSchedule = []
      const expected = [
        { Email: txn["Email Address"], Type: utils.ActionType.Expiry1, Date: utils.addDaysToDate(today, 365 + O1) },
        { Email: txn["Email Address"], Type: utils.ActionType.Expiry2, Date: utils.addDaysToDate(today, 365 + O2) },
        { Email: txn["Email Address"], Type: utils.ActionType.Expiry3, Date: utils.addDaysToDate(today, 365 + O3), },
        { Email: txn["Email Address"], Type: utils.ActionType.Expiry4, Date: utils.addDaysToDate(today, 365 + O4), }
      ];
      expected.forEach(e => { console.log(e); e.Date = utils.getDateString(e.Date) });
      manager.processPaidTransactions([txn], [], groupAddFun, sendEmailFun, actionSpecs, actionSchedule, []);
      actionSchedule.forEach(a => a.Date = utils.getDateString(a.Date));
      expect(actionSchedule).toEqual(expected);
    })

    it('should update an existing actionSchedule', () => {
      const exp = utils.getDateString(utils.addDaysToDate(today, 60))
      const members = [{ Email: "test1@example.com", Period: 1, first: "John", last: "Doe", Joined: utils.getDateString('2021-01-01'), Expires: exp }];
      const actionSchedule = [
        { Email: "test1@example.com", Type: utils.ActionType.Join, Date: today, },
        { Email: "test1@example.com", Type: utils.ActionType.Expiry1, Date: utils.addDaysToDate(today, 365 + O1) },
        { Email: "test1@example.com", Type: utils.ActionType.Expiry2, Date: utils.addDaysToDate(today, 365 +O2) },
        { Email: "test1@example.com", Type: utils.ActionType.Expiry3, Date: utils.addDaysToDate(today, 365 + O3), },
        { Email: "test1@example.com", Type: utils.ActionType.Expiry4, Date: utils.addDaysToDate(today, 365 + O4), }
      ].map(e => { e.Date = utils.getDateString(e.Date); return e; });
      const txns = [
        { "Payable Status": "paid", "Email Address": "test1@example.com", "First Name": "John", "Last Name": "Doe", "Payment": "1 year" },
        { "Payable Status": "paid", "Email Address": "test2@example.com", "First Name": "Jane", "Last Name": "Smith", "Payment": "3 years" }
      ]
      const exp1 = manager.calculateExpirationDate(1, exp)
      const exp3 = manager.calculateExpirationDate(3)
      const expected = [
        { Email: "test1@example.com", Type: utils.ActionType.Expiry1, Date: utils.addDaysToDate(exp1,  O1) },
        { Email: "test1@example.com", Type: utils.ActionType.Expiry2, Date: utils.addDaysToDate(exp1, O2) },
        { Email: "test1@example.com", Type: utils.ActionType.Expiry3, Date: utils.addDaysToDate(exp1,  O3),},
        { Email: "test1@example.com", Type: utils.ActionType.Expiry4, Date: utils.addDaysToDate(exp1, O4), },
        { Email: "test2@example.com", Type: utils.ActionType.Expiry1, Date: utils.addDaysToDate(exp3, O1) },
        { Email: "test2@example.com", Type: utils.ActionType.Expiry2, Date: utils.addDaysToDate(exp3, O2) },
        { Email: "test2@example.com", Type: utils.ActionType.Expiry3, Date: utils.addDaysToDate(exp3,  O3), },
        { Email: "test2@example.com", Type: utils.ActionType.Expiry4, Date: utils.addDaysToDate(exp3,  O4), },
      ].map(e => { e.Date = utils.getDateString(e.Date); return e; });
      manager.processPaidTransactions(txns, members, groupAddFun, sendEmailFun, actionSpecs, actionSchedule, []);
      actionSchedule.forEach(a => a.Date = utils.getDateString(a.Date));
      expect(actionSchedule).toEqual(expected);
    });
  });

  describe('addRenewedMemberToActionSchedule', () => {
    let actionSchedule;
    let emailSpecs;
    let member;

    beforeEach(() => {
      actionSchedule = [
        { Date: new Date('2023-01-01'), Email: 'test@example.com', Type: utils.ActionType.Expiry1 },
        { Date: new Date('2023-02-01'), Email: 'test@example.com', Type: utils.ActionType.Expiry2 }
      ];
      emailSpecs = actionSpecs
      member = {
        Email: 'test@example1.com',
        First: 'John',
        Last: 'Doe',
        Joined: new Date('2022-01-01'),
        Period: 1,
        Expires: new Date('2023-01-01'),
        "Renewed On": new Date('2023-01-01')
      };
    });

    it('should remove existing action schedule entries for the member', () => {
      const member = { Email: "test1@example.com", Period: 1, first: "John", last: "Doe", Joined: utils.getDateString('2021-01-01'), Expires: utils.getDateString('2022-01-10') };
      const expected = [
        { Email: member.Email, Type: utils.ActionType.Expiry1, Date: utils.addDaysToDate('2022-01-10', O1), },
        { Email: member.Email, Type: utils.ActionType.Expiry2, Date: utils.addDaysToDate('2022-01-10', O2), },
        { Email: member.Email, Type: utils.ActionType.Expiry3, Date: utils.addDaysToDate('2022-01-10', O3), },
        { Email: member.Email, Type: utils.ActionType.Expiry4, Date: utils.addDaysToDate('2022-01-10', O4), }
      ].map(e => { e.Date = utils.getDateString(e.Date); return e; });
      actionSchedule = [{ Email: member.Email, Type: utils.ActionType.Expiry3, Date: utils.getDateString('2021-01-10'), },
      ]
      manager.addRenewedMemberToActionSchedule_(member, actionSchedule, emailSpecs);
      actionSchedule.forEach(e => e.Date = utils.getDateString(e.Date));
      expect(actionSchedule).toEqual(expected);

    });

    it('should add new action schedule entries for the renewed member', () => {
      const member = { Email: "test1@example.com", Period: 1, first: "John", last: "Doe", Joined: new Date('2021-01-01'), Expires: new Date('2022-01-10') };
      const expected = [
        { Email: member.Email, Type: utils.ActionType.Expiry1, Date: utils.addDaysToDate('2022-01-10', O1), },
        { Email: member.Email, Type: utils.ActionType.Expiry2, Date: utils.addDaysToDate('2022-01-10', O2), },
        { Email: member.Email, Type: utils.ActionType.Expiry3, Date: utils.addDaysToDate('2022-01-10', O3), },
        { Email: member.Email, Type: utils.ActionType.Expiry4, Date: utils.addDaysToDate('2022-01-10', O4), }
      ].map(e => { e.Date = utils.getDateString(e.Date); return e; });;
      actionSchedule = []
      manager.addRenewedMemberToActionSchedule_(member, actionSchedule, emailSpecs);
      actionSchedule.forEach(e => e.Date = utils.getDateString(e.Date));
      expect(actionSchedule).toEqual(expected);
    });

  });
})