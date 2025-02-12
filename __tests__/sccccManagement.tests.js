const mgr = require('../src/scccManagement');
(Utils = require('../src/JavaScript/utils'));


describe('scccManagement', () => {

    let transactions;
    let activeMembers;
    let expiredMembers;
    beforeEach(() => {
        transactions = [
            {
                "Email Address": "a@b.com",
                "First Name": "A",
                "Last Name": "B",
                "Payable Status": "Paid",
                "Payment": "1 year",
                Processed: false,
                "Timestamp": Utils.getDateString()
            },
            {
                "Email Address": "x@y.com",
                "First Name": "X",
                "Last Name": "Y",
                "Payable Status": "Paid",
                "Payment": "2 year",
                Processed: false,
                "Timestamp": Utils.getDateString()
            },
            {
                "Email Address": "m@n.com",
                "First Name": "M",
                "Last Name": "N",
                "Payable Status": "Paid",
                "Payment": "3 year",
                Processed: false,
                "Timestamp": Utils.getDateString(),
            }]
        activeMembers = [];
        expiredMembers = [];
    });
    describe('processPaidTransactions', () => {
        test('it should do nothing if there are no transactions', () => {
            transactions = [];
            const result = mgr.processPaidTransactions(transactions, activeMembers, expiredMembers);
            expect(result).toEqual(0);
        });
        test('should process new transactions correctly with valid input', () => {
            txn = transactions[0]
            transactions = [txn]
            const expectedTransactions = [
                {  ...txn, Processed: Utils.getDateString() }
            ]
            const expectedActiveMembers = [{
                Email: txn["Email Address"],
                First: txn["First Name"],
                Last: txn["Last Name"],
                Joined: Utils.getDateString(),
                Period: 1,
                Expires: Utils.addYearsToDate(new Date(), 1),
                "Renewed On": '',
            },
            ];
            const expectedExpiredMembers = []
            const expectedResult = 1

            const result = mgr.processPaidTransactions(transactions, activeMembers, expiredMembers);

            
            expect(result).toEqual(expectedResult);
            expect(transactions).toEqual(expectedTransactions);
            expect(activeMembers).toEqual(expectedActiveMembers);
            expect(expiredMembers).toEqual(expectedExpiredMembers);


        });
        test('should process renewal transactions correctly with valid input', () => {
            txn = transactions[0]
            transactions = [txn]
            const expectedTransactions = [
                {  ...txn, Processed: Utils.getDateString() }
            ]

            activeMembers = [{
                Email: txn["Email Address"],
                First: txn["First Name"],
                Last: txn["Last Name"],
                Joined: '2022-01-01',
                Period: 1,
                Expires: "2025-10-01",
                "Renewed On": '',
            },
            ];  
            const expectedActiveMembers = [{
                ...activeMembers[0],
                Period: 1,
                Expires: Utils.addYearsToDate("2025-10-01", 1),
                "Renewed On": Utils.getDateString(),   
            },
            ];
            const expectedExpiredMembers = []
            const expectedResult = 1

            const result = mgr.processPaidTransactions(transactions, activeMembers, expiredMembers);

            
            expect(result).toEqual(expectedResult);
            expect(transactions).toEqual(expectedTransactions);
            expect(activeMembers).toEqual(expectedActiveMembers);
            expect(expiredMembers).toEqual(expectedExpiredMembers);


        });
    });
});
