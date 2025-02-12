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


describe('trigger tests', () => {
  const today = '2025-01-10'
  beforeEach(() => {
    triggers.setToday(today)
  });
  describe('processPaidTransactions_', () => {

    describe('member addition', () => {
      it('should create the new members', () => {
        const txns = transactionsFixture.paid
        const members = []
        const expectedMembers = [
          { Email: "test1@example.com", Period: 1, First: "John", Last: "Doe", Joined: today, Expires: "2026-01-10", "Renewed On": "" },
          { Email: "test2@example.com", Period: 2, First: "Jane", Last: "Smith", Joined: today, Expires: "2027-01-10", "Renewed On": "" },
          { Email: "test3@example.com", Period: 3, First: "Not", Last: "Member", Joined: today, Expires: "2028-01-10", "Renewed On": "" }]

        triggers.processPaidTransactions(txns, members);
        expect(members.length).toEqual(3)
        expect(members).toEqual(expectedMembers);
      });
      it('should handle membership renewals', () => {
        const members = [{ Email: "test1@example.com", Period: 1, First: "John", Last: "Doe", Joined: "2024-03-10", Expires: "2025-03-10", "Renewed On": "" },]
        const expectedMembers = [
          { Email: "test1@example.com", Period: 1, First: "John", Last: "Doe", Joined: getDateString(), Expires: triggers.addDaysToDate_(new Date(), 365), "Renewed On": triggers.today() },
        ]
        triggers.processPaidTransactions(transactionsFixture.paid, members);
        members.forEach(e => { e.Joined = getDateString(e.Joined); e.Expires = getDateString(e.Expires) });
        expectedMembers.forEach(e => { e.Joined = getDateString(e.Joined); e.Expires = getDateString(e.Expires) });
      });
      it('if renewal is before expiry then new expiry is  old expiry + period', () => {
        const members = [{ Email: "test1@example.com", Period: 1, First: "John", Last: "Doe", Joined: triggers.today(), Expires: triggers.addDaysToDate_(triggers.today(), 10), "Renewed On": "" },]
        const expectedMembers = [
          { Email: "test1@example.com", Period: 1, First: "John", Last: "Doe", Joined: getDateString(), Expires: triggers.addDaysToDate_(new Date(), 365 + 10), "Renewed On": triggers.today() },
        ]
        triggers.processPaidTransactions(transactionsFixture.paid, members);
        members.forEach(e => { e.Joined = getDateString(e.Joined); e.Expires = getDateString(e.Expires) });
        expectedMembers.forEach(e => { e.Joined = getDateString(e.Joined); e.Expires = getDateString(e.Expires) });
      });
      it('if renewal is after expiry then new expiry is today + period', () => {
        const members = [{ Email: "test1@example.com", Period: 1, First: "John", Last: "Doe", Joined: triggers.today(), Expires: triggers.addDaysToDate_(triggers.today(), -10), "Renewed On": "" },]
        const expectedMembers = [
          { Email: "test1@example.com", Period: 1, First: "John", Last: "Doe", Joined: getDateString(), Expires: triggers.addDaysToDate_(new Date(), 365), "Renewed On": triggers.today() },
        ]
        triggers.processPaidTransactions(transactionsFixture.paid, members);
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
          triggers.processPaidTransactions(transactionsFixture.differentTerms, members);
          expect(members.map(m => m.Period)).toEqual(expectedMembers.map(m => m.Period));

        });

        it('should return period as 1 if payment term is not specified', () => {
          const members = []
          triggers.processPaidTransactions(transactionsFixture.noTerm, members);
          expect(members.map(m => m.Period)).toEqual([1, 1, 1])
        });
      })
    })
 
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
      const date = '2021-01-01';
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




  describe('calculateExpirationDate_', () => {
    test('should calculate expiration date based on period in years from today if no existing expiration date is provided', () => {
      const period = 2;
      const result = triggers.calculateExpirationDate_(period);
      const expectedDate = new Date(today);
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
