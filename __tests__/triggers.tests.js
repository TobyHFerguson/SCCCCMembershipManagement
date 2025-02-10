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
  { "Email Address": "test1@example.com" },
  { "Email Address": "test2@example.com" }
];

const expectedNewMembers = [
  { email: "test1@example.com", period: 1, first: "John", last: "Doe", type: 'Renew' },
  { email: "test2@example.com", period: 2, first: "Jane", last: "Smith", type: 'Renew' },
  {email: "test3@example.com", period: 3, first: "Not", last: "Member", type: 'Add'}
];

describe('processPaidTransactions', () => {
  it('should return an empty array when no transactions are paid', () => {
    const result = triggers.processPaidTransactions(transactionsFixture.unpaid, membersFixture);
    expect(result).toEqual([]);
  });

  it('should return member additions for paid transactions', () => {
    const result = triggers.processPaidTransactions(transactionsFixture.paid, membersFixture);
    expect(result).toEqual(expectedNewMembers);
  });

  it('should handle case-insensitive payable status', () => {
    const result = triggers.processPaidTransactions(transactionsFixture.caseInsensitive, membersFixture);
    expect(result).toEqual(expectedNewMembers);
  });

  it('should return correct period for transactions with different payment terms', () => {
    const result = triggers.processPaidTransactions(transactionsFixture.differentTerms, membersFixture);
    expect(result).toEqual([{ email: "test1@example.com", period: 3, first: "John", last: "Doe", type: 'Renew' },
      { email: "test2@example.com", period: 1, first: "Jane", last: "Smith", type: 'Renew' },
      {email: "test3@example.com", period: 3, first: "Not", last: "Member", type: 'Add'}
    ]);
  });

  it('should return period as 1 if payment term is not specified', () => {
    const result = triggers.processPaidTransactions(transactionsFixture.noTerm, membersFixture);
    expect(result).toEqual([
      { email: "test1@example.com", period: 1, first: "John", last: "Doe", type: 'Renew' },
      { email: "test2@example.com", period: 1, first: "Jane", last: "Smith", type: 'Renew' },
      {email: "test3@example.com", period: 1, first: "Not", last: "Member", type: 'Add'}
    ]);
  });
});
