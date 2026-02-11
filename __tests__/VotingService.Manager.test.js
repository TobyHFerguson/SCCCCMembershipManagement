// @ts-check
/**
 * Test suite for VotingService.Manager
 * Tests the pure business logic for voting operations
 *
 * Table of Contents:
 * 1. getElectionStates - Get election state constants
 * 2. calculateElectionState - Calculate election state based on dates
 * 3. validateEmail - Email validation
 * 4. normalizeEmail - Email normalization
 * 5. hasUserVoted - Check if user has voted
 * 6. validateElection - Election data validation
 * 7. validateToken - Token format validation
 * 8. validateTokenData - Token data validation
 * 9. isDuplicateVote - Check for duplicate votes
 * 10. validateVote - Full vote validation
 * 11. buildElectionStatusMessage - Build status message
 * 12. processElectionForDisplay - Process election for UI
 * 13. extractFirstValues - Extract first values from form response
 * 14. extractElectionTitle - Extract election title from spreadsheet name
 * 15. buildValidVoteEmailContent - Build valid vote email
 * 16. buildInvalidVoteEmailContent - Build invalid vote email
 * 17. buildManualCountEmailContent - Build manual count email
 * 18. buildElectionOpeningEmailContent - Build election opening email
 * 19. buildElectionClosureEmailContent - Build election closure email
 * 20. buildElectionOfficerAddedEmailContent - Build officer added email
 * 21. buildElectionOfficerRemovedEmailContent - Build officer removed email
 * 22. calculateElectionStats - Calculate election statistics
 * 23. formatActiveElectionsResponse - Format API response
 * 24. calculateOfficerChanges - Calculate officer changes
 * 25. parseElectionOfficers - Parse election officers string
 */

const { Manager } = require('../src/services/VotingService/Manager');

// Test data factories
/** @type {{
  createElection: (overrides?: any) => any,
  createTokenData: (overrides?: any) => any,
  createVoter: (overrides?: any) => any,
  [key: string]: any
}} */
const TestData = {
  createElection: (overrides = {}) => ({
    Title: 'Test Election 2024',
    'Form Edit URL': 'https://docs.google.com/forms/d/testFormId/edit',
    'Election Officers': 'officer1@example.com,officer2@example.com',
    Start: '2024-01-01',
    End: '2024-12-31',
    TriggerId: '',
    ...overrides
  }),

  createTokenData: (overrides = {}) => ({
    Email: 'voter@example.com',
    Token: '550e8400-e29b-41d4-a716-446655440000',
    Timestamp: new Date(),
    Used: false,
    ...overrides
  }),

  createVoter: (overrides = {}) => ({
    Email: 'voter@example.com',
    ...overrides
  })
};

