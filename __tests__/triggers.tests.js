const triggers = require('../src/JavaScript/triggers');

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

const membersFixture = [
  { Email: "test1@example.com" },
  { Email: "test2@example.com" }
];

const expectedNewMembers = [
  { Email: "test1@example.com", Period: 1, First: "John", Last: "Doe" },
  { Email: "test2@example.com", Period: 2, First: "Jane", Last: "Smith" },
  { Email: "test3@example.com", Period: 3, First: "Not", Last: "Member" }
];

const actionSpecs = [
  { Type: triggers.ActionType.Join, Subject: "Join Subject", Body: "Join Body" },
  { Type: triggers.ActionType.Renew, Subject: "Renew Subject", Body: "Renew Body" },
  { Type: triggers.ActionType.Expiry1, Subject: "Expiry1 Subject", Body: "Expiry1 Body", Offset: -2 },
  { Type: triggers.ActionType.Expiry2, Subject: "Expiry2 Subject", Body: "Expiry2 Body", Offset: -1 },
  { Type: triggers.ActionType.Expiry3, Subject: "Expiry3 Subject", Body: "Expiry3 Body", Offset: 0 },
  { Type: triggers.ActionType.Expiry4, Subject: "Expiry4 Subject", Body: "Expiry4 Body", Offset: 1 }
]
describe('trigger tests', () => {
  describe('processPaidTransactions_', () => {
    describe('group members functionality', () => {
      it('should return an empty array when no transactions are paid', () => {
        const result = triggers.processPaidTransactions(transactionsFixture.unpaid, membersFixture);
        expect(result).toEqual([]);
      });

      it('should return member additions for paid transactions', () => {
        const result = triggers.processPaidTransactions(transactionsFixture.paid, [], [], actionSpecs);
        expect(result).toEqual(expectedNewMembers.map(m => {return {Email: m.Email}}));
      });

      it('should handle case-insensitive payable status', () => {
        const result = triggers.processPaidTransactions(transactionsFixture.caseInsensitive, [], [], actionSpecs);
        expect(result).toEqual(expectedNewMembers.map(m => {return {Email: m.Email}}));
      });
    })
    describe('member addition', () => {
      it.skip('should create the new members', () => {
        const members = []
        const expectedMembers = [
          { Email: "test1@example.com", Period: 1, First: "John", Last: "Doe", Joined: "2025-02-10", Expires: "2026-02-10", "Renewed On": "" },
          { Email: "test2@example.com", Period: 2, First: "Jane", Last: "Smith", Joined: "2025-02-10", Expires: "2027-02-10", "Renewed On": "" },
          { Email: "test3@example.com", Period: 3, First: "Not", Last: "Member", Joined: "2025-02-10", Expires: "2028-02-10", "Renewed On": "" }]

        triggers.processPaidTransactions(transactionsFixture.paid, members, [], actionSpecs);
        members.forEach(e => { e.Joined = getDateString(e.Joined); e.Expires = getDateString(e.Expires) });
        expectedMembers.forEach(e => { e.Joined = getDateString(e.Joined); e.Expires = getDateString(e.Expires) });

        expect(members).toEqual(expectedMembers);
      });
      it('should handle membership renewals', () => {
        const members = [{ Email: "test1@example.com", Period: 1, First: "John", Last: "Doe", Joined: "2024-03-10", Expires: "2025-03-10", "Renewed On": "" },]
        const expectedMembers = [
          { Email: "test1@example.com", Period: 1, First: "John", Last: "Doe", Joined: getDateString(), Expires: triggers.addDaysToDate_(new Date(), 365), "Renewed On": triggers.today_() },
        ]
        triggers.processPaidTransactions(transactionsFixture.paid, members, [], actionSpecs);
        members.forEach(e => { e.Joined = getDateString(e.Joined); e.Expires = getDateString(e.Expires) });
        expectedMembers.forEach(e => { e.Joined = getDateString(e.Joined); e.Expires = getDateString(e.Expires) });
      });
      it('if renewal is before expiry then new expiry is  old expiry + period', () => {
        const members = [{ Email: "test1@example.com", Period: 1, First: "John", Last: "Doe", Joined: triggers.today_(), Expires: triggers.addDaysToDate_(triggers.today_(), 10), "Renewed On": "" },]
        const expectedMembers = [
          { Email: "test1@example.com", Period: 1, First: "John", Last: "Doe", Joined: getDateString(), Expires: triggers.addDaysToDate_(new Date(), 365 + 10), "Renewed On": triggers.today_() },
        ]
        triggers.processPaidTransactions(transactionsFixture.paid, members, [], actionSpecs);
        members.forEach(e => { e.Joined = getDateString(e.Joined); e.Expires = getDateString(e.Expires) });
        expectedMembers.forEach(e => { e.Joined = getDateString(e.Joined); e.Expires = getDateString(e.Expires) });
      });
      it('if renewal is after expiry then new expiry is today + period', () => {
        const members = [{ Email: "test1@example.com", Period: 1, First: "John", Last: "Doe", Joined: triggers.today_(), Expires: triggers.addDaysToDate_(triggers.today_(), -10), "Renewed On": "" },]
        const expectedMembers = [
          { Email: "test1@example.com", Period: 1, First: "John", Last: "Doe", Joined: getDateString(), Expires: triggers.addDaysToDate_(new Date(), 365), "Renewed On": triggers.today_() },
        ]
        triggers.processPaidTransactions(transactionsFixture.paid, members, [], actionSpecs);
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
          triggers.processPaidTransactions(transactionsFixture.differentTerms, members, [], actionSpecs);
          expect(members.map(m => m.Period)).toEqual(expectedMembers.map(m => m.Period));

        });

        it('should return period as 1 if payment term is not specified', () => {
          const members = []
          triggers.processPaidTransactions(transactionsFixture.noTerm, members, [], actionSpecs);
          expect(members.map(m => m.Period)).toEqual([1, 1, 1])
        });
      })
    })
    describe('actionSchedule', () => {
      it('should create an actionSchedule', () => {
        const txn = { "Payable Status": "paid", "Email Address": "test1@example.com", "First Name": "John", "Last Name": "Doe", "Payment": "1 year" }
        const actionSchedule = []
        const expected = [
          { Email: txn["Email Address"], Type: triggers.ActionType.Join, Date: triggers.today_(), },
          { Email: txn["Email Address"], Type: triggers.ActionType.Expiry1, Date: triggers.addDaysToDate_(new Date(), 365 - 2) },
          { Email: txn["Email Address"], Type: triggers.ActionType.Expiry2, Date: triggers.addDaysToDate_(new Date(), 365 - 1) },
          { Email: txn["Email Address"], Type: triggers.ActionType.Expiry3, Date: triggers.addDaysToDate_(new Date(), 365), },
          { Email: txn["Email Address"], Type: triggers.ActionType.Expiry4, Date: triggers.addDaysToDate_(new Date(), 365 + 1), }
        ].map(e => { e.Date = getDateString(e.Date); return e; });
        triggers.processPaidTransactions([txn], [], actionSchedule, actionSpecs);
        actionSchedule.forEach(a => a.Date = getDateString(a.Date));
        expect(actionSchedule).toEqual(expected);
      })
      it('should update an existing actionSchedule', () => {
        const members = [{ Email: "test1@example.com", Period: 1, first: "John", last: "Doe", Joined: '2021-01-01', Expires: triggers.addDaysToDate_(new Date(), 365) }];
        const actionSchedule = [
          { Email: "test1@example.com", Type: triggers.ActionType.Join, Date: triggers.today_(), },
          { Email: "test1@example.com", Type: triggers.ActionType.Expiry1, Date: triggers.addDaysToDate_(new Date(), 365 - 2) },
          { Email: "test1@example.com", Type: triggers.ActionType.Expiry2, Date: triggers.addDaysToDate_(new Date(), 365 - 1) },
          { Email: "test1@example.com", Type: triggers.ActionType.Expiry3, Date: triggers.addDaysToDate_(new Date(), 365), },
          { Email: "test1@example.com", Type: triggers.ActionType.Expiry4, Date: triggers.addDaysToDate_(new Date(), 365 + 1), }
        ].map(e => { e.Date = getDateString(e.Date); return e; });
        const txns = [
          { "Payable Status": "paid", "Email Address": "test1@example.com", "First Name": "John", "Last Name": "Doe", "Payment": "1 year" },
          { "Payable Status": "paid", "Email Address": "test2@example.com", "First Name": "Jane", "Last Name": "Smith", "Payment": "3 years" }
        ]
        const expected = [
          { Email: "test1@example.com", Type: triggers.ActionType.Renew, Date: triggers.today_(), },
          { Email: "test1@example.com", Type: triggers.ActionType.Expiry1, Date: triggers.addDaysToDate_(new Date(), (2 * 365) - 2) },
          { Email: "test1@example.com", Type: triggers.ActionType.Expiry2, Date: triggers.addDaysToDate_(new Date(), (2 * 365) - 1) },
          { Email: "test1@example.com", Type: triggers.ActionType.Expiry3, Date: triggers.addDaysToDate_(new Date(), (2 * 365)), },
          { Email: "test1@example.com", Type: triggers.ActionType.Expiry4, Date: triggers.addDaysToDate_(new Date(), (2 * 365) + 1), },
          { Email: "test2@example.com", Type: triggers.ActionType.Join, Date: triggers.today_(), },
          { Email: "test2@example.com", Type: triggers.ActionType.Expiry1, Date: triggers.addDaysToDate_(new Date(), (3 * 365) - 2) },
          { Email: "test2@example.com", Type: triggers.ActionType.Expiry2, Date: triggers.addDaysToDate_(new Date(), (3 * 365) - 1) },
          { Email: "test2@example.com", Type: triggers.ActionType.Expiry3, Date: triggers.addDaysToDate_(new Date(), (3 * 365)), },
          { Email: "test2@example.com", Type: triggers.ActionType.Expiry4, Date: triggers.addDaysToDate_(new Date(), (3 * 365) + 1), },
        ].map(e => { e.Date = getDateString(e.Date); return e; });
        triggers.processPaidTransactions(txns, members, actionSchedule, actionSpecs);
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
        { Date: new Date('2023-01-01'), Email: 'test@example.com', Type: triggers.ActionType.Expiry1 },
        { Date: new Date('2023-02-01'), Email: 'test@example.com', Type: triggers.ActionType.Expiry2 }
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
      const expected = [{ Email: member.Email, Date: triggers.today_(), Type: triggers.ActionType.Renew },
      { Email: member.Email, Date: getDateString('2022-01-08'), Type: triggers.ActionType.Expiry1 },
      { Email: member.Email, Type: triggers.ActionType.Expiry2, Date: getDateString('2022-01-09'), },
      { Email: member.Email, Type: triggers.ActionType.Expiry3, Date: getDateString('2022-01-10'), },
      { Email: member.Email, Type: triggers.ActionType.Expiry4, Date: getDateString('2022-01-11'), }
      ].map(e => { e.Date = getDateString(e.Date); return e; });
      actionSchedule = [{ Email: member.Email, Type: triggers.ActionType.Expiry3, Date: getDateString('2021-01-10'), },
      ]
      triggers.addRenewedMemberToActionSchedule_(member, actionSchedule, emailSpecs);
      actionSchedule.forEach(e => e.Date = getDateString(e.Date));
      expect(actionSchedule).toEqual(expected);

    });

    it('should add new action schedule entries for the renewed member', () => {
      const member = { Email: "test1@example.com", Period: 1, first: "John", last: "Doe", Joined: new Date('2021-01-01'), Expires: new Date('2022-01-10') };
      const expected = [{ Email: member.Email, Date: triggers.today_(), Type: triggers.ActionType.Renew },
      { Email: member.Email, Date: new Date('2022-01-08'), Type: triggers.ActionType.Expiry1 },
      { Email: member.Email, Type: triggers.ActionType.Expiry2, Date: new Date('2022-01-09'), },
      { Email: member.Email, Type: triggers.ActionType.Expiry3, Date: new Date('2022-01-10'), },
      { Email: member.Email, Type: triggers.ActionType.Expiry4, Date: new Date('2022-01-11'), }
      ].map(e => { e.Date = getDateString(e.Date); return e; });;
      actionSchedule = []
      triggers.addRenewedMemberToActionSchedule_(member, actionSchedule, emailSpecs);
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
      const result = triggers.addDaysToDate_(date, 2);
      expect(result).toEqual(new Date('2021-01-03'));
    });
    it('shoud work with negative numbers', () => {
      const date = new Date('2021-01-01');
      const result = triggers.addDaysToDate_(date, -2);
      expect(result).toEqual(new Date('2020-12-30'));
    });
    it('should work with zero', () => {
      const date = new Date('2021-01-01');
      const result = triggers.addDaysToDate_(date, 0);
      expect(result).toEqual(new Date('2021-01-01'));
    });
    it('should work with a string date', () => {
      const date = '2021-01-01';
      const result = triggers.addDaysToDate_(date, 2);
      expect(result).toEqual(new Date('2021-01-03'));
    });
  })

  describe('createScheduleEntries', () => {

    it('should return a schedule entry for a new member', () => {
      const member = { Email: "test1@example.com", Period: 1, first: "John", last: "Doe", Joined: new Date('2021-01-01'), Expires: new Date('2022-01-10') };
      const result = triggers.createScheduleEntries_(member, triggers.ActionType.Join, actionSpecs)
      result.map(e => {e.Date = getDateString(e.Date); return e});
      const expected = [{ Email: member.Email, Date: triggers.today_(), Type: triggers.ActionType.Join },
      { Email: member.Email, Date: new Date('2022-01-08'), Type: triggers.ActionType.Expiry1 },
      { Email: member.Email, Type: triggers.ActionType.Expiry2, Date: new Date('2022-01-09'), },
      { Email: member.Email, Type: triggers.ActionType.Expiry3, Date: new Date('2022-01-10'), },
      { Email: member.Email, Type: triggers.ActionType.Expiry4, Date: new Date('2022-01-11'), }
      ].map(e => {e.Date = getDateString(e.Date); return e});
      expect(result).toEqual(expected);
    });

  })




  describe('calculateExpirationDate_', () => {
    test('should calculate expiration date based on period in years from today if no existing expiration date is provided', () => {
      const period = 2;
      const result = triggers.calculateExpirationDate_(period);
      const expectedDate = new Date();
      expectedDate.setFullYear(expectedDate.getFullYear() + period);
      expect(getDateString(result)).toEqual(getDateString(expectedDate));
    });

    test('should calculate expiration date based on period in years from existing expiration date if provided', () => {
      const period = 3;
      const existingExpirationDate = new Date('2030-01-01');
      const result = triggers.calculateExpirationDate_(period, existingExpirationDate);
      const expectedDate = new Date('2033-01-01');
      expect(getDateString(result)).toEqual(getDateString(expectedDate));
    });
    test('should return the greater of period added to today or the existing expiration date', () => {
      const period = 1;
      const existingExpirationDate = new Date();
      existingExpirationDate.setFullYear(existingExpirationDate.getFullYear() + 2);
      const result = triggers.calculateExpirationDate_(period, existingExpirationDate);
      const expectedDate = new Date();
      expectedDate.setFullYear(expectedDate.getFullYear() + period + 2);
      expect(getDateString(result)).toEqual(getDateString(expectedDate));
    });

    test('should handle leap years correctly', () => {
      const period = 1;
      const existingExpirationDate = new Date('2052-02-29');
      const result = triggers.calculateExpirationDate_(period, existingExpirationDate);
      const expectedDate = new Date('2053-03-01')
      expect(getDateString(result)).toEqual(getDateString(expectedDate));
    });

    test('should handle negative periods correctly', () => {
      const period = -1;
      const existingExpirationDate = new Date('2050-01-01');
      const result = triggers.calculateExpirationDate_(period, existingExpirationDate);
      const expectedDate = new Date('2049-01-01');
      expect(getDateString(result)).toEqual(getDateString(expectedDate));
    });
  });
});
