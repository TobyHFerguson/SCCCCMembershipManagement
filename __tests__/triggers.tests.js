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
const actionSpec = [
  { Type: 'Join', Subject: 'Welcome to the club', Body: 'Welcome to the club, {First} {Last}!' },
  { Type: 'Renew', Subject: 'Renewal', Body: 'Thank you for renewing, {First} {Last}!' },
  { Type: 'Expiry1', Subject: 'First Expiry', Body: 'Your membership is expiring soon, {First} {Last}!', Offset: -10 },
  { Type: 'Expiry2', Subject: 'Second Expiry', Body: 'Your membership is expiring soon, {First} {Last}!', Offset: -5 },
  { Type: 'Expiry3', Subject: 'Third Expiry', Body: 'Your membership is expiring soon, {First} {Last}!', Offset: 0 },
  { Type: 'Expiry4', Subject: 'Final Expiry', Body: 'Your membership has expired, {First} {Last}!', Offset: 10 },
]

describe('trigger tests', () => {
  const actionSpecByType = new Map(actionSpec.map(as => [as.Type, as]));
  const O1 = actionSpecByType.get('Expiry1').Offset;
  const O2 = actionSpecByType.get('Expiry2').Offset;
  const O3 = actionSpecByType.get('Expiry3').Offset;
  const O4 = actionSpecByType.get('Expiry4').Offset;
  const today = new Date('2025-01-10' + 'T00:00:00Z')
  let groupAddFun;
  let groupRemoveFun;
  let sendEmailFun;
  let numProcessed;
  const groupEmails = [{ Email: "a@b.com" }]
  beforeEach(() => {
    numProcessed = 0;
    triggers.setToday(today)
    sendEmailFun = jest.fn();
    groupRemoveFun = jest.fn();
    groupAddFun = jest.fn();
  });
  describe('processExpirations', () => {
    let activeMembers, expiredMembers;
    beforeEach(() => {
      activeMembers = []
      expiredMembers = []
    })
    it('should do nothing if there are no members to expire', () => {
      numProcessed = triggers.processExpirations(activeMembers, expiredMembers, actionSpec, groupRemoveFun, sendEmailFun, groupEmails);
      expect(numProcessed).toEqual(0);
    });
    it('should expire a member if they are fully expired', () => {
      activeMembers = [{ Email: "test1@example.com", Period: 1, First: "John", Last: "Doe", Joined: "2020-03-10", Expires: "2021-01-10", "Renewed On": "" },]
      expectedExpiredMembers = [{ Email: "test1@example.com", Period: 1, First: "John", Last: "Doe", Joined: "2020-03-10", Expires: "2021-01-10", "Renewed On": "" },]
      numProcessed = triggers.processExpirations(activeMembers, expiredMembers, actionSpec, groupRemoveFun, sendEmailFun, groupEmails);
      expect(numProcessed).toEqual(1);
      expect(activeMembers.length).toEqual(0);
      expect(expiredMembers.length).toEqual(1);
      expect(expiredMembers).toEqual(expectedExpiredMembers);
      expect(groupRemoveFun).toHaveBeenCalledTimes(1);
      expect(groupRemoveFun).toHaveBeenCalledWith(groupEmails[0].Email, expectedExpiredMembers[0].Email)
      expect(sendEmailFun).toHaveBeenCalledTimes(1);
      expect(sendEmailFun).toHaveBeenCalledWith({ to: expectedExpiredMembers[0].Email, subject: actionSpecByType.get('Expiry4').Subject, htmlBody: actionSpecByType.get('Expiry4').Body.replace('{First}', expectedExpiredMembers[0].First).replace('{Last}', expectedExpiredMembers[0].Last) })
    });
    it('should only send out the expiry1 email at that time', () => {
      activeMembers = [{ Email: "test1@example.com", Period: 1, First: "John", Last: "Doe", Joined: "2020-03-10", Expires: "2025-01-20", "Renewed On": "" },]
      numProcessed = triggers.processExpirations(activeMembers, expiredMembers, actionSpec, groupRemoveFun, sendEmailFun, groupEmails);
      expect(numProcessed).toEqual(1);
      expect(activeMembers.length).toEqual(1);
      expect(expiredMembers.length).toEqual(0);
      expect(expiredMembers).toEqual([]);
      expect(groupRemoveFun).toHaveBeenCalledTimes(0);
      expect(sendEmailFun).toHaveBeenCalledTimes(1);
      expect(sendEmailFun).toHaveBeenCalledWith({ to: activeMembers[0].Email, subject: actionSpecByType.get('Expiry1').Subject, htmlBody: actionSpecByType.get('Expiry1').Body.replace('{First}', activeMembers[0].First).replace('{Last}', activeMembers[0].Last) })
    })
    it('should only send out the expiry2 email at that time', () => {
      activeMembers = [{ Email: "test1@example.com", Period: 1, First: "John", Last: "Doe", Joined: "2020-03-10", Expires: "2025-01-15", "Renewed On": "" },]
      numProcessed = triggers.processExpirations(activeMembers, expiredMembers, actionSpec, groupRemoveFun, sendEmailFun, groupEmails);
      expect(numProcessed).toEqual(1);
      expect(activeMembers.length).toEqual(1);
      expect(expiredMembers.length).toEqual(0);
      expect(expiredMembers).toEqual([]);
      expect(groupRemoveFun).toHaveBeenCalledTimes(0);
      expect(sendEmailFun).toHaveBeenCalledTimes(1);
      expect(sendEmailFun).toHaveBeenCalledWith({ to: activeMembers[0].Email, subject: actionSpecByType.get('Expiry2').Subject, htmlBody: actionSpecByType.get('Expiry2').Body.replace('{First}', activeMembers[0].First).replace('{Last}', activeMembers[0].Last) })
    })
    it('should only send out the expiry3 email at that time', () => {
      activeMembers = [{ Email: "test1@example.com", Period: 1, First: "John", Last: "Doe", Joined: "2020-03-10", Expires: "2025-01-10", "Renewed On": "" },]
      numProcessed = triggers.processExpirations(activeMembers, expiredMembers, actionSpec, groupRemoveFun, sendEmailFun, groupEmails);
      expect(numProcessed).toEqual(1);
      expect(activeMembers.length).toEqual(1);
      expect(expiredMembers.length).toEqual(0);
      expect(expiredMembers).toEqual([]);
      expect(groupRemoveFun).toHaveBeenCalledTimes(0);
      expect(sendEmailFun).toHaveBeenCalledTimes(1);
      expect(sendEmailFun).toHaveBeenCalledWith({ to: activeMembers[0].Email, subject: actionSpecByType.get('Expiry3').Subject, htmlBody: actionSpecByType.get('Expiry3').Body.replace('{First}', activeMembers[0].First).replace('{Last}', activeMembers[0].Last) })
    })

  })

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
          { Email: "test1@example.com", Period: 1, First: "John", Last: "Doe", Joined: today, Expires: "2026-01-10", "Renewed On": "" },
          { Email: "test2@example.com", Period: 2, First: "Jane", Last: "Smith", Joined: today, Expires: "2027-01-10", "Renewed On": "" },
          { Email: "test3@example.com", Period: 3, First: "Not", Last: "Member", Joined: today, Expires: "2028-01-10", "Renewed On": "" }]

        triggers.processPaidTransactions(txns, members, groupAddFun, sendEmailFun, actionSpec, []);
        members.forEach(e => { e.Joined = getDateString(e.Joined); e.Expires = getDateString(e.Expires) });
        expectedMembers.forEach(e => { e.Joined = getDateString(e.Joined); e.Expires = getDateString(e.Expires) });
        expect(members.length).toEqual(3)
        expect(members).toEqual(expectedMembers);
      });
      it('should handle membership renewals', () => {
        const txns = [{ "Payable Status": "paid", "Email Address": "test1@example.com", "First Name": "John", "Last Name": "Doe", "Payment": "1 year" },
        ]
        const members = [{ Email: "test1@example.com", Period: 1, First: "John", Last: "Doe", Joined: "2024-03-10", Expires: "2025-03-10", "Renewed On": "" },]
        const expectedMembers = [
          { Email: "test1@example.com", Period: 1, First: "John", Last: "Doe", Joined: "2024-03-10", Expires: triggers.addYearsToDate("2025-03-10", 1), "Renewed On": triggers.today() },
        ]
        triggers.processPaidTransactions(txns, members, groupAddFun, sendEmailFun, actionSpec, []);
        members.forEach(e => { e.Joined = getDateString(e.Joined); e.Expires = getDateString(e.Expires) });
        expectedMembers.forEach(e => { e.Joined = getDateString(e.Joined); e.Expires = getDateString(e.Expires) });
        expect(members.length).toEqual(1)
        expect(members).toEqual(expectedMembers);
      });
    });
    describe('group addition tests', () => {
      it('should add a member to a group when the member is added', () => {
        const txns = [{ "Payable Status": "paid", "Email Address": "test1@example.com", "First Name": "John", "Last Name": "Doe", "Payment": "1 year" }]
        const members = []
        triggers.processPaidTransactions(txns, members, groupAddFun, sendEmailFun, actionSpec, []);
        expect(groupAddFun).toHaveBeenCalledWith('test1@example.com');
        triggers.processPaidTransactions(txns, members, groupAddFun);
        expect(groupAddFun).toHaveBeenCalledTimes(1);
      })
      it('should not add a member to a group when the member is renewed', () => {
        const txns = [{ "Payable Status": "paid", "Email Address": "test1@example.com", "First Name": "John", "Last Name": "Doe", "Payment": "1 year" }]
        const members = [{ Email: "test1@example.com", Period: 1, First: "John", Last: "Doe", Joined: "2024-03-10", Expires: "2025-03-10", "Renewed On": "" },]
        triggers.processPaidTransactions(txns, members, groupAddFun, sendEmailFun, actionSpec, []);
        triggers.processPaidTransactions(txns, members, groupAddFun);
        expect(groupAddFun).toHaveBeenCalledTimes(0);
      });
    });
    describe('sending emails', () => {
      it('should send an email when a member is added', () => {
        const txns = [{ "Payable Status": "paid", "Email Address": "test1@example.com", "First Name": "John", "Last Name": "Doe", "Payment": "1 year" }]
        const members = []
        triggers.processPaidTransactions(txns, members, groupAddFun, sendEmailFun, actionSpec, []);
        expect(sendEmailFun).toHaveBeenCalledWith({
          to: members[0].Email,
          subject: triggers.expandTemplate(actionSpecByType.get('Join').Subject, members[0]),
          htmlBody: triggers.expandTemplate(actionSpecByType.get('Join').Body, members[0])
        });
        expect(sendEmailFun).toHaveBeenCalledTimes(1);
      });
      it('should send an email when the member is renewed', () => {
        const txns = [{ "Payable Status": "paid", "Email Address": "test1@example.com", "First Name": "John", "Last Name": "Doe", "Payment": "1 year" }]
        const members = [{ Email: "test1@example.com", Period: 1, First: "John", Last: "Doe", Joined: "2024-03-10", Expires: "2025-03-10", "Renewed On": "" },]
        triggers.processPaidTransactions(txns, members, groupAddFun, sendEmailFun, actionSpec, []);
        expect(sendEmailFun).toHaveBeenCalledWith({
          to: members[0].Email,
          subject: triggers.expandTemplate(actionSpecByType.get('Renew').Subject, members[0]),
          htmlBody: triggers.expandTemplate(actionSpecByType.get('Renew').Body, members[0])
        });
        expect(sendEmailFun).toHaveBeenCalledTimes(1);
      });
    })
    describe('membership expiry period tests', () => {
      it('if renewal is before expiry then new expiry is  old expiry + period', () => {
        const members = [{ Email: "test1@example.com", Period: 1, First: "John", Last: "Doe", Joined: triggers.today(), Expires: triggers.addDaysToDate(triggers.today(), 10), "Renewed On": "" },]
        const expectedMembers = [
          { Email: "test1@example.com", Period: 1, First: "John", Last: "Doe", Joined: getDateString(), Expires: triggers.addDaysToDate(new Date(), 365 + 10), "Renewed On": triggers.today() },
        ]
        triggers.processPaidTransactions(transactionsFixture.paid, members);
        members.forEach(e => { e.Joined = getDateString(e.Joined); e.Expires = getDateString(e.Expires) });
        expectedMembers.forEach(e => { e.Joined = getDateString(e.Joined); e.Expires = getDateString(e.Expires) });
      });
      it('if renewal is after expiry then new expiry is today + period', () => {
        const members = [{ Email: "test1@example.com", Period: 1, First: "John", Last: "Doe", Joined: triggers.today(), Expires: triggers.addDaysToDate(triggers.today(), -10), "Renewed On": "" },]
        const expectedMembers = [
          { Email: "test1@example.com", Period: 1, First: "John", Last: "Doe", Joined: getDateString(), Expires: triggers.addDaysToDate(new Date(), 365), "Renewed On": triggers.today() },
        ]
        triggers.processPaidTransactions(transactionsFixture.paid, members);
        members.forEach(e => { e.Joined = getDateString(e.Joined); e.Expires = getDateString(e.Expires) });
        expectedMembers.forEach(e => { e.Joined = getDateString(e.Joined); e.Expires = getDateString(e.Expires) });
      });
    })
    describe('period calculation', () => {
      it('should return correct period for transactions with different payment terms', () => {
        const members = [];
        const expectedMembers = [{ Email: "test1@example.com", Period: 3, first: "John", last: "Doe" },
        { Email: "test2@example.com", Period: 1, first: "Jane", last: "Smith", },
        { Email: "test3@example.com", Period: 3, first: "Not", last: "Member" }
        ];
        triggers.processPaidTransactions(transactionsFixture.differentTerms, members, groupAddFun, sendEmailFun, actionSpec, []);
        expect(members.map(m => m.Period)).toEqual(expectedMembers.map(m => m.Period));

      });

      it('should return period as 1 if payment term is not specified', () => {
        const members = []
        triggers.processPaidTransactions(transactionsFixture.noTerm, members, groupAddFun, sendEmailFun, actionSpec, []);
        expect(members.map(m => m.Period)).toEqual([1, 1, 1])
      });
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

  describe('addDaysToDate  ', () => {
    it('should add a number of days to a date', () => {
      const date = '2021-01-01';
      const result = triggers.addDaysToDate(date, 2);
      expect(result).toEqual(new Date('2021-01-03'));
    });
    it('shoud work with negative numbers', () => {
      const date = new Date('2021-01-01');
      const result = triggers.addDaysToDate(date, -2);
      expect(result).toEqual(new Date('2020-12-30'));
    });
    it('should work with zero', () => {
      const date = new Date('2021-01-01');
      const result = triggers.addDaysToDate(date, 0);
      expect(result).toEqual(new Date('2021-01-01'));
    });
    it('should work with a string date', () => {
      const date = '2021-01-01';
      const result = triggers.addDaysToDate(date, 2);
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
      const result = triggers.calculateExpirationDate(period);
      const expectedDate = new Date(today);
      expectedDate.setFullYear(expectedDate.getFullYear() + period);
      expect(getDateString(result)).toEqual(getDateString(expectedDate));
    });

    test('should calculate expiration date based on period in years from existing expiration date if provided', () => {
      const period = 3;
      const existingExpirationDate = new Date('2030-01-01');
      const result = triggers.calculateExpirationDate(period, existingExpirationDate);
      const expectedDate = new Date('2033-01-01');
      expect(getDateString(result)).toEqual(getDateString(expectedDate));
    });
    test('should return the greater of period added to today or the existing expiration date', () => {
      const period = 1;
      const existingExpirationDate = new Date();
      existingExpirationDate.setFullYear(existingExpirationDate.getFullYear() + 2);
      const result = triggers.calculateExpirationDate(period, existingExpirationDate);
      const expectedDate = new Date();
      expectedDate.setFullYear(expectedDate.getFullYear() + period + 2);
      expect(getDateString(result)).toEqual(getDateString(expectedDate));
    });

    test('should handle leap years correctly', () => {
      const period = 1;
      const existingExpirationDate = new Date('2052-02-29');
      const result = triggers.calculateExpirationDate(period, existingExpirationDate);
      const expectedDate = new Date('2053-03-01')
      expect(getDateString(result)).toEqual(getDateString(expectedDate));
    });

    test('should handle negative periods correctly', () => {
      const period = -1;
      const existingExpirationDate = new Date('2050-01-01');
      const result = triggers.calculateExpirationDate(period, existingExpirationDate);
      const expectedDate = new Date('2049-01-01');
      expect(getDateString(result)).toEqual(getDateString(expectedDate));
    });
  });

  describe('actionSchedule', () => {
    it('should create an actionSchedule', () => {
      const txn = { "Payable Status": "paid", "Email Address": "test1@example.com", "First Name": "John", "Last Name": "Doe", "Payment": "1 year" }
      const actionSchedule = []
      const expected = [
        { Email: txn["Email Address"], Type: triggers.ActionType.Join, Date: today, },
        { Email: txn["Email Address"], Type: triggers.ActionType.Expiry1, Date: triggers.addDaysToDate(today, 365 + O1) },
        { Email: txn["Email Address"], Type: triggers.ActionType.Expiry2, Date: triggers.addDaysToDate(today, 365 + O2) },
        { Email: txn["Email Address"], Type: triggers.ActionType.Expiry3, Date: triggers.addDaysToDate(today, 365 + O3), },
        { Email: txn["Email Address"], Type: triggers.ActionType.Expiry4, Date: triggers.addDaysToDate(today, 365 + O4), }
      ];
      expected.forEach(e => { console.log(e); e.Date = getDateString(e.Date) });
      triggers.processPaidTransactions([txn], [], groupAddFun, sendEmailFun,  actionSpec, actionSchedule);
      actionSchedule.forEach(a => a.Date = getDateString(a.Date));
      expect(actionSchedule).toEqual(expected);
    })
    it('should update an existing actionSchedule', () => {
      const members = [{ Email: "test1@example.com", Period: 1, first: "John", last: "Doe", Joined: '2021-01-01', Expires: triggers.addDaysToDate(today, 365) }];
      const actionSchedule = [
        { Email: "test1@example.com", Type: triggers.ActionType.Join, Date: today, },
        { Email: "test1@example.com", Type: triggers.ActionType.Expiry1, Date: triggers.addDaysToDate(today, 365 - O1) },
        { Email: "test1@example.com", Type: triggers.ActionType.Expiry2, Date: triggers.addDaysToDate(today, 365 - O2) },
        { Email: "test1@example.com", Type: triggers.ActionType.Expiry3, Date: triggers.addDaysToDate(today, 365 - O3), },
        { Email: "test1@example.com", Type: triggers.ActionType.Expiry4, Date: triggers.addDaysToDate(today, 365 + 1), }
      ].map(e => { e.Date = getDateString(e.Date); return e; });
      const txns = [
        { "Payable Status": "paid", "Email Address": "test1@example.com", "First Name": "John", "Last Name": "Doe", "Payment": "1 year" },
        { "Payable Status": "paid", "Email Address": "test2@example.com", "First Name": "Jane", "Last Name": "Smith", "Payment": "3 years" }
      ]
      const expected = [
        { Email: "test1@example.com", Type: triggers.ActionType.Renew, Date: today, },
        { Email: "test1@example.com", Type: triggers.ActionType.Expiry1, Date: triggers.addDaysToDate(today, (2 * 365) +O1) },
        { Email: "test1@example.com", Type: triggers.ActionType.Expiry2, Date: triggers.addDaysToDate(today, (2 * 365) +O2) },
        { Email: "test1@example.com", Type: triggers.ActionType.Expiry3, Date: triggers.addDaysToDate(today, (2 * 365) +O3), },
        { Email: "test1@example.com", Type: triggers.ActionType.Expiry4, Date: triggers.addDaysToDate(today, (2 * 365) +O4), },
        { Email: "test2@example.com", Type: triggers.ActionType.Join, Date: today, },
        { Email: "test2@example.com", Type: triggers.ActionType.Expiry1, Date: triggers.addDaysToDate(today, (3 * 365) +O1) },
        { Email: "test2@example.com", Type: triggers.ActionType.Expiry2, Date: triggers.addDaysToDate(today, (3 * 365) +O2) },
        { Email: "test2@example.com", Type: triggers.ActionType.Expiry3, Date: triggers.addDaysToDate(today, (3 * 365) +O3), },
        { Email: "test2@example.com", Type: triggers.ActionType.Expiry4, Date: triggers.addDaysToDate(today, (3 * 365) +O4), },
      ].map(e => { e.Date = getDateString(e.Date); return e; });
      triggers.processPaidTransactions(txns, members, groupAddFun, sendEmailFun,  actionSpec, actionSchedule);
      actionSchedule.forEach(a => a.Date = getDateString(a.Date));
      expect(actionSchedule).toEqual(expected);
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
      emailSpecs = actionSpec
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
      const expected = [{ Email: member.Email, Date: today, Type: triggers.ActionType.Renew },
      { Email: member.Email, Type: triggers.ActionType.Expiry1, Date: triggers.addDaysToDate('2022-01-10',  O1),  },
      { Email: member.Email, Type: triggers.ActionType.Expiry2, Date: triggers.addDaysToDate('2022-01-10',  O2), },
      { Email: member.Email, Type: triggers.ActionType.Expiry3, Date: triggers.addDaysToDate('2022-01-10',  O3), },
      { Email: member.Email, Type: triggers.ActionType.Expiry4, Date: triggers.addDaysToDate('2022-01-10',  O4), }
      ].map(e => { e.Date = getDateString(e.Date); return e; });
      actionSchedule = [{ Email: member.Email, Type: triggers.ActionType.Expiry3, Date: getDateString('2021-01-10'), },
      ]
      triggers.addRenewedMemberToActionSchedule_(member, actionSchedule, emailSpecs);
      actionSchedule.forEach(e => e.Date = getDateString(e.Date));
      expect(actionSchedule).toEqual(expected);

    });

    it('should add new action schedule entries for the renewed member', () => {
      const member = { Email: "test1@example.com", Period: 1, first: "John", last: "Doe", Joined: new Date('2021-01-01'), Expires: new Date('2022-01-10') };
      const expected = [{ Email: member.Email, Date: today, Type: triggers.ActionType.Renew },
        { Email: member.Email, Type: triggers.ActionType.Expiry1, Date: triggers.addDaysToDate('2022-01-10',  O1),  },
        { Email: member.Email, Type: triggers.ActionType.Expiry2, Date: triggers.addDaysToDate('2022-01-10',  O2), },
        { Email: member.Email, Type: triggers.ActionType.Expiry3, Date: triggers.addDaysToDate('2022-01-10',  O3), },
        { Email: member.Email, Type: triggers.ActionType.Expiry4, Date: triggers.addDaysToDate('2022-01-10',  O4), }
      ].map(e => { e.Date = getDateString(e.Date); return e; });;
      actionSchedule = []
      triggers.addRenewedMemberToActionSchedule_(member, actionSchedule, emailSpecs);
      actionSchedule.forEach(e => e.Date = getDateString(e.Date));
      expect(actionSchedule).toEqual(expected);
    });

  });
})