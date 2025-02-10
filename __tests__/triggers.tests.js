const triggers = require('../src/JavaScript/triggers');

describe('processPaidTransactions', () => {
  it('should return an empty array when no transactions are paid', () => {
    const transactions = [
      { "Payable Status": "unpaid", "Email Address": "test1@example.com" },
      { "Payable Status": "pending", "Email Address": "test2@example.com" }
    ];
    const members = [
      { "Email Address": "test1@example.com" },
      { "Email Address": "test2@example.com" }
    ];
    const result = triggers.processPaidTransactions(transactions, members);
    expect(result).toEqual([]);
  });

  it('should return member additions for paid transactions', () => {
    const transactions = [
      { "Payable Status": "paid", "Email Address": "test1@example.com", "First Name": "John", "Last Name": "Doe", "Payment": "1 year" },
      { "Payable Status": "paid", "Email Address": "test2@example.com", "First Name": "Jane", "Last Name": "Smith", "Payment": "2 years" }
    ];
    const members = [
      { "Email Address": "test1@example.com" },
      { "Email Address": "test2@example.com" }
    ];
    const result = triggers.processPaidTransactions(transactions, members);
    expect(result).toEqual([
      { email: "test1@example.com", period: 1, first: "John", last: "Doe" },
      { email: "test2@example.com", period: 2, first: "Jane", last: "Smith" }
    ]);
  });

  it('should handle case-insensitive payable status', () => {
    const transactions = [
      { "Payable Status": "Paid", "Email Address": "test1@example.com", "First Name": "John", "Last Name": "Doe", "Payment": "1 year" },
      { "Payable Status": "PAID", "Email Address": "test2@example.com", "First Name": "Jane", "Last Name": "Smith", "Payment": "2 years" }
    ];
    const members = [
      { "Email Address": "test1@example.com" },
      { "Email Address": "test2@example.com" }
    ];
    const result = triggers.processPaidTransactions(transactions, members);
    expect(result).toEqual([
      { email: "test1@example.com", period: 1, first: "John", last: "Doe" },
      { email: "test2@example.com", period: 2, first: "Jane", last: "Smith" }
    ]);
  });

  it('should return correct period for transactions with different payment terms', () => {
    const transactions = [
      { "Payable Status": "paid", "Email Address": "test1@example.com", "First Name": "John", "Last Name": "Doe", "Payment": "3 years" },
      { "Payable Status": "paid", "Email Address": "test2@example.com", "First Name": "Jane", "Last Name": "Smith", "Payment": "1 year" }
    ];
    const members = [
      { "Email Address": "test1@example.com" },
      { "Email Address": "test2@example.com" }
    ];
    const result = triggers.processPaidTransactions(transactions, members);
    expect(result).toEqual([
      { email: "test1@example.com", period: 3, first: "John", last: "Doe" },
      { email: "test2@example.com", period: 1, first: "Jane", last: "Smith" }
    ]);
  });

  it('should return period as 1 if payment term is not specified', () => {
    const transactions = [
      { "Payable Status": "paid", "Email Address": "test1@example.com", "First Name": "John", "Last Name": "Doe", "Payment": "" },
      { "Payable Status": "paid", "Email Address": "test2@example.com", "First Name": "Jane", "Last Name": "Smith" }
    ];
    const members = [
      { "Email Address": "test1@example.com" },
      { "Email Address": "test2@example.com" }
    ];
    const result = triggers.processPaidTransactions(transactions, members);
    expect(result).toEqual([
      { email: "test1@example.com", period: 1, first: "John", last: "Doe" },
      { email: "test2@example.com", period: 1, first: "Jane", last: "Smith" }
    ]);
  });
});