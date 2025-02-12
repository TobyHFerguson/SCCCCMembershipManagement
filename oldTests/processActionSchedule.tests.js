const { processActionSchedule } = require('../src/JavaScript/actionScheduler');
const tr = require('../src/JavaScript/triggers');

describe('processActionSchedule', () => {
    describe('basic tests', () => {
        test('should process action schedule correctly with valid input', () => {
            const input = { /* valid input data */ };
            const expectedOutput = { emailQueue: [], expiredMembersQueue: [] };
            const result = processActionSchedule(input);
            expect(result).toEqual(expectedOutput);
        });

        test('should handle empty input', () => {
            const input = {};
            const expectedOutput = { emailQueue: [], expiredMembersQueue: [] };
            result = processActionSchedule([]);
            expect(result).toEqual(expectedOutput);
            result = processActionSchedule();
        });

        test.skip('should throw error for invalid input', () => {
            const input = { /* invalid input data */ };
            expect(() => processActionSchedule(input)).toThrow(Error);
        });
    });
    describe('output tests', () => {
        test('should process action schedule correctly with valid input', () => {
            const actionSchedule = [{ Date: new Date('2021-01-01'), Type: tr.ActionType.Join, Email: "a@b.com" }];
            const expectedOutput = 
                {
                    emailQueue: [{ Type: tr.ActionType.Join, Email: "a@b.com" },],
                    expiredMembersQueue: []
                };
            const result = processActionSchedule(actionSchedule);
            expect(result).toEqual(expectedOutput);
            expect(actionSchedule).toEqual([]);
        });
        test('should process action schedule correctly with valid input', () => {
            const actionSchedule = [
                { Date: new Date('2050-01-01'), Type: tr.ActionType.Expiry1, Email: "leaveMe" },
                { Date: new Date('2021-01-01'), Type: tr.ActionType.Join, Email: "removeMe" },
                { Date: new Date('2045-01-01'), Type: tr.ActionType.Expiry1, Email: "leaveMe" },
                { Date: new Date('2021-01-01'), Type: tr.ActionType.Expiry4, Email: "gone" }
            ];
            const expectedResult = {
                emailQueue: actionSchedule.filter(as => as.Email == "removeMe"),
                expiredMembersQueue: actionSchedule.map(as => {if (as.Email == "gone") return {Email: as.Email}; else return null;}).filter(as => as != null),
            }
            const resultingActionSchedule = actionSchedule.filter(as => as.Email == "leaveMe");
            const result = processActionSchedule(actionSchedule);
            expect(result).toEqual(expectedResult)
            expect(actionSchedule).toEqual(resultingActionSchedule);
        });
        

    });

    // Add more tests as needed
});
