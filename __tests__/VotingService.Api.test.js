// @ts-check
/**
 * Test suite for VotingService.Api
 * Tests the GAS orchestration layer for voting operations
 *
 * Table of Contents:
 * 1. initApi - API initialization
 * 2. handleGetActiveElections - Get active elections handler
 * 3. handleGetElectionStats - Get election statistics handler
 * 4. handleGenerateBallotToken - Generate ballot token handler
 */

// Set up VotingService namespace before requiring Api
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
    CONFIRMATION_MESSAGE: 'Your vote has been recorded successfully!',
    ElectionState: {
      UNOPENED: 'UNOPENED',
      ACTIVE: 'ACTIVE',
      CLOSED: 'CLOSED'
    }
  },
  Data: {
    getElectionData: jest.fn(),
    hasVotedAlreadyInThisElection: jest.fn()
  },
  Auth: {
    getAllTokens: jest.fn(),
    generateAndStoreToken: jest.fn()
  },
  getBallot: jest.fn(),
  getSpreadsheetIdFromElection: jest.fn(),
  createPrefilledUrlWithTitle: jest.fn()
};

// Import Manager first (it will extend VotingService)
const { Manager } = require('../src/services/VotingService/Manager');
global.VotingService.Manager = Manager;

// Mock ApiClient (flat class pattern)
global.ApiClient = {
  registerHandler: jest.fn(),
  handleRequest: jest.fn(),
  clearHandlers: jest.fn()
};

// Mock ApiClientManager (flat class pattern)
global.ApiClientManager = {
  successResponse: jest.fn((data) => ({ success: true, data })),
  errorResponse: jest.fn((error, errorCode) => ({ success: false, error, errorCode }))
};

// Set up Common namespace for API handling
global.Common = {
  Api: {
    Client: global.ApiClient,
    ClientManager: global.ApiClientManager
  }
};

// Set up Logger
global.AppLogger = {
  log: jest.fn()
};

// Import Api module
const { Api, initApi } = require('../src/services/VotingService/Api');

// Test data factories
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

  createBallot: (overrides = {}) => ({
    isPublished: jest.fn(() => true),
    isAcceptingResponses: jest.fn(() => true),
    ...overrides
  })
};

