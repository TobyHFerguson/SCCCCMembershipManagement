const Manager = require('../src/JavaScript/Manager');
(utils = require('../src/JavaScript/utils'));
const transactionsFixture = {
  unpaid: [
    { "Payable Status": "unpaid", "Email Address": "test1@example.com" },
    { "Payable Status": "pending", "Email Address": "test2@example.com" },
  ],
  paidAndProcessed: [
    { "Payable Status": "paid", "Email Address": "test3@example.com", Processed: "2025-06-15" },
  ],
  paid: [
    { "Payable Status": "paid", "Email Address": "test1@example.com", "First Name": "John", "Last Name": "Doe", "Payment": "1 year", Phone: "(408) 386-9343", Directory: "" },
    { "Payable Status": "paid", "Email Address": "test2@example.com", "First Name": "Jane", "Last Name": "Smith", "Payment": "2 years", Directory: "Share Name, Share Phone" },
    { "Payable Status": "paid", "Email Address": "test3@example.com", "First Name": "Not", "Last Name": "Member", "Payment": "3 year", Directory: "Share Email" },

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
const actionSpecsArray = [
  { Type: 'Migrate', Subject: 'Migrate', Body: '{Email} {Last} {Directory}' },
  { Type: 'Join', Subject: 'Welcome to the club', Body: 'Welcome to the club, {First} {Last}!' },
  { Type: 'Renew', Subject: 'Renewal', Body: 'Thank you for renewing, {First} {Last}!' },
  { Type: 'Expiry1', Subject: 'First Expiry', Body: 'Your membership is expiring soon, {First} {Last}!', Offset: -10 },
  { Type: 'Expiry2', Subject: 'Second Expiry', Body: 'Your membership is expiring soon, {First} {Last}!', Offset: -5 },
  { Type: 'Expiry3', Subject: 'Third Expiry', Body: 'Your membership is expiring soon, {First} {Last}!', Offset: 0 },
  { Type: 'Expiry4', Subject: 'Final Expiry', Body: 'Your membership has expired, {First} {Last}!', Offset: 10 },
]

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
  let groupAddFun;
  let groupRemoveFun;
  let sendEmailFun;
  let groupEmails;
  let numProcessed;
  let consoleSpy;

  beforeEach(() => {
    groupRemoveFun = jest.fn();
    groupAddFun = jest.fn();
    sendEmailFun = jest.fn();
    groupEmails = [{ Email: "a@b.com" }, { Email: "member_discussions@sc3.club" }];
    manager = new Manager(actionSpecs, groupEmails, groupAddFun, groupRemoveFun, sendEmailFun, today);
    activeMembers = [];
    expiredMembers = [];
    expirySchedule = [];
    numProcessed = 0;
    consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => { });
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });
  describe('processExpirations', () => {
    beforeEach(() => {
      expirySchedule = [
        { Date: new Date('2050-01-01'), Type: utils.ActionType.Expiry1, Email: "test1@example.com" },
        { Date: today, Type: utils.ActionType.Expiry2, Email: "test2@example.com" },
        { Date: new Date('2045-01-01'), Type: utils.ActionType.Expiry3, Email: "test3@example.com" },
        { Date: today, Type: utils.ActionType.Expiry4, Email: "test4@example.com" }
      ];
    });

    it('should do nothing if there are no members to expire', () => {
      numProcessed = manager.processExpirations(activeMembers, expirySchedule);
      expect(numProcessed).toEqual(2);
    });
    it('should log what it is expecting to do', () => {
      manager.processExpirations(activeMembers, expirySchedule);
      expect(consoleSpy).toHaveBeenCalledWith("Expiry4 - test4@example.com");
      expect(consoleSpy).toHaveBeenCalledWith("Expiry2 - test2@example.com");
    })

    it('should log if a member to be expired isnt active', () => {
      expirySchedule = [
        { Date: today, Type: utils.ActionType.Expiry1, Email: "test1@example.com" },
      ]
      manager.processExpirations(activeMembers, expirySchedule);
      expect(consoleSpy).toHaveBeenCalledWith("Skipping member test1@example.com - they're not an active member");
    })
    it('should remove the expiry schedule even if the member cannot be expired', () => {
      const expectedExpirySchedule = expirySchedule.filter(e => e.Date > new Date(today)).map(e => { return { ...e } });
      manager.processExpirations(activeMembers, expirySchedule);
      expect(expirySchedule).toEqual(expectedExpirySchedule);
    })
    it('should return the number of schedules processed', () => {
      numProcessed = manager.processExpirations(activeMembers, expirySchedule);
      expect(numProcessed).toEqual(2);
    })
    it('should throw an aggregated error if there are errors', () => {
      const errorFunction = jest.fn(() => {
        throw new Error('This is a test error');
      });
      sendEmailFun = errorFunction;
      groupRemoveFun = errorFunction;
      activeMembers = [
        { Email: "test1@example.com", Period: 1, First: "John", Last: "Doe", Joined: "2020-03-10", Expires: "2021-01-10", "Renewed On": "" },
        { Email: "test2@example.com", Period: 1, First: "Jane", Last: "Smith", Joined: "2020-03-10", Expires: "2021-01-10", "Renewed On": "" },
      ];
      try {
        manager.processExpirations(activeMembers, expirySchedule);
      } catch (error) {
        expect(error).toBeInstanceOf(AggregateError);
        expect(error.errors.length).toEqual(2);
        expect(error.errors[0].txnNum).toEqual(1);
      }
    });
    describe('Expiration processing for multiple members', () => {
      it('should log what it is doing', () => {
        activeMembers = [
          { Email: "test2@example.com", Period: 1, First: "John", Last: "Doe", Joined: "2020-03-10", Expires: "2021-01-10", "Renewed On": "" },
          { Email: "test4@example.com", Period: 1, First: "Jane", Last: "Smith", Joined: "2020-03-10", Expires: "2021-01-10", "Renewed On": "" },
        ];
        manager.processExpirations(activeMembers, expirySchedule);
        expect(consoleSpy).toHaveBeenCalledWith(expect.anything())
        expect(consoleSpy).toHaveBeenCalledWith(`Expiry4 - test4@example.com removed from group ${groupEmails[0].Email}`)
        expect(consoleSpy).toHaveBeenCalledWith(`Expiry4 - test4@example.com - Email sent`)
        expect(consoleSpy).toHaveBeenCalledWith(`Expiry2 - test2@example.com`)
        expect(consoleSpy).toHaveBeenCalledWith(`Expiry2 - test2@example.com - Email sent`)
      })
    })
    describe('multiple expiry schedules on the same day for the same address', () => {
      beforeEach(() => {
        activeMembers = [{ Email: "test1@example.com", Period: 1, First: "John", Last: "Doe", Joined: "2020-03-10", Expires: "2021-01-10", "Renewed On": "", Status: 'Active' }];
        expirySchedule = [
          { Date: today, Type: utils.ActionType.Expiry2, Email: "test1@example.com" },
          { Date: today, Type: utils.ActionType.Expiry4, Email: "test1@example.com" }
        ];
      })
      it('should count both schedules as having been processed', () => {
        numProcessed = manager.processExpirations(activeMembers, expirySchedule);
        expect(numProcessed).toEqual(2);
      })
      it('should log the anomaly', () => {
        manager.processExpirations(activeMembers, expirySchedule);
        expect(consoleSpy).toHaveBeenCalledWith("Skipping test1@example.com for Expiry2 - already processed");
      })
      it('should process only the latest expiry', () => {
        expectedActiveMembers = [{ ...activeMembers[0], Status: 'Expired' }];
        manager.processExpirations(activeMembers, expirySchedule);
        expect(activeMembers).toEqual(expectedActiveMembers);
        expect(groupRemoveFun).toHaveBeenCalledTimes(2);
        expect(groupRemoveFun).toHaveBeenCalledWith(expectedActiveMembers[0].Email, groupEmails[0].Email);
        expect(groupRemoveFun).toHaveBeenCalledWith(expectedActiveMembers[0].Email, groupEmails[1].Email);
        expect(sendEmailFun).toHaveBeenCalledTimes(1);
        expect(sendEmailFun).toHaveBeenCalledWith({ to: expectedActiveMembers[0].Email, subject: actionSpecs.Expiry4.Subject, htmlBody: actionSpecs.Expiry4.Body.replace('{First}', expectedActiveMembers[0].First).replace('{Last}', expectedActiveMembers[0].Last) });
      })
      it('should remove all schedules for the expiring member', () => {
        expirySchedule.push({ Date: utils.addDaysToDate(today, +3), Type: utils.ActionType.Expiry2, Email: "test1@example.com" })
        manager.processExpirations(activeMembers, expirySchedule);
        expect(expirySchedule).toEqual([]);
      })
    });
    describe('Expiry4 processing', () => {
      let expectedActiveMembers;
      beforeEach(() => {
        expirySchedule = [{ Date: today, Type: utils.ActionType.Expiry4, Email: "test1@example.com" }];
        activeMembers = [{ Email: "test1@example.com", Period: 1, First: "John", Last: "Doe", Joined: "2020-03-10", Expires: "2021-01-10", "Renewed On": "", Status: 'Active' }];
        expectedActiveMembers = [{ ...activeMembers[0], Status: 'Expired' }];
      });
      it('should set members status to Expired once Expiry4 has been met', () => {
        manager.processExpirations(activeMembers, expirySchedule);
        expect(activeMembers).toEqual(expectedActiveMembers);
      })
      it('should remove the member from all groups once Expiry4 has been met', () => {
        manager.processExpirations(activeMembers, expirySchedule);
        expect(groupRemoveFun).toHaveBeenCalledTimes(2);
        expect(groupRemoveFun).toHaveBeenCalledWith(expectedActiveMembers[0].Email, groupEmails[0].Email);
        expect(groupRemoveFun).toHaveBeenCalledWith(expectedActiveMembers[0].Email, groupEmails[1].Email);
      })
      it('should send an email to the member once Expiry4 has been met', () => {
        manager.processExpirations(activeMembers, expirySchedule);
        expect(sendEmailFun).toHaveBeenCalledTimes(1);
        expect(sendEmailFun).toHaveBeenCalledWith({ to: expectedActiveMembers[0].Email, subject: actionSpecs.Expiry4.Subject, htmlBody: actionSpecs.Expiry4.Body.replace('{First}', expectedActiveMembers[0].First).replace('{Last}', expectedActiveMembers[0].Last) });
      })
    });
  });

  describe('processMigrations', () => {
    describe('Active Members only', () => {
      let migrators;
      beforeEach(() => {
        migrators = [
          { Email: "a@b.com", Period: 1, First: "John", Last: "Doe", Phone: '(408) 386-9343', Joined: "2020-03-10", Expires: "2021-01-10", Directory: true, "Migrate Me": true, Status: "Active", 
            "board_announcements@sc3.club": false, "member_discussions@sc3.club": true },
        { Email: "a@b.com", Period: 1, First: "Not", Last: "Me", Phone: '(408) 386-9343', Joined: "2020-03-10", Expires: "2021-01-10", Directory: true, Status: "Active" }
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
        groupAddFun = jest.fn(() => { throw new Error('This is a test error') });
        manager = new Manager(actionSpecs, groupEmails, groupAddFun, groupRemoveFun, sendEmailFun, today);
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
        migratorsPost = [{ ...m }]
        manager.migrateCEMembers(migratorsPre, activeMembers, expirySchedule);
        expect(migratorsPost).toEqual(migratorsPre)
        expect(activeMembers).toEqual([]);
        expect(expirySchedule).toEqual([]);
        expect(consoleSpy).toHaveBeenCalledWith(`Skipping row 2, no email address`);
      });
      it('should migrate expired members, and log the fact', () => {
        members = [{Email: "a@b.com", Period: 1, First: "John", Last: "Doe", Phone: '(408) 386-9343', Joined: "1900-03-10", Expires: "1901-01-10", Directory: 'Yes', Status: "Expired"}];
        migrators = [
          { Email: "a@b.com", Period: 1, First: "John", Last: "Doe", Phone: '(408) 386-9343', Joined: "2020-03-10", Expires: "2021-01-10", Directory: true, "Migrate Me": true, Status: "Active", 
            "board_announcements@sc3.club": false, "member_discussions@sc3.club": true },
        ];
        expectedMigrators = [{ ...migrators[0], Migrated: today }];
        expectedMembers = [members[0],
          {Email: "a@b.com", Period: 1, First: "John", Last: "Doe", Phone: '(408) 386-9343', Joined: "2020-03-10", Expires: "2021-01-10", Directory: 'Yes', Migrated: today, Status: "Active"}
        ];
        manager.migrateCEMembers(migrators, members, expirySchedule);
        expect(migrators).toEqual(expectedMigrators);
        expect(members).toEqual(expectedMembers);
        expect(groupAddFun).toHaveBeenCalledTimes(1);
      });
      it('should not migrate members that are already recorded as being active, and log the fact', () => {
        members = [{Email: "a@b.com", Period: 1, First: "John", Last: "Doe", Phone: '(408) 386-9343', Joined: "1900-03-10", Expires: "1901-01-10", Directory: 'Yes', Status: "Active"}];
        migrators = [
          { Email: "a@b.com", Period: 1, First: "John", Last: "Doe", Phone: '(408) 386-9343', Joined: "2020-03-10", Expires: "2021-01-10", Directory: true, "Migrate Me": true, Status: "Active", 
            "board_announcements@sc3.club": false, "member_discussions@sc3.club": true },
        ];
        expectedMigrators = [{ ...migrators[0]}];
        expectedMembers = [{...members[0]}];
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
        expect(groupAddFun).toHaveBeenCalledTimes(1);
        expect(groupAddFun).toHaveBeenCalledWith(migrators[0].Email, "member_discussions@sc3.club");
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
        groupAddFun = jest.fn(() => { throw new Error('This is a test error') });
        manager = new Manager(actionSpecs, groupEmails, groupAddFun, groupRemoveFun, sendEmailFun, today);
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
        migrators = [{ Email: "a@b.com", Period: 1, First: "John", Last: "Doe", Phone: '(408) 386-9343', Joined: "2020-03-10", Expires: "2021-01-10", Directory: true, "Migrate Me": true, Status: "Expired" },
        { Email: "a@b.com", Period: 1, First: "Not", Last: "Me", Phone: '(408) 386-9343', Joined: "2020-03-10", Expires: "2021-01-10", Directory: true, Status: "Expired" }
        ];
      });
      it('should migrate only marked members, record the date of migration and removing any unused keys', () => {
        const expectedMigrators = [{ ...migrators[0], Migrated: today }, { ...migrators[1] }];
        const m = { ...migrators[0], Migrated: today, Directory: 'Yes' };
        delete m["Migrate Me"];
        const expectedMembers = [m];
        manager.migrateCEMembers(migrators, activeMembers, expirySchedule);
        expect(activeMembers).toEqual(expectedMembers);
        expect(migrators).toEqual(expectedMigrators);
      });
      it('should not create an expirySchedule entry for expired members', () => {
        manager.migrateCEMembers(migrators, activeMembers, expirySchedule);
        expect(expirySchedule).toEqual([]);
      })
      it('should not add expired members to any groups', () => {  
        manager.migrateCEMembers(migrators, activeMembers, expirySchedule);
        expect(groupAddFun).toHaveBeenCalledTimes(0);
      })
      it('should not send any emails to inactive members', () => {
        manager.migrateCEMembers(migrators, activeMembers, expirySchedule);
        expect(sendEmailFun).toHaveBeenCalledTimes(0);
      })
      it('should provide logging information', () => {
        manager.migrateCEMembers(migrators, activeMembers, expirySchedule);
        expect(consoleSpy).toHaveBeenCalledWith('Migrating Inactive member a@b.com, row 2 - no groups will be joined or emails sent'); 
        expect(consoleSpy).toHaveBeenCalledWith(expect.anything());
      })
    });
  });

  describe('processPaidTransactions', () => {
    describe('basic tests', () => {
      it('should create the new members', () => {
        const txns = transactionsFixture.paid.map(t => { return { ...t } }) // clone the array
        const expectedMembers = [
          { Email: "test1@example.com", Period: 1, First: "John", Last: "Doe", Phone: "(408) 386-9343", Joined: today, Expires: utils.addYearsToDate(today, 1), "Renewed On": "", Status: "Active", "Directory Share Name": false, "Directory Share Email": false, "Directory Share Phone": false },
          { Email: "test2@example.com", Period: 2, First: "Jane", Last: "Smith", Phone: '', Joined: today, Expires: utils.addYearsToDate(today, 2), "Renewed On": "", Status: "Active","Directory Share Name": true, "Directory Share Email": false, "Directory Share Phone": true },
          { Email: "test3@example.com", Period: 3, First: "Not", Last: "Member", Phone: '', Joined: today, Expires: utils.addYearsToDate(today, 3), "Renewed On": "", Status: "Active", "Directory Share Name": false, "Directory Share Email": true, "Directory Share Phone": false }]

        manager.processPaidTransactions(txns, activeMembers, expirySchedule,);
        expect(activeMembers.length).toEqual(3)
        expect(activeMembers).toEqual(expectedMembers);
      });
      it('should return whether changes were made to the transactions and expiration schedule, as well as whether unpaid transactions remain', () => {
        const txns = [];
        const { recordsChanged, hasPendingPayments, errors } = manager.processPaidTransactions(txns, activeMembers, expirySchedule,);
        expect(recordsChanged).toBe(false);
        expect(hasPendingPayments).toBe(false);
        expect(errors).toEqual([]);
      });
      it('should return true if records and expiry schedule were changed', () => {
        const txns = transactionsFixture.paid.map(t => { return { ...t } }) // clone the array
        const { recordsChanged, hasPendingPayments } = manager.processPaidTransactions(txns, activeMembers, expirySchedule,);
        expect(recordsChanged).toBe(true);
        expect(hasPendingPayments).toBe(false);
      });
      it('should return true if there are unpaid transactions', () => {
        const txns = transactionsFixture.unpaid.map(t => { return { ...t } }) // clone the array
        const { recordsChanged, hasPendingPayments } = manager.processPaidTransactions(txns, activeMembers, expirySchedule,);
        expect(recordsChanged).toBe(false);
        expect(hasPendingPayments).toBe(true);
      });
      it('should return false when transactions are paid and processed', () => {
        const txns = transactionsFixture.paidAndProcessed.map(t => { return { ...t } }) // clone the array
        const { recordsChanged, hasPendingPayments } = manager.processPaidTransactions(txns, activeMembers, expirySchedule,);
        expect(recordsChanged).toBe(false);
        expect(hasPendingPayments).toBe(false);
      })
      it('should handle membership renewals for active members', () => {
        const txns = [{ "Payable Status": "paid", "Email Address": "test1@example.com", "First Name": "John", "Last Name": "Doe", "Payment": "1 year",  "Directory": "Share Email"  },
        ]
        const members = [{ Email: "test1@example.com", Period: 1, First: "John", Last: "Doe", Joined: "2024-03-10", Expires: "2025-03-10", "Renewed On": "", Status: "Active" , "Directory Share Name": false, "Directory Share Email": false, "Directory Share Phone": false },]
        const expectedMembers = [
          { Email: "test1@example.com", Period: 1, First: "John", Last: "Doe", Joined: "2024-03-10", Expires: utils.addYearsToDate("2025-03-10", 1), "Renewed On": today, Status: "Active", "Directory Share Email": true, "Directory Share Name": false, "Directory Share Phone": false },
        ]
        manager.processPaidTransactions(txns, members, expirySchedule,);
        expect(members.length).toEqual(1)
        expect(members).toEqual(expectedMembers);
      });
      it('should treat a renewal for a member with an expired membership as a new member', () => {
        const txns = [{ "Payable Status": "paid", "Email Address": "test1@example.com", "First Name": "John", "Last Name": "Doe", "Payment": "1 year", "Directory": "Share Email" },
        ]
        const members = [{ Email: "test1@example.com", Period: 1, First: "John", Last: "Doe", Joined: "2024-03-10", Expires: "2025-03-10", "Renewed On": "", Status: "Expired", Phone: '', "Directory Share Name": false, "Directory Share Email": false, "Directory Share Phone": false },]
        const expectedMembers = [
          { Email: "test1@example.com", Period: 1, First: "John", Last: "Doe", Joined: "2024-03-10", Expires: "2025-03-10", "Renewed On": "", Status: "Expired", Phone: '', "Directory Share Name": false, "Directory Share Email": false, "Directory Share Phone": false },
          { Email: "test1@example.com", Period: 1, First: "John", Last: "Doe", Joined: today, Expires: utils.addYearsToDate(today, 1), "Renewed On": "", Status: "Active", Phone: '', "Directory Share Name": false, "Directory Share Email": true, "Directory Share Phone": false },
        ]
        manager.processPaidTransactions(txns, members, expirySchedule,);
        expect(members).toEqual(expectedMembers);
      })
    });

    describe('group addition tests', () => {
      it('should add a member to a group when the member is added', () => {
        const txns = [{ "Payable Status": "paid", "Email Address": "test1@example.com", "First Name": "John", "Last Name": "Doe", "Payment": "1 year" }]
        manager.processPaidTransactions(txns, activeMembers, expirySchedule,);
        expect(groupAddFun).toHaveBeenCalledTimes(2);
        expect(groupAddFun).toHaveBeenCalledWith("test1@example.com", "a@b.com");
        expect(groupAddFun).toHaveBeenCalledWith("test1@example.com", "member_discussions@sc3.club"); 
      })

      it('should not add a member to a group when the member is renewed', () => {
        const txns = [{ "Payable Status": "paid", "Email Address": "test1@example.com", "First Name": "John", "Last Name": "Doe", "Payment": "1 year" }]
        activeMembers = [{ Email: "test1@example.com", Period: 1, First: "John", Last: "Doe", Joined: "2024-03-10", Expires: "2025-03-10", "Renewed On": "", Status: 'Active' },]
        manager.processPaidTransactions(txns, activeMembers, expirySchedule,);
        expect(groupAddFun).toHaveBeenCalledTimes(0);
      });
    });

    describe('sending emails', () => {
      it('should send an email when a member is added', () => {
        const txns = [{ "Payable Status": "paid", "Email Address": "test1@example.com", "First Name": "John", "Last Name": "Doe", "Payment": "1 year" }]
        manager.processPaidTransactions(txns, activeMembers, expirySchedule,);
        expect(sendEmailFun).toHaveBeenCalledTimes(1);
        expect(sendEmailFun).toHaveBeenCalledWith({
          to: activeMembers[0].Email,
          subject: utils.expandTemplate(actionSpecs.Join.Subject, activeMembers[0]),
          htmlBody: utils.expandTemplate(actionSpecs.Join.Body, activeMembers[0])
        });
      });

      it('should send an email when the member is renewed', () => {
        const txns = [{ "Payable Status": "paid", "Email Address": "test1@example.com", "First Name": "John", "Last Name": "Doe", "Payment": "1 year" }]
        activeMembers = [{ Email: "test1@example.com", Period: 1, First: "John", Last: "Doe", Joined: "2024-03-10", Expires: "2025-03-10", "Renewed On": "", Status: 'Active' },]
        manager.processPaidTransactions(txns, activeMembers, expirySchedule,);
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
        activeMembers = [{ Email: "test1@example.com", Period: 1, First: "John", Last: "Doe", Joined: joinDate, Expires: utils.addDaysToDate(today, 10), "Renewed On": "", Status: "Active" },]
        const expectedMembers = [
          { Email: "test1@example.com", 
            Period: 1, First: "John", 
            Last: "Doe", 
            Joined: joinDate, 
            Expires: utils.addYearsToDate(activeMembers[0].Expires, 1), 
            "Renewed On": manager.today(), 
            Status: "Active" ,
            "Directory Share Name": false,
            "Directory Share Email": false,
            "Directory Share Phone": false},
        ]
        manager.processPaidTransactions(txns, activeMembers, expirySchedule);
        expect(activeMembers).toEqual(expectedMembers);
      });

      it('if renewal is after expiry then new expiry is today + period', () => {
        activeMembers = [{ Email: "test1@example.com", Period: 1, First: "John", Last: "Doe", Joined: joinDate, Expires: utils.addDaysToDate(joinDate, -10), "Renewed On": "", Status: "Active" },]
        const expectedMembers = [
          { Email: "test1@example.com", 
            Period: 1, 
            First: "John", 
            Last: "Doe", 
            Joined: joinDate, 
            Expires: utils.addYearsToDate(manager.today(), 1), 
            "Renewed On": manager.today(), 
            Status: "Active",
            "Directory Share Name": false,
            "Directory Share Email": false,
            "Directory Share Phone": false},
        ]
        manager.processPaidTransactions(txns, activeMembers, expirySchedule);
        expect(activeMembers).toEqual(expectedMembers);
      });
    })

    describe('period calculation', () => {
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
          manager = new Manager(actionSpecs, groupEmails, groupAddFun, groupRemoveFun, sendEmailFun, today);
          const { _, __, errors } = manager.processPaidTransactions(transactions, activeMembers, expirySchedule,);
          expect(errors.length).toEqual(3);
          expect(errors[0].message).toEqual('This is a test error');
        })
      });
    })
  });



  describe('expirySchedule', () => {
    it('should create an expirySchedule', () => {
      const txn = { "Payable Status": "paid", "Email Address": "test1@example.com", "First Name": "John", "Last Name": "Doe", "Payment": "1 year" }
      const expirySchedule = []
      const expected = [
        { Email: txn["Email Address"], Type: utils.ActionType.Expiry1, Date: utils.addDaysToDate(today, 365 + O1) },
        { Email: txn["Email Address"], Type: utils.ActionType.Expiry2, Date: utils.addDaysToDate(today, 365 + O2) },
        { Email: txn["Email Address"], Type: utils.ActionType.Expiry3, Date: utils.addDaysToDate(today, 365 + O3), },
        { Email: txn["Email Address"], Type: utils.ActionType.Expiry4, Date: utils.addDaysToDate(today, 365 + O4), }
      ];
      manager.processPaidTransactions([txn], activeMembers, expirySchedule)
      expect(expirySchedule).toEqual(expected);
    })

    it('should update an existing expirySchedule', () => {
      const exp = utils.addDaysToDate(today, 60)
      const activeMembers = [{ Email: "test1@example.com", Period: 1, first: "John", last: "Doe", Joined: utils.dateOnly('2021-01-01'), Expires: exp, Status: 'Active' }];
      const expirySchedule = [
        { Email: "test1@example.com", Type: utils.ActionType.Join, Date: today, },
        { Email: "test1@example.com", Type: utils.ActionType.Expiry1, Date: utils.addDaysToDate(today, 365 + O1) },
        { Email: "test1@example.com", Type: utils.ActionType.Expiry2, Date: utils.addDaysToDate(today, 365 + O2) },
        { Email: "test1@example.com", Type: utils.ActionType.Expiry3, Date: utils.addDaysToDate(today, 365 + O3), },
        { Email: "test1@example.com", Type: utils.ActionType.Expiry4, Date: utils.addDaysToDate(today, 365 + O4), }
      ]
      const txns = [
        { "Payable Status": "paid", "Email Address": "test1@example.com", "First Name": "John", "Last Name": "Doe", "Payment": "1 year" },
        { "Payable Status": "paid", "Email Address": "test2@example.com", "First Name": "Jane", "Last Name": "Smith", "Payment": "3 years" }
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
        { Date: new Date('2023-01-01'), Email: 'test@example.com', Type: utils.ActionType.Expiry1 },
        { Date: new Date('2023-02-01'), Email: 'test@example.com', Type: utils.ActionType.Expiry2 }
      ];
      emailSpecs = actionSpecsArray
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
      const member = { Email: "test1@example.com", Period: 1, first: "John", last: "Doe", Joined: utils.dateOnly('2021-01-01'), Expires: utils.addYearsToDate(today, 1), "Renewed On": today };
      const expected = [
        { Email: member.Email, Type: utils.ActionType.Expiry1, Date: utils.addDaysToDate(member.Expires, O1), },
        { Email: member.Email, Type: utils.ActionType.Expiry2, Date: utils.addDaysToDate(member.Expires, O2), },
        { Email: member.Email, Type: utils.ActionType.Expiry3, Date: utils.addDaysToDate(member.Expires, O3), },
        { Email: member.Email, Type: utils.ActionType.Expiry4, Date: utils.addDaysToDate(member.Expires, O4), }
      ]
      expirySchedule = [{ Email: member.Email, Type: utils.ActionType.Expiry3, Date: utils.dateOnly('2021-01-10'), },
      ]
      manager.addRenewedMemberToActionSchedule_(member, expirySchedule, emailSpecs);
      expect(expirySchedule).toEqual(expected);

    });

    it('should add new action schedule entries for the renewed member', () => {
      const member = { Email: "test1@example.com", Period: 1, first: "John", last: "Doe", Joined: utils.dateOnly('2021-01-01'), Expires: utils.addYearsToDate(today, 1), "Renewed On": today };
      const expected = [
        { Email: member.Email, Type: utils.ActionType.Expiry1, Date: utils.addDaysToDate(member.Expires, O1), },
        { Email: member.Email, Type: utils.ActionType.Expiry2, Date: utils.addDaysToDate(member.Expires, O2), },
        { Email: member.Email, Type: utils.ActionType.Expiry3, Date: utils.addDaysToDate(member.Expires, O3), },
        { Email: member.Email, Type: utils.ActionType.Expiry4, Date: utils.addDaysToDate(member.Expires, O4), }
      ]
      expirySchedule = []
      manager.addRenewedMemberToActionSchedule_(member, expirySchedule, emailSpecs);
      expect(expirySchedule).toEqual(expected);
    });

  });
})