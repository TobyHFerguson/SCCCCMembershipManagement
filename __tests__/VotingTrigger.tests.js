const { Trigger } = require('../src/services/VotingService/Trigger');

describe('Trigger', () => {
    beforeAll(() => {
        //@ts-ignore
        global.TOKEN_ENTRY_FIELD_TITLE = 'VOTING TOKEN'
    });
    describe('firstValues_', () => {
        it('returns first element of array values', () => {
            const input = { a: [1, 2], b: ['x', 'y'], c: 42 };
            const expected = { a: 1, b: 'x', c: 42 };
            expect(Trigger.firstValues_(input)).toEqual(expected);
        });
        it('returns original value if not array', () => {
            const input = { a: 5 };
            expect(Trigger.firstValues_(input)).toEqual({ a: 5 });
        });
    });

    describe('voteIsValid_', () => {
        const consumeMUT = jest.fn();
        const votes = [{ 'Voter Email': 'test@example.com' }];

        beforeEach(() => {
            consumeMUT.mockReset();
        });

        it('returns false if token is invalid', () => {
            consumeMUT.mockReturnValue('');
            const vote = { TOKEN: ['badtoken'] };
            expect(Trigger.voteIsValid_(vote, votes, consumeMUT)).toBe(false);
        });

        it('returns false if duplicate vote', () => {
            consumeMUT.mockReturnValue('test@example.com');
            const vote = { TOKEN: ['token'] };
            expect(Trigger.voteIsValid_(vote, votes, consumeMUT)).toBe(false);
        });

        it('returns true for valid vote', () => {
            consumeMUT.mockReturnValue('unique@example.com');
            const vote = { TOKEN: ['token'] };
            expect(Trigger.voteIsValid_(vote, votes, consumeMUT)).toBe(true);
            expect(vote['Voter Email']).toBe('unique@example.com');
        });
    });

    describe('getElectionTitle_', () => {
        it('removes RESULTS_SUFFIX from spreadsheet name', () => {
            const spreadsheet = { getName: () => 'Election 2024 - Results' };
            //@ts-ignore
            global.RESULTS_SUFFIX = ' - Results';
            expect(Trigger.getElectionTitle_(spreadsheet)).toBe('Election 2024');
        });

        it('returns name if no suffix', () => {
            const spreadsheet = { getName: () => 'Election 2024' };
            //@ts-ignore
            global.RESULTS_SUFFIX = ' - Results';
            expect(Trigger.getElectionTitle_(spreadsheet)).toBe('Election 2024');
        });
    });

    describe('firstValues_', () => {
        it('handles empty object', () => {
            expect(Trigger.firstValues_({})).toEqual({});
        });
    });

    // The following are stubs for Google Apps Script services
    describe('sendVoteRecordedEmail_', () => {
        beforeAll(() => {
            global.MailApp = { sendEmail: jest.fn(), getRemainingDailyQuota: jest.fn() };
        });
        it('calls MailApp.sendEmail with correct params', () => {
            Trigger.sendValidVoteEmail_('to@example.com', 'Election');
            expect(global.MailApp.sendEmail).toHaveBeenCalledWith(expect.objectContaining({
                to: 'to@example.com',
                subject: expect.stringContaining('Election'),
                body: expect.stringContaining('Election')
            }));
        });
    });

    describe('sendDuplicateVoteEmail_', () => {
        beforeAll(() => {
            global.MailApp = { sendEmail: jest.fn(), getRemainingDailyQuota: jest.fn() };
        });
        it('calls MailApp.sendEmail with correct params', () => {
            Trigger.sendInvalidVoteEmail_('to@example.com', 'Election');
            expect(global.MailApp.sendEmail).toHaveBeenCalledWith(expect.objectContaining({
                to: 'to@example.com',
                subject: expect.stringContaining('invalid'),
                body: expect.stringContaining('invalid')
            }));
        });
    });

    describe('sendManualCountNeededEmail_', () => {
        beforeAll(() => {
            global.MailApp = { sendEmail: jest.fn(), getRemainingDailyQuota: jest.fn() };
        });
        it('calls MailApp.sendEmail with correct params', () => {
            Trigger.sendManualCountNeededEmail_('to@example.com', { foo: 'bar' }, 'Election');
            expect(global.MailApp.sendEmail).toHaveBeenCalledWith(expect.objectContaining({
                to: 'to@example.com',
                subject: expect.stringContaining('manual count'),
                body: expect.stringContaining('manual count')
            }));
        });
    });

    describe('firstValues_', () => {
        it('returns first value for mixed arrays and primitives', () => {
            const obj = { a: [1], b: 2, c: ['x', 'y'] };
            expect(Trigger.firstValues_(obj)).toEqual({ a: 1, b: 2, c: 'x' });
        });
    });
});