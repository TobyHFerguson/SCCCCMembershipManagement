const triggers = require('../src/JavaScript/triggers');
const { today } = require('../src/JavaScript/utils');

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
  { Email: "test1@example.com", Period: 1, first: "John", last: "Doe" },
  { Email: "test2@example.com", Period: 2, first: "Jane", last: "Smith" },
  { Email: "test3@example.com", Period: 3, first: "Not", last: "Member" }
];

const actionSpecs = [
  { Type: triggers.ActionType.Join, Subject: "Join Subject", Body: "Join Body" },
  { Type: triggers.ActionType.Renew, Subject: "Renew Subject", Body: "Renew Body" },
  { Type: triggers.ActionType.Expiry1, Subject: "Expiry1 Subject", Body: "Expiry1 Body", Offset: -2 },
  { Type: triggers.ActionType.Expiry2, Subject: "Expiry2 Subject", Body: "Expiry2 Body", Offset: -1 },
  { Type: triggers.ActionType.Expiry3, Subject: "Expiry3 Subject", Body: "Expiry3 Body", Offset: 0 },
  { Type: triggers.ActionType.Expiry4, Subject: "Expiry4 Subject", Body: "Expiry4 Body", Offset: 1 }
]
describe('processPaidTransactions_', () => {
  it('should return an empty array when no transactions are paid', () => {
    const result = triggers.processPaidTransactions_(transactionsFixture.unpaid, membersFixture);
    expect(result).toEqual([]);
  });

  it('should return member additions for paid transactions', () => {
    const result = triggers.processPaidTransactions_(transactionsFixture.paid, [], [], actionSpecs);
    expect(result).toEqual(expectedNewMembers.map(m => m.Email));
  });

  it('should handle case-insensitive payable status', () => {
    const result = triggers.processPaidTransactions_(transactionsFixture.caseInsensitive, [], [], actionSpecs);
    expect(result).toEqual(expectedNewMembers.map(m => m.Email));
  });

  it('should return correct period for transactions with different payment terms', () => {
    const members = [];
    const expectedMembers = [{ Email: "test1@example.com", Period: 3, first: "John", last: "Doe" },
    { Email: "test2@example.com", Period: 1, first: "Jane", last: "Smith", },
    { Email: "test3@example.com", Period: 3, first: "Not", last: "Member" }
    ];
    const result = triggers.processPaidTransactions_(transactionsFixture.differentTerms, members, [], actionSpecs);
    expect(result).toEqual(expectedNewMembers.map(m => m.Email));
    expect(members.map(m => m.Period)).toEqual(expectedMembers.map(m => m.Period));

  });

  it('should return period as 1 if payment term is not specified', () => {
    const members = []
    triggers.processPaidTransactions_(transactionsFixture.noTerm, members, [], actionSpecs);
    expect(members.map(m => m.Period)).toEqual([1, 1, 1])
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
  } ); 
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

describe('createScheduleEntry', () => {

  it('should return a schedule entry for a new member', () => {
    const member = { Email: "test1@example.com", Period: 1, first: "John", last: "Doe", Joined: getDateString('2021-01-01'), Expires: getDateString('2022-01-10') };
    actionSpecs.length
    const result = triggers.createScheduleEntries_(member, triggers.ActionType.Join, actionSpecs)
    result.forEach(e => e.Date = getDateString(e.Date)); 
    const expected = [{ Email: member.Email, Date: getDateString(), Type: triggers.ActionType.Join },
    { Email: member.Email, Date: getDateString('2022-01-08'), Type: triggers.ActionType.Expiry1 },
    { Email: member.Email, Type: triggers.ActionType.Expiry2, Date: getDateString('2022-01-09'), },
    { Email: member.Email, Type: triggers.ActionType.Expiry3, Date: getDateString('2022-01-10'), },
    { Email: member.Email, Type: triggers.ActionType.Expiry4, Date: getDateString('2022-01-11'), }
    ];
    expect(result).toEqual(expected);
  });
  it.skip('should return empty array when there are no new members', () => {
    const result = triggers.processMemberAdditions([], members);
    expect(result).toEqual([]);
  });
})

