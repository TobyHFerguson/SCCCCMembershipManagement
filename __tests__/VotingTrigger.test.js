const { Trigger } = require('../src/services/VotingService/Trigger');

describe('Trigger', () => {
    beforeAll(() => {
        // Mock VotingService.Constants for testing
        // @ts-ignore
        global.VotingService = {
            Constants: {
                VOTE_TITLE_COLUMN_NAME: 'Title',
                FORM_EDIT_URL_COLUMN_NAME: 'Form Edit URL',
                ELECTION_OFFICERS_COLUMN_NAME: 'Election Officers',
                TRIGGER_ID_COLUMN_NAME: 'TriggerId',
                REGISTRATION_SHEET_NAME: 'Elections',
                RESULTS_SUFFIX: '- Results',
                INVALID_RESULTS_SHEET_NAME: 'Invalid Results',
                TOKEN_ENTRY_FIELD_TITLE: 'VOTING TOKEN',
                TOKEN_HELP_TEXT: 'This question is used to validate your vote. Do not modify this field.',
                CONFIRMATION_MESSAGE: 'Your vote has been recorded successfully. You will be sent an email indicating how your vote was handled. Thank you for participating!',
                ElectionState: {
                    UNOPENED: 'UNOPENED',
                    ACTIVE: 'ACTIVE',
                    CLOSED: 'CLOSED'
                }
            }
        };
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

    describe('getElectionTitle_', () => {
        it('removes RESULTS_SUFFIX from spreadsheet name', () => {
            const spreadsheet = { getName: () => 'Election 2024 - Results' };
            expect(Trigger.getElectionTitle_(spreadsheet)).toBe('Election 2024');
        });

        it('returns name if no suffix', () => {
            const spreadsheet = { getName: () => 'Election 2024' };
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