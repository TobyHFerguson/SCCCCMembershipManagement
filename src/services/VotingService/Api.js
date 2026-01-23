// @ts-check
/// <reference path="../../types/global.d.ts" />
/// <reference path="./VotingService.d.ts" />

/**
 * VotingService.Api - GAS layer for voting API
 *
 * This module provides the API endpoints for the VotingService SPA.
 * It handles GAS API calls and orchestrates the Manager business logic.
 *
 * Architecture follows GAS Layer Separation pattern:
 * - Api: GAS layer (orchestration, GAS API calls)
 * - Manager: Pure logic (testable)
 *
 * @namespace VotingService.Api
 */

// Namespace declaration pattern (works in both GAS and Jest)
// @ts-ignore - Initializing namespace before adding properties
if (typeof VotingService === 'undefined') VotingService = {};

VotingService.Api = VotingService.Api || {};

/**
 * Get initial data for rendering VotingService
 * Called by getServiceContent() for SPA initial page load
 * 
 * CRITICAL: Date objects converted to ISO strings via _getElectionsForTemplate
 * (opens/closes fields are ISO strings, safe for google.script.run serialization)
 * 
 * LOGGING: Logs detailed execution flow to System Logs for debugging
 * Note: Service access is logged by getServiceContent() wrapper in webapp_endpoints.js
 * 
 * @param {string} email - Authenticated user email
 * @returns {{serviceName: string, elections: Array<VotingService.ProcessedElection>, error?: string}} Service data
 */
VotingService.Api.getData = function(email) {
  AppLogger.info('VotingService', `getData() started for user: ${email}`);
  
  try {
    // Get processed elections (already filtered and formatted for display)
    // This reuses the existing WebApp logic which converts Date to ISO strings
    AppLogger.debug('VotingService', 'Fetching elections for template');
    const elections = VotingService.WebApp._getElectionsForTemplate(email);
    
    AppLogger.info('VotingService', `getData() completed successfully for user: ${email}`, {
      electionCount: elections ? elections.length : 0
    });
    
    return {
      serviceName: 'Voting',
      elections: elections
    };
  } catch (error) {
    AppLogger.error('VotingService', `getData() failed for user: ${email}`, error);
    return {
      serviceName: 'Voting',
      error: `Failed to load elections: ${error.message}`,
      elections: []
    };
  }
};

/**
 * Initialize API handlers for VotingService
 * This should be called once during application startup
 */
VotingService.initApi = function () {
  // Register getActiveElections handler
  ApiClient.registerHandler(
    'voting.getActiveElections',
    VotingService.Api.handleGetActiveElections,
    {
      requiresAuth: true,
      description: 'Get list of active elections for current user'
    }
  );

  // Register getElectionStats handler
  ApiClient.registerHandler(
    'voting.getElectionStats',
    VotingService.Api.handleGetElectionStats,
    {
      requiresAuth: true,
      description: 'Get election statistics'
    }
  );

  // Register generateBallotToken handler
  ApiClient.registerHandler(
    'voting.generateBallotToken',
    VotingService.Api.handleGenerateBallotToken,
    {
      requiresAuth: true,
      description: 'Generate a voting token for a specific ballot'
    }
  );
};

/**
 * VotingService.Api - API handlers and GAS orchestration
 */

/**
 * Handle getActiveElections API request
 * Returns list of elections with status for current user
 *
 * @param {{_authenticatedEmail: string}} params - Request parameters
 * @returns {ApiResponse}
 */
VotingService.Api.handleGetActiveElections = function (params) {
    const userEmail = params._authenticatedEmail;

    // Validate user email is available
    if (!userEmail) {
      return ApiClientManager.errorResponse('User email not available', 'NO_EMAIL');
    }

    try {
      // GAS: Get election data from sheet
      const elections = VotingService.Data.getElectionData();

      // Process each election
      const processedElections = [];

      for (const election of elections) {
        try {
          const formEditUrl = election[VotingService.Constants.FORM_EDIT_URL_COLUMN_NAME];

          // Skip elections without form URLs
          if (!formEditUrl) {
            continue;
          }

          // GAS: Get voters for this election
          let voters = [];
          try {
            const spreadsheetId = VotingService.getSpreadsheetIdFromElection(election);
            const tokenData = VotingService.Auth.getAllTokens(spreadsheetId);
            voters = tokenData;
          } catch (e) {
            // If we can't get voters, treat as empty
            Logger.log('[VotingService.Api] Could not get voters for election: ' + e);
          }

          // GAS: Check ballot status
          let ballotPublished = false;
          let ballotAccepting = false;
          try {
            const ballot = VotingService.getBallot(formEditUrl);
            ballotPublished = ballot.isPublished();
            ballotAccepting = ballot.isAcceptingResponses();
          } catch (e) {
            Logger.log('[VotingService.Api] Could not get ballot status: ' + e);
          }

          // PURE: Process election for display
          const processed = VotingService.Manager.processElectionForDisplay(
            election,
            userEmail,
            voters,
            ballotPublished,
            ballotAccepting
          );

          processedElections.push(processed);
        } catch (electionError) {
          Logger.log(
            '[VotingService.Api] Error processing election ' + election.Title + ': ' + electionError
          );
        }
      }

      Logger.log(
        '[VotingService.Api] Retrieved ' +
          processedElections.length +
          ' elections for: ' +
          userEmail
      );

      // PURE: Format response
      const response = VotingService.Manager.formatActiveElectionsResponse(
        processedElections,
        userEmail
      );
      return ApiClientManager.successResponse(response);
    } catch (error) {
      Logger.log('[VotingService.Api] handleGetActiveElections error: ' + error);
      return ApiClientManager.errorResponse('Failed to get elections', 'GET_ELECTIONS_ERROR');
    }
  };

