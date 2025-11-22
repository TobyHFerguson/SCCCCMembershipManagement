const { Audit } = require('../src/common/audit/AuditLogger');

describe('Audit.Logger', () => {
    let logger;
    let testDate;

    beforeEach(() => {
        testDate = new Date('2024-01-15T10:30:00Z');
        logger = new Audit.Logger(testDate);
    });

    describe('createLogEntry', () => {
        it('should create a valid audit log entry with required fields', () => {
            const params = {
                type: 'Join',
                outcome: 'success'
            };

            const entry = logger.createLogEntry(params);

            expect(entry).toEqual({
                Timestamp: testDate,
                Type: 'Join',
                Outcome: 'success',
                Note: '',
                Error: '',
                JSON: ''
            });
        });

        it('should create an entry with all optional fields', () => {
            const params = {
                type: 'Renew',
                outcome: 'success',
                note: 'Member renewed for 2 years',
                error: '',
                jsonData: { email: 'test@example.com', period: 2 }
            };

            const entry = logger.createLogEntry(params);

            expect(entry.Type).toBe('Renew');
            expect(entry.Outcome).toBe('success');
            expect(entry.Note).toBe('Member renewed for 2 years');
            expect(entry.JSON).toBe(JSON.stringify({ email: 'test@example.com', period: 2 }, null, 2));
        });

        it('should create a failure entry with error details', () => {
            const params = {
                type: 'DeadLetter',
                outcome: 'fail',
                note: 'Failed to send email after max attempts',
                error: 'MailApp error: User not found',
                jsonData: {
                    attempts: 5,
                    lastError: 'MailApp error: User not found',
                    email: 'invalid@example.com'
                }
            };

            const entry = logger.createLogEntry(params);

            expect(entry.Type).toBe('DeadLetter');
            expect(entry.Outcome).toBe('fail');
            expect(entry.Note).toBe('Failed to send email after max attempts');
            expect(entry.Error).toBe('MailApp error: User not found');
            expect(entry.JSON).toContain('attempts');
            expect(entry.JSON).toContain('5');
        });

        it('should throw error if params is not an object', () => {
            expect(() => logger.createLogEntry(null)).toThrow('params must be an object');
            expect(() => logger.createLogEntry('string')).toThrow('params must be an object');
            expect(() => logger.createLogEntry(123)).toThrow('params must be an object');
        });

        it('should throw error if type is missing', () => {
            expect(() => logger.createLogEntry({ outcome: 'success' })).toThrow('type is required');
        });

        it('should throw error if outcome is missing or invalid', () => {
            expect(() => logger.createLogEntry({ type: 'Join' })).toThrow('outcome must be "success" or "fail"');
            expect(() => logger.createLogEntry({ type: 'Join', outcome: 'invalid' })).toThrow('outcome must be "success" or "fail"');
        });

        it('should handle all ActionType values', () => {
            const actionTypes = ['Join', 'Renew', 'Migrate', 'Expiry1', 'Expiry2', 'Expiry3', 'Expiry4', 'DeadLetter'];

            actionTypes.forEach(type => {
                const entry = logger.createLogEntry({ type, outcome: 'success' });
                expect(entry.Type).toBe(type);
            });
        });

        it('should serialize complex jsonData correctly', () => {
            const complexData = {
                error: new Error('Test error'),
                stack: 'Error stack trace...',
                nested: {
                    field1: 'value1',
                    field2: 123
                }
            };

            const entry = logger.createLogEntry({
                type: 'Expiry4',
                outcome: 'fail',
                jsonData: complexData
            });

            expect(entry.JSON).toBeTruthy();
            const parsed = JSON.parse(entry.JSON);
            expect(parsed.nested.field1).toBe('value1');
        });
    });

    describe('createLogEntries', () => {
        it('should create multiple log entries', () => {
            const paramsArray = [
                { type: 'Join', outcome: 'success', note: 'New member 1' },
                { type: 'Join', outcome: 'success', note: 'New member 2' },
                { type: 'Renew', outcome: 'success', note: 'Renewed member' }
            ];

            const entries = logger.createLogEntries(paramsArray);

            expect(entries).toHaveLength(3);
            expect(entries[0].Type).toBe('Join');
            expect(entries[0].Note).toBe('New member 1');
            expect(entries[1].Type).toBe('Join');
            expect(entries[1].Note).toBe('New member 2');
            expect(entries[2].Type).toBe('Renew');
        });

        it('should return empty array for empty input', () => {
            const entries = logger.createLogEntries([]);
            expect(entries).toEqual([]);
        });

        it('should throw error if input is not an array', () => {
            expect(() => logger.createLogEntries(null)).toThrow('paramsArray must be an array');
            expect(() => logger.createLogEntries({})).toThrow('paramsArray must be an array');
        });

        it('should validate each entry in the array', () => {
            const paramsArray = [
                { type: 'Join', outcome: 'success' },
                { type: 'Invalid' } // Missing outcome
            ];

            expect(() => logger.createLogEntries(paramsArray)).toThrow('outcome must be "success" or "fail"');
        });
    });

    describe('timestamp handling', () => {
        it('should use provided date for all entries', () => {
            const customDate = new Date('2023-06-15T14:20:00Z');
            const customLogger = new Audit.Logger(customDate);

            const entry = customLogger.createLogEntry({ type: 'Join', outcome: 'success' });

            expect(entry.Timestamp).toEqual(customDate);
        });

        it('should use current date if no date provided', () => {
            const loggerNoDate = new Audit.Logger();
            const beforeCreation = new Date();
            
            const entry = loggerNoDate.createLogEntry({ type: 'Join', outcome: 'success' });
            
            const afterCreation = new Date();
            expect(entry.Timestamp.getTime()).toBeGreaterThanOrEqual(beforeCreation.getTime());
            expect(entry.Timestamp.getTime()).toBeLessThanOrEqual(afterCreation.getTime());
        });
    });
});
