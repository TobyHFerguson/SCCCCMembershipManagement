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
if (typeof VotingService === 'undefined') VotingService = {};

VotingService.Api = VotingService.Api || {};

/**
 * Get initial data for rendering VotingService
 * Called by getServiceContent() for SPA initial page load
 * 
 * @param {string} email - Authenticated user email
 * @returns {{serviceName: string, elections: Array}} Service data
 */
VotingService.Api.getData = function(email) {
  console.log('VotingService.Api.getData(', email, ')');
  
  // Get processed elections (already filtered and formatted for display)
  // This reuses the existing WebApp logic
  const elections = VotingService.WebApp._getElectionsForTemplate(email);
  
  return {
    serviceName: 'Voting',
    elections: elections
  };
};

/**
 * Initialize API handlers for VotingService
 * This should be called once during application startup
 */
VotingService.initApi = function () {
  // Register getActiveElections handler
  Common.Api.Client.registerHandler(
    'voting.getActiveElections',
    VotingService.Api.handleGetActiveElections,
    {
      requiresAuth: true,
      description: 'Get list of active elections for current user'
    }
  );

  // Register getElectionStats handler
  Common.Api.Client.registerHandler(
    'voting.getElectionStats',
    VotingService.Api.handleGetElectionStats,
    {
      requiresAuth: true,
      description: 'Get election statistics'
    }
  );

  // Register generateBallotToken handler
  Common.Api.Client.registerHandler(
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
 * @param {Object} params - Request parameters
 * @param {string} params._authenticatedEmail - Authenticated user's email
 * @returns {Common.Api.ApiResponse}
 */
VotingService.Api.handleGetActiveElections = function (params) {
    const userEmail = params._authenticatedEmail;

    // Validate user email is available
    if (!userEmail) {
      return Common.Api.ClientManager.errorResponse('User email not available', 'NO_EMAIL');
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
      return Common.Api.ClientManager.successResponse(response);
    } catch (error) {
      Logger.log('[VotingService.Api] handleGetActiveElections error: ' + error);
      return Common.Api.ClientManager.errorResponse('Failed to get elections', 'GET_ELECTIONS_ERROR');
    }
  };

/**
 * Handle getElectionStats API request
 * Returns statistics about elections
 *
 * @param {Object} params - Request parameters
 * @param {string} params._authenticatedEmail - Authenticated user's email
 * @returns {Common.Api.ApiResponse}
 */
VotingService.Api.handleGetElectionStats = function (params) {
    const userEmail = params._authenticatedEmail;

    // Validate user email is available
    if (!userEmail) {
      return Common.Api.ClientManager.errorResponse('User email not available', 'NO_EMAIL');
    }

    try {
      // GAS: Get election data from sheet
      const elections = VotingService.Data.getElectionData();

      // PURE: Calculate stats
      const stats = VotingService.Manager.calculateElectionStats(elections);

      Logger.log('[VotingService.Api] Retrieved election stats for: ' + userEmail);

      return Common.Api.ClientManager.successResponse({
        stats: stats
      });
    } catch (error) {
      Logger.log('[VotingService.Api] handleGetElectionStats error: ' + error);
      return Common.Api.ClientManager.errorResponse(
        'Failed to get election statistics',
        'GET_STATS_ERROR'
      );
    }
  };

/**
 * Handle generateBallotToken API request
 * Generates a voting token for a specific ballot
 *
 * @param {Object} params - Request parameters
 * @param {string} params._authenticatedEmail - Authenticated user's email
 * @param {string} params.electionTitle - Title of the election
 * @returns {Common.Api.ApiResponse}
 */
VotingService.Api.handleGenerateBallotToken = function (params) {
    const userEmail = params._authenticatedEmail;
    const electionTitle = params.electionTitle;

    // Validate inputs
    if (!userEmail) {
      return Common.Api.ClientManager.errorResponse('User email not available', 'NO_EMAIL');
    }

    if (!electionTitle) {
      return Common.Api.ClientManager.errorResponse('Election title is required', 'MISSING_TITLE');
    }

    try {
      // GAS: Get election data from sheet
      const elections = VotingService.Data.getElectionData();

      // Find the election by title
      const election = elections.find(e => e.Title === electionTitle);

      if (!election) {
        return Common.Api.ClientManager.errorResponse('Election not found', 'ELECTION_NOT_FOUND');
      }

      const formEditUrl = election[VotingService.Constants.FORM_EDIT_URL_COLUMN_NAME];
      if (!formEditUrl) {
        return Common.Api.ClientManager.errorResponse(
          'Election has no ballot form',
          'NO_BALLOT_FORM'
        );
      }

      // PURE: Check election state
      const state = VotingService.Manager.calculateElectionState(election.Start, election.End);
      const states = VotingService.Manager.getElectionStates();

      if (state !== states.ACTIVE) {
        return Common.Api.ClientManager.errorResponse(
          'Election is not currently active',
          'ELECTION_NOT_ACTIVE'
        );
      }

      // GAS: Check if user already voted
      const spreadsheetId = VotingService.getSpreadsheetIdFromElection(election);
      const hasVoted = VotingService.Data.hasVotedAlreadyInThisElection(userEmail, election);

      if (hasVoted) {
        return Common.Api.ClientManager.errorResponse(
          'You have already voted in this election',
          'ALREADY_VOTED'
        );
      }

      // GAS: Check ballot is accepting responses
      const ballot = VotingService.getBallot(formEditUrl);
      if (!ballot.isPublished() || !ballot.isAcceptingResponses()) {
        return Common.Api.ClientManager.errorResponse(
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

      return Common.Api.ClientManager.successResponse({
        ballotUrl: preFilledUrl,
        electionTitle: electionTitle
      });
    } catch (error) {
      Logger.log('[VotingService.Api] handleGenerateBallotToken error: ' + error);
      return Common.Api.ClientManager.errorResponse(
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