/**
 * Handle getElectionStats API request
 * Returns statistics about elections
 *
 * @param {{_authenticatedEmail: string}} params - Request parameters
 * @returns {ApiResponse}
 */
VotingService.Api.handleGetElectionStats = function (params) {
    const userEmail = params._authenticatedEmail;

    // Validate user email is available
    if (!userEmail) {
      return ApiClientManager.errorResponse('User email not available', 'NO_EMAIL');
    }

    try {
      // GAS: Get election data from sheet
      const elections = VotingService.Data.getElectionData();

      // PURE: Calculate stats
      const stats = VotingService.Manager.calculateElectionStats(elections);

      Logger.log('[VotingService.Api] Retrieved election stats for: ' + userEmail);

      return ApiClientManager.successResponse({
        stats: stats
      });
    } catch (error) {
      Logger.log('[VotingService.Api] handleGetElectionStats error: ' + error);
      return ApiClientManager.errorResponse(
        'Failed to get election statistics',
        'GET_STATS_ERROR'
      );
    }
  };

/**
 * Handle generateBallotToken API request
 * Generates a voting token for a specific ballot
 *
 * @param {{_authenticatedEmail: string, electionTitle: string}} params - Request parameters
 * @returns {ApiResponse}
 */
VotingService.Api.handleGenerateBallotToken = function (params) {
    const userEmail = params._authenticatedEmail;
    const electionTitle = params.electionTitle;

    // Validate inputs
    if (!userEmail) {
      return ApiClientManager.errorResponse('User email not available', 'NO_EMAIL');
    }

    if (!electionTitle) {
      return ApiClientManager.errorResponse('Election title is required', 'MISSING_TITLE');
    }

    try {
      // GAS: Get election data from sheet
      const elections = VotingService.Data.getElectionData();

      // Find the election by title
      const election = elections.find(e => e.Title === electionTitle);

      if (!election) {
        return ApiClientManager.errorResponse('Election not found', 'ELECTION_NOT_FOUND');
      }

      const formEditUrl = election[VotingService.Constants.FORM_EDIT_URL_COLUMN_NAME];
      if (!formEditUrl) {
        return ApiClientManager.errorResponse(
          'Election has no ballot form',
          'NO_BALLOT_FORM'
        );
      }

      // PURE: Check election state
      const state = VotingService.Manager.calculateElectionState(election.Start, election.End);
      const states = VotingService.Manager.getElectionStates();

      if (state !== states.ACTIVE) {
        return ApiClientManager.errorResponse(
          'Election is not currently active',
          'ELECTION_NOT_ACTIVE'
        );
      }

      // GAS: Check if user already voted
      const spreadsheetId = VotingService.getSpreadsheetIdFromElection(election);
      const hasVoted = VotingService.Data.hasVotedAlreadyInThisElection(userEmail, election);

      if (hasVoted) {
        return ApiClientManager.errorResponse(
          'You have already voted in this election',
          'ALREADY_VOTED'
        );
      }

      // GAS: Check ballot is accepting responses
      const ballot = VotingService.getBallot(formEditUrl);
      if (!ballot.isPublished() || !ballot.isAcceptingResponses()) {
        return ApiClientManager.errorResponse(
          'Ballot is not accepting responses',
          'BALLOT_NOT_ACCEPTING'
        );
      }

      // GAS: Generate token and pre-filled URL
      const tokenData = VotingService.Auth.generateAndStoreToken(userEmail, spreadsheetId);
      const preFilledUrl = VotingService.createPrefilledUrlWithTitle(
        formEditUrl,
        VotingService.Constants.TOKEN_ENTRY_FIELD_TITLE,
        tokenData.Token
      );

      Logger.log(
        '[VotingService.Api] Generated ballot token for user: ' +
          userEmail +
          ' election: ' +
          electionTitle
      );

      return ApiClientManager.successResponse({
        ballotUrl: preFilledUrl,
        electionTitle: electionTitle
      });
    } catch (error) {
      Logger.log('[VotingService.Api] handleGenerateBallotToken error: ' + error);
      return ApiClientManager.errorResponse(
        'Failed to generate ballot token',
        'GENERATE_TOKEN_ERROR'
      );
    }
  };

// Node.js export for testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    Api: VotingService.Api,
    initApi: VotingService.initApi
  };
}
