const mgr = require('../src/scccManagement');
(Utils = require('../src/JavaScript/utils'));

const transactionsFixture = {
  unpaid: [
    { "Payable Status": "unpaid", "Email Address": "test1@example.com" },
    { "Payable Status": "pending", "Email Address": "test2@example.com" }
  ],
  paid: [
    { "Payable Status": "paid", "Email Address": "test1@example.com", "First Name": "John", "Last Name": "Doe", "Payment": "1 year" },
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


describe('trigger tests', () => {
  const today = Utils.getDateString();
  describe('processPaidTransactions_', () => {
    describe('member addition', () => {
      it('should create the new members', () => {
        const members = []
        const expectedMembers = [
          { Email: "test1@example.com", Period: 1, First: "John", Last: "Doe", Joined: today, Expires: Utils.calculateExpirationDate(1), "Renewed On": "" },
          { Email: "test2@example.com", Period: 2, First: "Jane", Last: "Smith", Joined: today, Expires: Utils.calculateExpirationDate(2), "Renewed On": "" },
          { Email: "test3@example.com", Period: 3, First: "Not", Last: "Member", Joined: today, Expires: Utils.calculateExpirationDate(3), "Renewed On": "" }]

        mgr.processPaidTransactions(transactionsFixture.paid, members);

        expect(members).toEqual(expectedMembers);
      });
      it('should handle membership renewals', () => {
        const members = [{ Email: "test1@example.com", Period: 1, First: "John", Last: "Doe", Joined: "2024-03-10", Expires: "2025-03-10", "Renewed On": "" },]
        const expectedMembers = [
          { Email: "test1@example.com", Period: 1, First: "John", Last: "Doe", Joined: Utils.getDateString(), Expires: Utils.addYearsToDate(new Date(), 1), "Renewed On": today },
        ]
        mgr.processPaidTransactions(transactionsFixture.paid, members);
        members.forEach(e => { e.Joined = getDateString(e.Joined); e.Expires = getDateString(e.Expires) });
        expectedMembers.forEach(e => { e.Joined = getDateString(e.Joined); e.Expires = getDateString(e.Expires) });
      });
      it.only('if renewal is before expiry then new expiry is  old expiry + period', () => {
        const members = [{ Email: "test1@example.com", Period: 1, First: "John", Last: "Doe", Joined: today, Expires: Utils.addDaysToDate(today, 10), "Renewed On": "" },]
        const expectedMembers = [
          { Email: "test1@example.com", Period: 1, First: "John", Last: "Doe", Joined: today, Expires: Utils.addDaysToDate(Utils.addYearsToDate(today,1), 10), "Renewed On": today },
        ]
        mgr.processPaidTransactions([transactionsFixture.paid[0]], members);
       expect(members).toEqual(expectedMembers);
      });
      it('if renewal is after expiry then new expiry is today + period', () => {
        const members = [{ Email: "test1@example.com", Period: 1, First: "John", Last: "Doe", Joined: today, Expires: Utils.addDaysToDate(today, -10), "Renewed On": "" },]
        const expectedMembers = [
          { Email: "test1@example.com", Period: 1, First: "John", Last: "Doe", Joined: getDateString(), Expires: Utils.addDaysToDate(new Date(), 365), "Renewed On": today },
        ]
        mgr.processPaidTransactions(transactionsFixture.paid, members);
        members.forEach(e => { e.Joined = getDateString(e.Joined); e.Expires = getDateString(e.Expires) });
        expectedMembers.forEach(e => { e.Joined = getDateString(e.Joined); e.Expires = getDateString(e.Expires) });
      });

      describe('period calculation', () => {
        it('should return correct period for transactions with different payment terms', () => {
          const members = [];
          const expectedMembers = [{ Email: "test1@example.com", Period: 3, first: "John", last: "Doe" },
          { Email: "test2@example.com", Period: 1, first: "Jane", last: "Smith", },
          { Email: "test3@example.com", Period: 3, first: "Not", last: "Member" }
          ];
          mgr.processPaidTransactions(transactionsFixture.differentTerms, members);
          expect(members.map(m => m.Period)).toEqual(expectedMembers.map(m => m.Period));

        });

        it('should return period as 1 if payment term is not specified', () => {
          const members = []
          mgr.processPaidTransactions(transactionsFixture.noTerm, members);
          expect(members.map(m => m.Period)).toEqual([1, 1, 1])
        });
      })
    })
    describe('actionSchedule', () => {
      it('should create an actionSchedule', () => {
        const txn = { "Payable Status": "paid", "Email Address": "test1@example.com", "First Name": "John", "Last Name": "Doe", "Payment": "1 year" }
        const actionSchedule = []
        const expected = [
          { Email: txn["Email Address"], Type: mgr.ActionType.Join, Date: today, },
          { Email: txn["Email Address"], Type: mgr.ActionType.Expiry1, Date: Utils.addDaysToDate(new Date(), 365 - 2) },
          { Email: txn["Email Address"], Type: mgr.ActionType.Expiry2, Date: Utils.addDaysToDate(new Date(), 365 - 1) },
          { Email: txn["Email Address"], Type: mgr.ActionType.Expiry3, Date: Utils.addDaysToDate(new Date(), 365), },
          { Email: txn["Email Address"], Type: mgr.ActionType.Expiry4, Date: Utils.addDaysToDate(new Date(), 365 + 1), }
        ].map(e => { e.Date = getDateString(e.Date); return e; });
        mgr.processPaidTransactions([txn], [], actionSchedule, actionSpecs);
        actionSchedule.forEach(a => a.Date = getDateString(a.Date));
        expect(actionSchedule).toEqual(expected);
      })
      it('should update an existing actionSchedule', () => {
        const members = [{ Email: "test1@example.com", Period: 1, first: "John", last: "Doe", Joined: '2021-01-01', Expires: Utils.addDaysToDate(new Date(), 365) }];
        const actionSchedule = [
          { Email: "test1@example.com", Type: mgr.ActionType.Join, Date: today, },
          { Email: "test1@example.com", Type: mgr.ActionType.Expiry1, Date: Utils.addDaysToDate(new Date(), 365 - 2) },
          { Email: "test1@example.com", Type: mgr.ActionType.Expiry2, Date: Utils.addDaysToDate(new Date(), 365 - 1) },
          { Email: "test1@example.com", Type: mgr.ActionType.Expiry3, Date: Utils.addDaysToDate(new Date(), 365), },
          { Email: "test1@example.com", Type: mgr.ActionType.Expiry4, Date: Utils.addDaysToDate(new Date(), 365 + 1), }
        ].map(e => { e.Date = getDateString(e.Date); return e; });
        const txns = [
          { "Payable Status": "paid", "Email Address": "test1@example.com", "First Name": "John", "Last Name": "Doe", "Payment": "1 year" },
          { "Payable Status": "paid", "Email Address": "test2@example.com", "First Name": "Jane", "Last Name": "Smith", "Payment": "3 years" }
        ]
        const expected = [
          { Email: "test1@example.com", Type: mgr.ActionType.Renew, Date: today, },
          { Email: "test1@example.com", Type: mgr.ActionType.Expiry1, Date: Utils.addDaysToDate(new Date(), (2 * 365) - 2) },
          { Email: "test1@example.com", Type: mgr.ActionType.Expiry2, Date: Utils.addDaysToDate(new Date(), (2 * 365) - 1) },
          { Email: "test1@example.com", Type: mgr.ActionType.Expiry3, Date: Utils.addDaysToDate(new Date(), (2 * 365)), },
          { Email: "test1@example.com", Type: mgr.ActionType.Expiry4, Date: Utils.addDaysToDate(new Date(), (2 * 365) + 1), },
          { Email: "test2@example.com", Type: mgr.ActionType.Join, Date: today, },
          { Email: "test2@example.com", Type: mgr.ActionType.Expiry1, Date: Utils.addDaysToDate(new Date(), (3 * 365) - 2) },
          { Email: "test2@example.com", Type: mgr.ActionType.Expiry2, Date: Utils.addDaysToDate(new Date(), (3 * 365) - 1) },
          { Email: "test2@example.com", Type: mgr.ActionType.Expiry3, Date: Utils.addDaysToDate(new Date(), (3 * 365)), },
          { Email: "test2@example.com", Type: mgr.ActionType.Expiry4, Date: Utils.addDaysToDate(new Date(), (3 * 365) + 1), },
        ].map(e => { e.Date = getDateString(e.Date); return e; });
        mgr.processPaidTransactions(txns, members, actionSchedule, actionSpecs);
        actionSchedule.forEach(a => a.Date = getDateString(a.Date));
        expect(actionSchedule).toEqual(expected);
      });
    });
  });
  describe('addRenewedMemberToActionSchedule', () => {
    let actionSchedule;
    let emailSpecs;
    let member;

    beforeEach(() => {
      actionSchedule = [
        { Date: new Date('2023-01-01'), Email: 'test@example.com', Type: mgr.ActionType.Expiry1 },
        { Date: new Date('2023-02-01'), Email: 'test@example.com', Type: mgr.ActionType.Expiry2 }
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
      const member = { Email: "test1@example.com", Period: 1, first: "John", last: "Doe", Joined: getDateString('2021-01-01'), Expires: getDateString('2022-01-10') };
      const expected = [{ Email: member.Email, Date: today, Type: mgr.ActionType.Renew },
      { Email: member.Email, Date: getDateString('2022-01-08'), Type: mgr.ActionType.Expiry1 },
      { Email: member.Email, Type: mgr.ActionType.Expiry2, Date: getDateString('2022-01-09'), },
      { Email: member.Email, Type: mgr.ActionType.Expiry3, Date: getDateString('2022-01-10'), },
      { Email: member.Email, Type: mgr.ActionType.Expiry4, Date: getDateString('2022-01-11'), }
      ].map(e => { e.Date = getDateString(e.Date); return e; });
      actionSchedule = [{ Email: member.Email, Type: mgr.ActionType.Expiry3, Date: getDateString('2021-01-10'), },
      ]
      mgr.addRenewedMemberToActionSchedule_(member, actionSchedule, emailSpecs);
      actionSchedule.forEach(e => e.Date = getDateString(e.Date));
      expect(actionSchedule).toEqual(expected);

    });

    it('should add new action schedule entries for the renewed member', () => {
      const member = { Email: "test1@example.com", Period: 1, first: "John", last: "Doe", Joined: new Date('2021-01-01'), Expires: new Date('2022-01-10') };
      const expected = [{ Email: member.Email, Date: today, Type: mgr.ActionType.Renew },
      { Email: member.Email, Date: new Date('2022-01-08'), Type: mgr.ActionType.Expiry1 },
      { Email: member.Email, Type: mgr.ActionType.Expiry2, Date: new Date('2022-01-09'), },
      { Email: member.Email, Type: mgr.ActionType.Expiry3, Date: new Date('2022-01-10'), },
      { Email: member.Email, Type: mgr.ActionType.Expiry4, Date: new Date('2022-01-11'), }
      ].map(e => { e.Date = getDateString(e.Date); return e; });;
      actionSchedule = []
      mgr.addRenewedMemberToActionSchedule_(member, actionSchedule, emailSpecs);
      actionSchedule.forEach(e => e.Date = getDateString(e.Date));
      expect(actionSchedule).toEqual(expected);
    });

  });
  function getDateString(date = new Date) {
    return new Date(date).toISOString().split('T')[0];
  }

  describe('test the getDateString function', () => {
    it('should return a date string in the format yyyy-mm-dd', () => {
      const date = new Date('2021-01-01');
      const result = getDateString(date);
      expect(result).toEqual('2021-01-01');
    });
    it('should work with date objects', () => {
      const date = new Date('2021-01-01');
      const result = getDateString(date);
      expect(result).toEqual('2021-01-01');
    });
  });

  describe('addDaysToDate_  ', () => {
    it('should add a number of days to a date', () => {
      const date = new Date('2021-01-01');
      const result = Utils.addDaysToDate(date, 2);
      expect(result).toEqual(new Date('2021-01-03'));
    });
    it('shoud work with negative numbers', () => {
      const date = new Date('2021-01-01');
      const result = Utils.addDaysToDate(date, -2);
      expect(result).toEqual(new Date('2020-12-30'));
    });
    it('should work with zero', () => {
      const date = new Date('2021-01-01');
      const result = Utils.addDaysToDate(date, 0);
      expect(result).toEqual(new Date('2021-01-01'));
    });
    it('should work with a string date', () => {
      const date = '2021-01-01';
      const result = Utils.addDaysToDate(date, 2);
      expect(result).toEqual(new Date('2021-01-03'));
    });
  })

  describe('createScheduleEntries', () => {

    it('should return a schedule entry for a new member', () => {
      const member = { Email: "test1@example.com", Period: 1, first: "John", last: "Doe", Joined: new Date('2021-01-01'), Expires: new Date('2022-01-10') };
      const result = mgr.createScheduleEntries_(member, mgr.ActionType.Join, actionSpecs)
      result.map(e => {e.Date = getDateString(e.Date); return e});
      const expected = [{ Email: member.Email, Date: today, Type: mgr.ActionType.Join },
      { Email: member.Email, Date: new Date('2022-01-08'), Type: mgr.ActionType.Expiry1 },
      { Email: member.Email, Type: mgr.ActionType.Expiry2, Date: new Date('2022-01-09'), },
      { Email: member.Email, Type: mgr.ActionType.Expiry3, Date: new Date('2022-01-10'), },
      { Email: member.Email, Type: mgr.ActionType.Expiry4, Date: new Date('2022-01-11'), }
      ].map(e => {e.Date = getDateString(e.Date); return e});
      expect(result).toEqual(expected);
    });

  })




  
});