describe('VotingService.Api', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ==================== initApi Tests ====================

  describe('initApi', () => {
    test('registers all API handlers', () => {
      initApi();

      expect(ApiClient.registerHandler).toHaveBeenCalledTimes(3);

      // Check that each handler is registered
      expect(ApiClient.registerHandler).toHaveBeenCalledWith(
        'voting.getActiveElections',
        expect.any(Function),
        expect.objectContaining({ requiresAuth: true })
      );

      expect(ApiClient.registerHandler).toHaveBeenCalledWith(
        'voting.getElectionStats',
        expect.any(Function),
        expect.objectContaining({ requiresAuth: true })
      );

      expect(ApiClient.registerHandler).toHaveBeenCalledWith(
        'voting.generateBallotToken',
        expect.any(Function),
        expect.objectContaining({ requiresAuth: true })
      );
    });
  });

  // ==================== handleGetActiveElections Tests ====================

  describe('handleGetActiveElections', () => {
    test('returns error when user email not available', () => {
      const result = Api.handleGetActiveElections({});

      expect(ApiClientManager.errorResponse).toHaveBeenCalledWith(
        'User email not available',
        'NO_EMAIL'
      );
    });

    test('returns elections successfully', () => {
      const elections = [TestData.createElection()];
      const ballot = TestData.createBallot();

      (/** @type {any} */ (VotingService.Data.getElectionData)).mockReturnValue(elections);
      (/** @type {any} */ (VotingService.getSpreadsheetIdFromElection)).mockReturnValue('spreadsheetId');
      (/** @type {any} */ (VotingService.Auth.getAllTokens)).mockReturnValue([]);
      (/** @type {any} */ (VotingService.getBallot)).mockReturnValue(ballot);

      const result = Api.handleGetActiveElections({ _authenticatedEmail: 'user@example.com' });

      expect(ApiClientManager.successResponse).toHaveBeenCalled();
      const successCall = (/** @type {any} */ (ApiClientManager.successResponse)).mock.calls[0][0];
      expect(successCall.userEmail).toBe('user@example.com');
      expect(successCall.elections).toBeDefined();
      expect(successCall.count).toBeGreaterThanOrEqual(0);
    });

    test('skips elections without form URL', () => {
      const elections = [TestData.createElection({ 'Form Edit URL': '' })];

      (/** @type {any} */ (VotingService.Data.getElectionData)).mockReturnValue(elections);

      const result = Api.handleGetActiveElections({ _authenticatedEmail: 'user@example.com' });

      expect(ApiClientManager.successResponse).toHaveBeenCalled();
      const successCall = (/** @type {any} */ (ApiClientManager.successResponse)).mock.calls[0][0];
      expect(successCall.elections).toHaveLength(0);
    });

    test('handles error when getting voters fails', () => {
      const elections = [TestData.createElection()];
      const ballot = TestData.createBallot();

      (/** @type {any} */ (VotingService.Data.getElectionData)).mockReturnValue(elections);
      (/** @type {any} */ (VotingService.getSpreadsheetIdFromElection)).mockImplementation(() => {
        throw new Error('Spreadsheet not found');
      });
      (/** @type {any} */ (VotingService.getBallot)).mockReturnValue(ballot);

      const result = Api.handleGetActiveElections({ _authenticatedEmail: 'user@example.com' });

      // Should still succeed but with empty voters
      expect(ApiClientManager.successResponse).toHaveBeenCalled();
    });

    test('handles error when getting ballot status fails', () => {
      const elections = [TestData.createElection()];

      (/** @type {any} */ (VotingService.Data.getElectionData)).mockReturnValue(elections);
      (/** @type {any} */ (VotingService.getSpreadsheetIdFromElection)).mockReturnValue('spreadsheetId');
      (/** @type {any} */ (VotingService.Auth.getAllTokens)).mockReturnValue([]);
      (/** @type {any} */ (VotingService.getBallot)).mockImplementation(() => {
        throw new Error('Ballot not found');
      });

      const result = Api.handleGetActiveElections({ _authenticatedEmail: 'user@example.com' });

      // Should still succeed but treat ballot as not accepting
      expect(ApiClientManager.successResponse).toHaveBeenCalled();
    });

    test('handles general error', () => {
      (/** @type {any} */ (VotingService.Data.getElectionData)).mockImplementation(() => {
        throw new Error('Database error');
      });

      const result = Api.handleGetActiveElections({ _authenticatedEmail: 'user@example.com' });

      expect(ApiClientManager.errorResponse).toHaveBeenCalledWith(
        'Failed to get elections',
        'GET_ELECTIONS_ERROR'
      );
    });
  });

  // ==================== handleGetElectionStats Tests ====================

  describe('handleGetElectionStats', () => {
    test('returns error when user email not available', () => {
      const result = Api.handleGetElectionStats({});

      expect(ApiClientManager.errorResponse).toHaveBeenCalledWith(
        'User email not available',
        'NO_EMAIL'
      );
    });

    test('returns election stats successfully', () => {
      const elections = [
        TestData.createElection({ Start: '2024-01-01', End: '2024-12-31' })
      ];

      (/** @type {any} */ (VotingService.Data.getElectionData)).mockReturnValue(elections);

      const result = Api.handleGetElectionStats({ _authenticatedEmail: 'user@example.com' });

      expect(ApiClientManager.successResponse).toHaveBeenCalled();
      const successCall = (/** @type {any} */ (ApiClientManager.successResponse)).mock.calls[0][0];
      expect(successCall.stats).toBeDefined();
      expect(successCall.stats.total).toBe(1);
    });

    test('handles error', () => {
      (/** @type {any} */ (VotingService.Data.getElectionData)).mockImplementation(() => {
        throw new Error('Database error');
      });

      const result = Api.handleGetElectionStats({ _authenticatedEmail: 'user@example.com' });

      expect(ApiClientManager.errorResponse).toHaveBeenCalledWith(
        'Failed to get election statistics',
        'GET_STATS_ERROR'
      );
    });
  });

  // ==================== handleGenerateBallotToken Tests ====================

  describe('handleGenerateBallotToken', () => {
    test('returns error when user email not available', () => {
      const result = Api.handleGenerateBallotToken({});

      expect(ApiClientManager.errorResponse).toHaveBeenCalledWith(
        'User email not available',
        'NO_EMAIL'
      );
    });

    test('returns error when election title not provided', () => {
      const result = Api.handleGenerateBallotToken({ _authenticatedEmail: 'user@example.com' });

      expect(ApiClientManager.errorResponse).toHaveBeenCalledWith(
        'Election title is required',
        'MISSING_TITLE'
      );
    });

    test('returns error when election not found', () => {
      (/** @type {any} */ (VotingService.Data.getElectionData)).mockReturnValue([]);

      const result = Api.handleGenerateBallotToken({
        _authenticatedEmail: 'user@example.com',
        electionTitle: 'Nonexistent Election'
      });

      expect(ApiClientManager.errorResponse).toHaveBeenCalledWith(
        'Election not found',
        'ELECTION_NOT_FOUND'
      );
    });

    test('returns error when election has no ballot form', () => {
      const elections = [TestData.createElection({ 'Form Edit URL': '' })];
      (/** @type {any} */ (VotingService.Data.getElectionData)).mockReturnValue(elections);

      const result = Api.handleGenerateBallotToken({
        _authenticatedEmail: 'user@example.com',
        electionTitle: 'Test Election 2024'
      });

      expect(ApiClientManager.errorResponse).toHaveBeenCalledWith(
        'Election has no ballot form',
        'NO_BALLOT_FORM'
      );
    });

    test('returns error when election not active', () => {
      const elections = [
        TestData.createElection({
          Start: '2030-01-01', // Far future start date
          End: '2030-12-31'
        })
      ];
      (/** @type {any} */ (VotingService.Data.getElectionData)).mockReturnValue(elections);

      const result = Api.handleGenerateBallotToken({
        _authenticatedEmail: 'user@example.com',
        electionTitle: 'Test Election 2024'
      });

      expect(ApiClientManager.errorResponse).toHaveBeenCalledWith(
        'Election is not currently active',
        'ELECTION_NOT_ACTIVE'
      );
    });

    test('returns error when user already voted', () => {
      // Make election active by setting dates around current time
      const now = new Date();
      const past = new Date(now.getTime() - 86400000); // 1 day ago
      const future = new Date(now.getTime() + 86400000); // 1 day from now

      const elections = [
        TestData.createElection({
          Start: past.toISOString(),
          End: future.toISOString()
        })
      ];
      (/** @type {any} */ (VotingService.Data.getElectionData)).mockReturnValue(elections);
      (/** @type {any} */ (VotingService.getSpreadsheetIdFromElection)).mockReturnValue('spreadsheetId');
      (/** @type {any} */ (VotingService.Data.hasVotedAlreadyInThisElection)).mockReturnValue(true);

      const result = Api.handleGenerateBallotToken({
        _authenticatedEmail: 'user@example.com',
        electionTitle: 'Test Election 2024'
      });

      expect(ApiClientManager.errorResponse).toHaveBeenCalledWith(
        'You have already voted in this election',
        'ALREADY_VOTED'
      );
    });

    test('returns error when ballot not accepting responses', () => {
      const now = new Date();
      const past = new Date(now.getTime() - 86400000);
      const future = new Date(now.getTime() + 86400000);

      const elections = [
        TestData.createElection({
          Start: past.toISOString(),
          End: future.toISOString()
        })
      ];
      const ballot = TestData.createBallot({
        isPublished: jest.fn(() => true),
        isAcceptingResponses: jest.fn(() => false)
      });

      (/** @type {any} */ (VotingService.Data.getElectionData)).mockReturnValue(elections);
      (/** @type {any} */ (VotingService.getSpreadsheetIdFromElection)).mockReturnValue('spreadsheetId');
      (/** @type {any} */ (VotingService.Data.hasVotedAlreadyInThisElection)).mockReturnValue(false);
      (/** @type {any} */ (VotingService.getBallot)).mockReturnValue(ballot);

      const result = Api.handleGenerateBallotToken({
        _authenticatedEmail: 'user@example.com',
        electionTitle: 'Test Election 2024'
      });

      expect(ApiClientManager.errorResponse).toHaveBeenCalledWith(
        'Ballot is not accepting responses',
        'BALLOT_NOT_ACCEPTING'
      );
    });

    test('generates token successfully', () => {
      const now = new Date();
      const past = new Date(now.getTime() - 86400000);
      const future = new Date(now.getTime() + 86400000);

      const elections = [
        TestData.createElection({
          Start: past.toISOString(),
          End: future.toISOString()
        })
      ];
      const ballot = TestData.createBallot();
      const tokenData = TestData.createTokenData();

      (/** @type {any} */ (VotingService.Data.getElectionData)).mockReturnValue(elections);
      (/** @type {any} */ (VotingService.getSpreadsheetIdFromElection)).mockReturnValue('spreadsheetId');
      (/** @type {any} */ (VotingService.Data.hasVotedAlreadyInThisElection)).mockReturnValue(false);
      (/** @type {any} */ (VotingService.getBallot)).mockReturnValue(ballot);
      (/** @type {any} */ (VotingService.Auth.generateAndStoreToken)).mockReturnValue(tokenData);
      (/** @type {any} */ (VotingService.createPrefilledUrlWithTitle)).mockReturnValue('https://example.com/ballot?token=xxx');

      const result = Api.handleGenerateBallotToken({
        _authenticatedEmail: 'user@example.com',
        electionTitle: 'Test Election 2024'
      });

      expect(ApiClientManager.successResponse).toHaveBeenCalled();
      const successCall = (/** @type {any} */ (ApiClientManager.successResponse)).mock.calls[0][0];
      expect(successCall.ballotUrl).toBe('https://example.com/ballot?token=xxx');
      expect(successCall.electionTitle).toBe('Test Election 2024');
    });

    test('handles general error', () => {
      (/** @type {any} */ (VotingService.Data.getElectionData)).mockImplementation(() => {
        throw new Error('Database error');
      });

      const result = Api.handleGenerateBallotToken({
        _authenticatedEmail: 'user@example.com',
        electionTitle: 'Test Election 2024'
      });

      expect(ApiClientManager.errorResponse).toHaveBeenCalledWith(
        'Failed to generate ballot token',
        'GENERATE_TOKEN_ERROR'
      );
    });
  });
});