describe('VotingService.Manager', () => {
  // ==================== getElectionStates Tests ====================

  describe('getElectionStates', () => {
    test('returns all three election states', () => {
      const states = Manager.getElectionStates();
      expect(states).toHaveProperty('UNOPENED');
      expect(states).toHaveProperty('ACTIVE');
      expect(states).toHaveProperty('CLOSED');
    });

    test('returns correct state values', () => {
      const states = Manager.getElectionStates();
      expect(states.UNOPENED).toBe('UNOPENED');
      expect(states.ACTIVE).toBe('ACTIVE');
      expect(states.CLOSED).toBe('CLOSED');
    });
  });

  // ==================== calculateElectionState Tests ====================

  describe('calculateElectionState', () => {
    const now = new Date('2024-06-15T12:00:00Z');

    test('returns ACTIVE for current date within range', () => {
      const start = '2024-01-01';
      const end = '2024-12-31';
      expect(Manager.calculateElectionState(start, end, now)).toBe('ACTIVE');
    });

    test('returns UNOPENED for future start date', () => {
      const start = '2024-07-01';
      const end = '2024-12-31';
      expect(Manager.calculateElectionState(start, end, now)).toBe('UNOPENED');
    });

    test('returns CLOSED for past end date', () => {
      const start = '2024-01-01';
      const end = '2024-05-31';
      expect(Manager.calculateElectionState(start, end, now)).toBe('CLOSED');
    });

    test('returns UNOPENED for null start date', () => {
      expect(Manager.calculateElectionState(null, '2024-12-31', now)).toBe('UNOPENED');
    });

    test('returns UNOPENED for null end date', () => {
      expect(Manager.calculateElectionState('2024-01-01', null, now)).toBe('UNOPENED');
    });

    test('returns UNOPENED for undefined dates', () => {
      expect(Manager.calculateElectionState(undefined, undefined, now)).toBe('UNOPENED');
    });

    test('returns UNOPENED for invalid date strings', () => {
      expect(Manager.calculateElectionState('invalid', '2024-12-31', now)).toBe('UNOPENED');
      expect(Manager.calculateElectionState('2024-01-01', 'invalid', now)).toBe('UNOPENED');
    });

    test('handles Date objects', () => {
      const start = new Date('2024-01-01');
      const end = new Date('2024-12-31');
      expect(Manager.calculateElectionState(start, end, now)).toBe('ACTIVE');
    });

    test('returns ACTIVE on exact start date', () => {
      const start = '2024-06-15';
      const end = '2024-12-31';
      const startOfDay = new Date('2024-06-15T00:00:00Z');
      expect(Manager.calculateElectionState(start, end, startOfDay)).toBe('ACTIVE');
    });

    test('returns CLOSED when now is after end date with time', () => {
      const start = '2024-01-01';
      const end = '2024-06-15';
      // now is later in the day than midnight, so it's past the end date
      expect(Manager.calculateElectionState(start, end, now)).toBe('CLOSED');
    });

    test('returns ACTIVE on exact end date at midnight', () => {
      const start = '2024-01-01';
      const end = '2024-06-15';
      const endAtMidnight = new Date('2024-06-15T00:00:00Z');
      expect(Manager.calculateElectionState(start, end, endAtMidnight)).toBe('ACTIVE');
    });
  });

  // ==================== validateEmail Tests ====================

  describe('validateEmail', () => {
    test('accepts valid email', () => {
      expect(Manager.validateEmail('user@example.com')).toEqual({ valid: true });
    });

    test('accepts email with subdomain', () => {
      expect(Manager.validateEmail('user@mail.example.com')).toEqual({ valid: true });
    });

    test('accepts email with plus sign', () => {
      expect(Manager.validateEmail('user+tag@example.com')).toEqual({ valid: true });
    });

    test('rejects null email', () => {
      const result = Manager.validateEmail(null);
      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe('INVALID_EMAIL');
    });

    test('rejects undefined email', () => {
      const result = Manager.validateEmail(undefined);
      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe('INVALID_EMAIL');
    });

    test('rejects empty string', () => {
      const result = Manager.validateEmail('');
      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe('INVALID_EMAIL');
    });

    test('rejects whitespace only', () => {
      const result = Manager.validateEmail('   ');
      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe('EMPTY_EMAIL');
    });

    test('rejects email without @', () => {
      const result = Manager.validateEmail('userexample.com');
      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe('INVALID_EMAIL_FORMAT');
    });

    test('rejects email without domain', () => {
      const result = Manager.validateEmail('user@');
      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe('INVALID_EMAIL_FORMAT');
    });
  });

  // ==================== normalizeEmail Tests ====================

  describe('normalizeEmail', () => {
    test('lowercases email', () => {
      expect(Manager.normalizeEmail('USER@EXAMPLE.COM')).toBe('user@example.com');
    });

    test('trims whitespace', () => {
      expect(Manager.normalizeEmail('  user@example.com  ')).toBe('user@example.com');
    });

    test('handles null', () => {
      expect(Manager.normalizeEmail(null)).toBe('');
    });

    test('handles undefined', () => {
      expect(Manager.normalizeEmail(undefined)).toBe('');
    });

    test('handles non-string', () => {
      expect(Manager.normalizeEmail(123)).toBe('');
    });
  });

  // ==================== hasUserVoted Tests ====================

  describe('hasUserVoted', () => {
    test('returns true if user has voted', () => {
      const voters = [TestData.createVoter({ Email: 'voter@example.com' })];
      expect(Manager.hasUserVoted('voter@example.com', voters)).toBe(true);
    });

    test('returns false if user has not voted', () => {
      const voters = [TestData.createVoter({ Email: 'other@example.com' })];
      expect(Manager.hasUserVoted('voter@example.com', voters)).toBe(false);
    });

    test('handles case-insensitive comparison', () => {
      const voters = [TestData.createVoter({ Email: 'VOTER@EXAMPLE.COM' })];
      expect(Manager.hasUserVoted('voter@example.com', voters)).toBe(true);
    });

    test('returns false for empty voters array', () => {
      expect(Manager.hasUserVoted('voter@example.com', [])).toBe(false);
    });

    test('returns false for null voters', () => {
      expect(Manager.hasUserVoted('voter@example.com', null)).toBe(false);
    });

    test('returns false for null email', () => {
      const voters = [TestData.createVoter()];
      expect(Manager.hasUserVoted(null, voters)).toBe(false);
    });
  });

  // ==================== validateElection Tests ====================

  describe('validateElection', () => {
    test('accepts valid election', () => {
      const election = TestData.createElection();
      expect(Manager.validateElection(election)).toEqual({ valid: true });
    });

    test('rejects null election', () => {
      const result = Manager.validateElection(null);
      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe('MISSING_ELECTION');
    });

    test('rejects election without title', () => {
      const election = TestData.createElection({ Title: null });
      const result = Manager.validateElection(election);
      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe('MISSING_TITLE');
    });

    test('rejects election with empty title', () => {
      const election = TestData.createElection({ Title: '' });
      const result = Manager.validateElection(election);
      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe('MISSING_TITLE');
    });
  });

  // ==================== validateToken Tests ====================

  describe('validateToken', () => {
    test('accepts valid token', () => {
      expect(Manager.validateToken('550e8400-e29b-41d4-a716-446655440000')).toEqual({ valid: true });
    });

    test('rejects null token', () => {
      const result = Manager.validateToken(null);
      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe('MISSING_TOKEN');
    });

    test('rejects empty token', () => {
      const result = Manager.validateToken('');
      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe('MISSING_TOKEN');
    });

    test('rejects whitespace only', () => {
      const result = Manager.validateToken('   ');
      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe('EMPTY_TOKEN');
    });

    test('rejects too short token', () => {
      const result = Manager.validateToken('abc123');
      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe('INVALID_TOKEN_FORMAT');
    });
  });

  // ==================== validateTokenData Tests ====================

  describe('validateTokenData', () => {
    test('accepts valid unused token data', () => {
      const tokenData = TestData.createTokenData();
      const result = Manager.validateTokenData(tokenData);
      expect(result.valid).toBe(true);
      expect(result.email).toBe('voter@example.com');
    });

    test('rejects null token data', () => {
      const result = Manager.validateTokenData(null);
      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe('TOKEN_NOT_FOUND');
    });

    test('rejects token without email', () => {
      const tokenData = TestData.createTokenData({ Email: null });
      const result = Manager.validateTokenData(tokenData);
      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe('TOKEN_NO_EMAIL');
    });

    test('rejects used token', () => {
      const tokenData = TestData.createTokenData({ Used: true });
      const result = Manager.validateTokenData(tokenData);
      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe('TOKEN_ALREADY_USED');
      expect(result.email).toBe('voter@example.com');
    });
  });

  // ==================== isDuplicateVote Tests ====================

  describe('isDuplicateVote', () => {
    test('returns true for duplicate vote', () => {
      const allTokens = [
        TestData.createTokenData({ Token: 'token1', Email: 'voter@example.com' }),
        TestData.createTokenData({ Token: 'token2', Email: 'voter@example.com' })
      ];
      expect(Manager.isDuplicateVote('voter@example.com', 'token2', allTokens)).toBe(true);
    });

    test('returns false for unique vote', () => {
      const allTokens = [
        TestData.createTokenData({ Token: 'token1', Email: 'voter1@example.com' }),
        TestData.createTokenData({ Token: 'token2', Email: 'voter2@example.com' })
      ];
      expect(Manager.isDuplicateVote('voter2@example.com', 'token2', allTokens)).toBe(false);
    });

    test('handles case-insensitive email comparison', () => {
      const allTokens = [
        TestData.createTokenData({ Token: 'token1', Email: 'VOTER@EXAMPLE.COM' }),
        TestData.createTokenData({ Token: 'token2', Email: 'voter@example.com' })
      ];
      expect(Manager.isDuplicateVote('voter@example.com', 'token2', allTokens)).toBe(true);
    });

    test('returns false for empty tokens array', () => {
      expect(Manager.isDuplicateVote('voter@example.com', 'token1', [])).toBe(false);
    });

    test('returns false for null email', () => {
      const allTokens = [TestData.createTokenData()];
      expect(Manager.isDuplicateVote(null, 'token1', allTokens)).toBe(false);
    });
  });

  // ==================== validateVote Tests ====================

  describe('validateVote', () => {
    test('accepts valid unique vote', () => {
      const tokenData = TestData.createTokenData({ Token: 'token1' });
      const allTokens = [tokenData];
      const result = Manager.validateVote(tokenData, 'token1', allTokens);
      expect(result.valid).toBe(true);
      expect(result.email).toBe('voter@example.com');
    });

    test('rejects invalid token data', () => {
      const result = Manager.validateVote(null, 'token1', []);
      expect(result.valid).toBe(false);
      expect(result.tokenInvalid).toBe(true);
    });

    test('rejects duplicate vote', () => {
      const tokenData = TestData.createTokenData({ Token: 'token2' });
      const allTokens = [
        TestData.createTokenData({ Token: 'token1', Email: 'voter@example.com' }),
        tokenData
      ];
      const result = Manager.validateVote(tokenData, 'token2', allTokens);
      expect(result.valid).toBe(false);
      expect(result.duplicate).toBe(true);
    });

    test('rejects used token', () => {
      const tokenData = TestData.createTokenData({ Used: true });
      const allTokens = [tokenData];
      const result = Manager.validateVote(tokenData, tokenData.Token, allTokens);
      expect(result.valid).toBe(false);
      expect(result.tokenInvalid).toBe(true);
    });
  });

  // ==================== buildElectionStatusMessage Tests ====================

  describe('buildElectionStatusMessage', () => {
    test('returns already voted message', () => {
      expect(Manager.buildElectionStatusMessage('ACTIVE', true)).toBe(
        "Inactive - you've already voted"
      );
    });

    test('returns unopened message', () => {
      expect(Manager.buildElectionStatusMessage('UNOPENED', false)).toBe(
        'Inactive - election not open yet'
      );
    });

    test('returns closed message', () => {
      expect(Manager.buildElectionStatusMessage('CLOSED', false)).toBe(
        'Inactive - election has closed'
      );
    });

    test('returns active message when ballot accepting', () => {
      expect(Manager.buildElectionStatusMessage('ACTIVE', false, true)).toBe('Active');
    });

    test('returns not accepting message when ballot not accepting', () => {
      expect(Manager.buildElectionStatusMessage('ACTIVE', false, false)).toBe(
        'Inactive - ballot is not accepting responses'
      );
    });

    test('returns unknown status for invalid state', () => {
      expect(Manager.buildElectionStatusMessage('INVALID', false)).toBe('Inactive - unknown status');
    });
  });

  // ==================== processElectionForDisplay Tests ====================

  describe('processElectionForDisplay', () => {
    const now = new Date('2024-06-15T12:00:00Z');

    test('processes active election correctly', () => {
      const election = TestData.createElection();
      const result = Manager.processElectionForDisplay(election, 'user@example.com', [], true, true, now);
      expect(result.title).toBe('Test Election 2024');
      expect(result.status).toBe('Active');
      expect(result.opens).toEqual(new Date('2024-01-01'));
      expect(result.closes).toEqual(new Date('2024-12-31'));
    });

    test('shows already voted status', () => {
      const election = TestData.createElection();
      const voters = [TestData.createVoter({ Email: 'user@example.com' })];
      const result = Manager.processElectionForDisplay(election, 'user@example.com', voters, true, true, now);
      expect(result.status).toBe("Inactive - you've already voted");
    });

    test('handles election without title', () => {
      const election = TestData.createElection({ Title: null });
      const result = Manager.processElectionForDisplay(election, 'user@example.com', [], true, true, now);
      expect(result.title).toBe('Untitled Election');
    });

    test('handles unpublished ballot', () => {
      const election = TestData.createElection();
      const result = Manager.processElectionForDisplay(election, 'user@example.com', [], false, true, now);
      expect(result.status).toBe('Inactive - ballot is not accepting responses');
    });
  });

  // ==================== extractFirstValues Tests ====================

  describe('extractFirstValues', () => {
    test('extracts first element from arrays', () => {
      const input = { a: [1, 2], b: ['x', 'y'], c: 42 };
      const expected = { a: 1, b: 'x', c: 42 };
      expect(Manager.extractFirstValues(input)).toEqual(expected);
    });

    test('preserves non-array values', () => {
      const input = { a: 5, b: 'string', c: null };
      expect(Manager.extractFirstValues(input)).toEqual({ a: 5, b: 'string', c: null });
    });

    test('handles empty object', () => {
      expect(Manager.extractFirstValues({})).toEqual({});
    });

    test('handles null', () => {
      expect(Manager.extractFirstValues(null)).toEqual({});
    });

    test('handles undefined', () => {
      expect(Manager.extractFirstValues(undefined)).toEqual({});
    });
  });

  // ==================== extractElectionTitle Tests ====================

  describe('extractElectionTitle', () => {
    test('removes results suffix', () => {
      expect(Manager.extractElectionTitle('Election 2024 - Results')).toBe('Election 2024');
    });

    test('returns name if no suffix', () => {
      expect(Manager.extractElectionTitle('Election 2024')).toBe('Election 2024');
    });

    test('handles custom suffix', () => {
      expect(Manager.extractElectionTitle('Election 2024 (Results)', ' (Results)')).toBe(
        'Election 2024'
      );
    });

    test('handles null', () => {
      expect(Manager.extractElectionTitle(null)).toBe('');
    });

    test('handles undefined', () => {
      expect(Manager.extractElectionTitle(undefined)).toBe('');
    });
  });

  // ==================== buildValidVoteEmailContent Tests ====================

  describe('buildValidVoteEmailContent', () => {
    test('builds correct email content', () => {
      const content = Manager.buildValidVoteEmailContent('Test Election');
      expect(content.subject).toContain('Test Election');
      expect(content.subject).toContain('valid');
      expect(content.body).toContain('Test Election');
      expect(content.body).toContain('successfully recorded');
    });
  });

  // ==================== buildInvalidVoteEmailContent Tests ====================

  describe('buildInvalidVoteEmailContent', () => {
    test('builds correct email content', () => {
      const content = Manager.buildInvalidVoteEmailContent('Test Election');
      expect(content.subject).toContain('Test Election');
      expect(content.subject).toContain('invalid');
      expect(content.body).toContain('Test Election');
      expect(content.body).toContain('invalid');
    });
  });

  // ==================== buildManualCountEmailContent Tests ====================

  describe('buildManualCountEmailContent', () => {
    test('builds email for duplicate vote', () => {
      const vote = { 'VOTING TOKEN': 'token123' };
      const content = Manager.buildManualCountEmailContent('Test Election', vote);
      expect(content.subject).toContain('manual count');
      expect(content.body).toContain('duplicate');
    });

    test('builds email for missing token', () => {
      const vote = {};
      const content = Manager.buildManualCountEmailContent('Test Election', vote);
      expect(content.body).toContain('no token');
    });
  });

  // ==================== buildElectionOpeningEmailContent Tests ====================

  describe('buildElectionOpeningEmailContent', () => {
    test('builds correct email content', () => {
      const content = Manager.buildElectionOpeningEmailContent('Test Election', 'https://example.com');
      expect(content.subject).toContain('Test Election');
      expect(content.subject).toContain('open');
      expect(content.body).toContain('https://example.com');
    });
  });

  // ==================== buildElectionClosureEmailContent Tests ====================

  describe('buildElectionClosureEmailContent', () => {
    test('builds normal closure email', () => {
      const content = Manager.buildElectionClosureEmailContent('Test Election', 'https://example.com', false);
      expect(content.subject).toContain('closed');
      expect(content.subject).not.toContain('Manual');
    });

    test('builds manual count required email', () => {
      const content = Manager.buildElectionClosureEmailContent('Test Election', 'https://example.com', true);
      expect(content.subject).toContain('Manual Counting Required');
      expect(content.body).toContain('manually counted');
    });
  });

  // ==================== buildElectionOfficerAddedEmailContent Tests ====================

  describe('buildElectionOfficerAddedEmailContent', () => {
    test('builds email for regular drive', () => {
      const content = Manager.buildElectionOfficerAddedEmailContent('Test Form', 'https://example.com', false);
      expect(content.subject).toContain('shared with you');
      expect(content.body).not.toContain('Shared Drive');
    });

    test('builds email for shared drive', () => {
      const content = Manager.buildElectionOfficerAddedEmailContent('Test Form', 'https://example.com', true);
      expect(content.body).toContain('Shared Drive');
    });
  });

  // ==================== buildElectionOfficerRemovedEmailContent Tests ====================

  describe('buildElectionOfficerRemovedEmailContent', () => {
    test('builds email for regular drive', () => {
      const content = Manager.buildElectionOfficerRemovedEmailContent('Test Form', false);
      expect(content.subject).toContain('access removed');
      expect(content.body).not.toContain('Shared Drive');
    });

    test('builds email for shared drive', () => {
      const content = Manager.buildElectionOfficerRemovedEmailContent('Test Form', true);
      expect(content.body).toContain('Shared Drive');
    });
  });

  // ==================== calculateElectionStats Tests ====================

  describe('calculateElectionStats', () => {
    const now = new Date('2024-06-15T12:00:00Z');

    test('calculates stats correctly', () => {
      const elections = [
        TestData.createElection({ Start: '2024-01-01', End: '2024-12-31' }), // ACTIVE
        TestData.createElection({ Start: '2024-07-01', End: '2024-12-31' }), // UNOPENED
        TestData.createElection({ Start: '2024-01-01', End: '2024-05-31' }) // CLOSED
      ];
      const stats = Manager.calculateElectionStats(elections, now);
      expect(stats.total).toBe(3);
      expect(stats.active).toBe(1);
      expect(stats.unopened).toBe(1);
      expect(stats.closed).toBe(1);
    });

    test('handles empty array', () => {
      const stats = Manager.calculateElectionStats([]);
      expect(stats.total).toBe(0);
      expect(stats.active).toBe(0);
      expect(stats.unopened).toBe(0);
      expect(stats.closed).toBe(0);
    });

    test('handles null', () => {
      const stats = Manager.calculateElectionStats(null);
      expect(stats.total).toBe(0);
    });
  });

  // ==================== formatActiveElectionsResponse Tests ====================

  describe('formatActiveElectionsResponse', () => {
    test('formats response correctly', () => {
      const elections = [
        { title: 'Election 1', status: 'Active' },
        { title: 'Election 2', status: 'Closed' }
      ];
      const response = Manager.formatActiveElectionsResponse(elections, 'user@example.com');
      expect(response.elections).toEqual(elections);
      expect(response.userEmail).toBe('user@example.com');
      expect(response.count).toBe(2);
    });
  });

  // ==================== calculateOfficerChanges Tests ====================

  describe('calculateOfficerChanges', () => {
    test('calculates additions correctly', () => {
      const newOfficers = ['new@example.com', 'existing@example.com'];
      const currentOfficers = ['existing@example.com'];
      const changes = Manager.calculateOfficerChanges(newOfficers, currentOfficers);
      expect(changes.toAdd).toEqual(['new@example.com']);
      expect(changes.toRemove).toEqual([]);
    });

    test('calculates removals correctly', () => {
      const newOfficers = ['existing@example.com'];
      const currentOfficers = ['existing@example.com', 'old@example.com'];
      const changes = Manager.calculateOfficerChanges(newOfficers, currentOfficers);
      expect(changes.toAdd).toEqual([]);
      expect(changes.toRemove).toEqual(['old@example.com']);
    });

    test('handles case-insensitive comparison', () => {
      const newOfficers = ['USER@EXAMPLE.COM'];
      const currentOfficers = ['user@example.com'];
      const changes = Manager.calculateOfficerChanges(newOfficers, currentOfficers);
      expect(changes.toAdd).toEqual([]);
      expect(changes.toRemove).toEqual([]);
    });

    test('handles null arrays', () => {
      const changes = Manager.calculateOfficerChanges(null, null);
      expect(changes.toAdd).toEqual([]);
      expect(changes.toRemove).toEqual([]);
    });

    test('filters empty strings', () => {
      const newOfficers = ['valid@example.com', '', '   '];
      const currentOfficers = [];
      const changes = Manager.calculateOfficerChanges(newOfficers, currentOfficers);
      expect(changes.toAdd).toEqual(['valid@example.com']);
    });
  });

  // ==================== parseElectionOfficers Tests ====================

  describe('parseElectionOfficers', () => {
    test('parses comma-separated emails', () => {
      const result = Manager.parseElectionOfficers('a@example.com, b@example.com, c@example.com');
      expect(result).toEqual(['a@example.com', 'b@example.com', 'c@example.com']);
    });

    test('handles single email', () => {
      const result = Manager.parseElectionOfficers('single@example.com');
      expect(result).toEqual(['single@example.com']);
    });

    test('handles empty string', () => {
      const result = Manager.parseElectionOfficers('');
      expect(result).toEqual([]);
    });

    test('handles null', () => {
      const result = Manager.parseElectionOfficers(null);
      expect(result).toEqual([]);
    });

    test('handles undefined', () => {
      const result = Manager.parseElectionOfficers(undefined);
      expect(result).toEqual([]);
    });

    test('filters empty entries', () => {
      const result = Manager.parseElectionOfficers('a@example.com,,  ,b@example.com');
      expect(result).toEqual(['a@example.com', 'b@example.com']);
    });
  });
});
