
function testProcessPaidTransactions() {
    const tests = [
        {
            name: 'should return an empty array when no transactions are provided',
            transactions: [],
            members: [],
            expected: []
        },
        {
            name: 'should return an empty array when no paid transactions are provided',
            transactions: [
                { "Payable Status": "unpaid", "Email Address": "test1@example.com" },
                { "Payable Status": "pending", "Email Address": "test2@example.com" }
            ],
            members: [],
            expected: []
        },
        {
            name: 'should return member additions for paid transactions',
            transactions: [
                { "Payable Status": "paid", "Email Address": "test1@example.com", "First Name": "John", "Last Name": "Doe", "Payment": "1 year" },
                { "Payable Status": "paid", "Email Address": "test2@example.com", "First Name": "Jane", "Last Name": "Smith", "Payment": "2 years" }
            ],
            members: [
                { "Email Address": "test1@example.com" },
                { "Email Address": "test2@example.com" }
            ],
            expected: [
                { email: "test1@example.com", period: 1, first: "John", last: "Doe" },
                { email: "test2@example.com", period: 2, first: "Jane", last: "Smith" }
            ]
        },
        {
            name: 'should handle case-insensitive payable status',
            transactions: [
                { "Payable Status": "Paid", "Email Address": "test1@example.com", "First Name": "John", "Last Name": "Doe", "Payment": "1 year" },
                { "Payable Status": "PAID", "Email Address": "test2@example.com", "First Name": "Jane", "Last Name": "Smith", "Payment": "2 years" }
            ],
            members: [
                { "Email Address": "test1@example.com" },
                { "Email Address": "test2@example.com" }
            ],
            expected: [
                { email: "test1@example.com", period: 1, first: "John", last: "Doe" },
                { email: "test2@example.com", period: 2, first: "Jane", last: "Smith" }
            ]
        },
        {
            name: 'should return correct period for transactions without payment info',
            transactions: [
                { "Payable Status": "paid", "Email Address": "test1@example.com", "First Name": "John", "Last Name": "Doe" }
            ],
            members: [
                { "Email Address": "test1@example.com" }
            ],
            expected: [
                { email: "test1@example.com", period: 1, first: "John", last: "Doe" }
            ]
        }
    ];

    tests.forEach(test => {
        const result = processPaidTransactions(test.transactions, test.members);
        const passed = JSON.stringify(result) === JSON.stringify(test.expected);
        console.log(`${test.name}: ${passed ? 'PASSED' : 'FAILED'}`);
    });
}

testProcessPaidTransactions();