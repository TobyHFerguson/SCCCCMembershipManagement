// @ts-check
/// <reference path="../../types/global.d.ts" />
/// <reference path="./VotingService.d.ts" />

/**
 * VotingService.Manager - Pure business logic for voting operations
 *
 * This module contains all business logic for managing elections and voting.
 * It is fully testable with Jest as it has no GAS dependencies.
 *
 * Architecture follows GAS Layer Separation pattern:
 * - Manager: Pure logic (testable)
 * - GAS layer (WebApp.js, Api.js): Orchestration and GAS API calls
 *
 * @namespace VotingService.Manager
 */

// Namespace declaration pattern (works in both GAS and Jest)
// @ts-ignore - Initializing namespace before adding properties
if (typeof VotingService === 'undefined') VotingService = {};

/**
 * @typedef {Object} ValidationResult
 * @property {boolean} valid - Whether validation passed
 * @property {string} [error] - Error message if validation failed
 * @property {string} [errorCode] - Machine-readable error code
 */

/**
 * @typedef {Object} ProcessedElection
 * @property {string} title - Election title
 * @property {Date} [opens] - When election opens
 * @property {Date} [closes] - When election closes
 * @property {string} status - Status message for display
 * @property {string} [url] - Ballot URL (only if active and user can vote)
 */

/**
 * @typedef {Object} TokenValidationResult
 * @property {boolean} valid - Whether token is valid
 * @property {string} [email] - Email from token if valid
 * @property {string} [error] - Error message if invalid
 * @property {string} [errorCode] - Machine-readable error code
 */

/**
 * @typedef {Object} VoteValidationResult
 * @property {boolean} valid - Whether vote is valid
 * @property {string} [email] - Voter email if valid
 * @property {string} [error] - Error message if invalid
 * @property {string} [errorCode] - Machine-readable error code
 * @property {boolean} [duplicate] - Whether this is a duplicate vote
 * @property {boolean} [tokenInvalid] - Whether token is invalid
 */

/**
 * @typedef {Object} ElectionStats
 * @property {number} total - Total elections
 * @property {number} active - Active elections
 * @property {number} unopened - Unopened elections
 * @property {number} closed - Closed elections
 */

/**
 * VotingService.Manager - Pure logic class for voting operations
 * All business logic is here and is fully testable with Jest.
 *
 * @class
 */
VotingService.Manager = class {
  /**
   * Get the constants for election states
   * @returns {{UNOPENED: string, ACTIVE: string, CLOSED: string}}
   */
  static getElectionStates() {
    return {
      UNOPENED: 'UNOPENED',
      ACTIVE: 'ACTIVE',
      CLOSED: 'CLOSED'
    };
  }

  /**
   * Calculate election state based on dates
   * @param {Date|string|null|undefined} startDate - Election start date
   * @param {Date|string|null|undefined} endDate - Election end date
   * @param {Date} [now] - Current time (for testing)
   * @returns {string} Election state: UNOPENED, ACTIVE, or CLOSED
   */
  static calculateElectionState(startDate, endDate, now = new Date()) {
    const states = this.getElectionStates();

    // If no dates, consider unopened
    if (!startDate || !endDate) {
      return states.UNOPENED;
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    // Check for invalid dates
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return states.UNOPENED;
    }

    if (start <= now && now <= end) {
      return states.ACTIVE;
    }

    if (end < now) {
      return states.CLOSED;
    }

    return states.UNOPENED;
  }

  /**
   * Validate email format
   * @param {string} email - Email to validate
   * @returns {ValidationResult}
   */
  static validateEmail(email) {
    if (!email || typeof email !== 'string') {
      return { valid: false, error: 'Email must be a non-empty string', errorCode: 'INVALID_EMAIL' };
    }
    const trimmed = email.trim();
    if (trimmed.length === 0) {
      return { valid: false, error: 'Email cannot be empty', errorCode: 'EMPTY_EMAIL' };
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmed)) {
      return { valid: false, error: 'Invalid email format', errorCode: 'INVALID_EMAIL_FORMAT' };
    }
    return { valid: true };
  }

  /**
   * Normalize an email address
   * @param {string} email - Email to normalize
   * @returns {string} Normalized email (lowercase, trimmed)
   */
  static normalizeEmail(email) {
    if (!email || typeof email !== 'string') {
      return '';
    }
    return email.trim().toLowerCase();
  }

  /**
   * Check if user has already voted in an election
   * @param {string} userEmail - User's email address
   * @param {Array<{Email: string}>} voters - List of voters with email property
   * @returns {boolean} True if user has voted
   */
  static hasUserVoted(userEmail, voters) {
    if (!userEmail || !Array.isArray(voters)) {
      return false;
    }
    const normalizedEmail = this.normalizeEmail(userEmail);
    return voters.some(voter => this.normalizeEmail(voter.Email) === normalizedEmail);
  }

  /**
   * Validate election data
   * @param {{Title?: string}} election - Election object with at minimum a Title property
   * @returns {ValidationResult}
   */
  static validateElection(election) {
    if (!election) {
      return { valid: false, error: 'Election data is required', errorCode: 'MISSING_ELECTION' };
    }

    if (!election.Title || typeof election.Title !== 'string') {
      return { valid: false, error: 'Election title is required', errorCode: 'MISSING_TITLE' };
    }

    return { valid: true };
  }

  /**
   * Validate token format
   * @param {string} token - Token to validate
   * @returns {ValidationResult}
   */
  static validateToken(token) {
    if (!token || typeof token !== 'string') {
      return { valid: false, error: 'Token is required', errorCode: 'MISSING_TOKEN' };
    }
    const trimmed = token.trim();
    if (trimmed.length === 0) {
      return { valid: false, error: 'Token cannot be empty', errorCode: 'EMPTY_TOKEN' };
    }
    // UUID format validation (basic)
    if (trimmed.length < 10) {
      return { valid: false, error: 'Invalid token format', errorCode: 'INVALID_TOKEN_FORMAT' };
    }
    return { valid: true };
  }

  /**
   * Validate token data for vote processing
   * @param {Object|null} tokenData - Token data from storage
   * @returns {TokenValidationResult}
   */
  static validateTokenData(tokenData) {
    if (!tokenData) {
      return {
        valid: false,
        error: 'Token not found',
        errorCode: 'TOKEN_NOT_FOUND'
      };
    }

    if (!tokenData.Email) {
      return {
        valid: false,
        error: 'Token has no associated email',
        errorCode: 'TOKEN_NO_EMAIL'
      };
    }

    if (tokenData.Used) {
      return {
        valid: false,
        error: 'Token has already been used',
        errorCode: 'TOKEN_ALREADY_USED',
        email: tokenData.Email
      };
    }

    return {
      valid: true,
      email: tokenData.Email
    };
  }

  /**
   * Check for duplicate votes
   * @param {string} email - Voter's email
   * @param {string} currentToken - Current token being used
   * @param {Array<{Email: string, Token: string}>} allTokens - All tokens for this election
   * @returns {boolean} True if this is a duplicate vote
   */
  static isDuplicateVote(email, currentToken, allTokens) {
    if (!email || !currentToken || !Array.isArray(allTokens)) {
      return false;
    }
    const normalizedEmail = this.normalizeEmail(email);
    return allTokens.some(
      t => t.Token !== currentToken && this.normalizeEmail(t.Email) === normalizedEmail
    );
  }

  /**
   * Validate a vote submission
   * @param {Object|null} tokenData - Token data from storage
   * @param {string} currentToken - The token being used
   * @param {Array<{Email: string, Token: string}>} allTokens - All tokens for this election
   * @returns {VoteValidationResult}
   */
  static validateVote(tokenData, currentToken, allTokens) {
    // First validate token data
    const tokenValidation = this.validateTokenData(tokenData);

    if (!tokenValidation.valid) {
      return {
        valid: false,
        error: tokenValidation.error,
        errorCode: tokenValidation.errorCode,
        tokenInvalid: true,
        email: tokenValidation.email
      };
    }

    const email = tokenValidation.email;

    // Check for duplicate votes
    if (this.isDuplicateVote(email, currentToken, allTokens)) {
      return {
        valid: false,
        error: 'Duplicate vote detected',
        errorCode: 'DUPLICATE_VOTE',
        duplicate: true,
        email: email
      };
    }

    return {
      valid: true,
      email: email
    };
  }

  /**
   * Build status message for election based on state
   * @param {string} state - Election state
   * @param {boolean} hasVoted - Whether user has already voted
   * @param {boolean} [ballotAccepting] - Whether ballot is accepting responses
   * @returns {string} Status message
   */
  static buildElectionStatusMessage(state, hasVoted, ballotAccepting = true) {
    if (hasVoted) {
      return "Inactive - you've already voted";
    }

    const states = this.getElectionStates();

    switch (state) {
      case states.UNOPENED:
        return 'Inactive - election not open yet';
      case states.CLOSED:
        return 'Inactive - election has closed';
      case states.ACTIVE:
        if (!ballotAccepting) {
          return 'Inactive - ballot is not accepting responses';
        }
        return 'Active';
      default:
        return 'Inactive - unknown status';
    }
  }

  /**
   * Process election data for display
   * @param {{Title: string, Start?: string, End?: string, 'Form Edit URL'?: string}} election - Raw election data from spreadsheet
   * @param {string} userEmail - Current user's email
   * @param {Array<{Email: string}>} voters - Voters who have voted
   * @param {boolean} [ballotPublished] - Whether ballot is published
   * @param {boolean} [ballotAccepting] - Whether ballot is accepting responses
   * @param {Date} [now] - Current time (for testing)
   * @returns {ProcessedElection}
   */
  static processElectionForDisplay(
    election,
    userEmail,
    voters,
    ballotPublished = true,
    ballotAccepting = true,
    now = new Date()
  ) {
    /** @type {ProcessedElection} */
    const result = {
      title: election.Title || 'Untitled Election',
      status: 'Inactive - unknown status'
    };

    // Parse dates
    if (election.Start) {
      result.opens = new Date(election.Start);
    }
    if (election.End) {
      result.closes = new Date(election.End);
    }

    // Check if user has voted
    const hasVoted = this.hasUserVoted(userEmail, voters);

    // Get election state
    const state = this.calculateElectionState(election.Start, election.End, now);

    // Build status message
    const ballotActive = ballotPublished && ballotAccepting;
    result.status = this.buildElectionStatusMessage(state, hasVoted, ballotActive);

    return result;
  }

  /**
   * Extract first values from form response named values
   * (Form responses come as arrays, we need the first element)
   * @param {Record<string, any[]|any>} namedValues - Form response named values
   * @returns {Record<string, any>} Object with first values
   */
  static extractFirstValues(namedValues) {
    if (!namedValues || typeof namedValues !== 'object') {
      return {};
    }
    const result = {};
    for (const key in namedValues) {
      if (Object.prototype.hasOwnProperty.call(namedValues, key)) {
        if (Array.isArray(namedValues[key])) {
          result[key] = namedValues[key][0];
        } else {
          result[key] = namedValues[key];
        }
      }
    }
    return result;
  }

  /**
   * Extract election title from spreadsheet name
   * @param {string} spreadsheetName - Name of the results spreadsheet
   * @param {string} [resultsSuffix] - Suffix to remove (default: ' - Results')
   * @returns {string} Election title
   */
  static extractElectionTitle(spreadsheetName, resultsSuffix = ' - Results') {
    if (!spreadsheetName || typeof spreadsheetName !== 'string') {
      return '';
    }
    if (spreadsheetName.endsWith(resultsSuffix)) {
      return spreadsheetName.slice(0, -resultsSuffix.length).trim();
    }
    return spreadsheetName;
  }

  /**
   * Build valid vote email content
   * @param {string} electionTitle - Election title
   * @returns {{subject: string, body: string}}
   */
  static buildValidVoteEmailContent(electionTitle) {
    return {
      subject: `SCCCC Election '${electionTitle}' - Vote is valid`,
      body: `Your vote in the SCCCC election '${electionTitle}' has been successfully recorded and handled as a valid vote. Thank you for participating!`
    };
  }

  /**
   * Build invalid vote email content
   * @param {string} electionTitle - Election title
   * @returns {{subject: string, body: string}}
   */
  static buildInvalidVoteEmailContent(electionTitle) {
    return {
      subject: `SCCCC Election '${electionTitle}' - Vote invalid`,
      body: `Your vote in the SCCCC election '${electionTitle}' was invalid (it either didn't have the necessary security token or was a duplicate vote). To ensure the integrity of the election process we will conduct a manual count, rejecting that vote. Thank you for your understanding!`
    };
  }

  /**
   * Build manual count needed email content
   * @param {string} electionTitle - Election title
   * @param {Record<string, any>} vote - The invalid vote data from form submission
   * @param {string} tokenFieldName - Name of the token field
   * @returns {{subject: string, body: string}}
   */
  static buildManualCountEmailContent(electionTitle, vote, tokenFieldName = 'VOTING TOKEN') {
    const hasToken = vote && vote[tokenFieldName];
    const reason = hasToken ? 'is a duplicate' : 'has no token';
    return {
      subject: `Election '${electionTitle}' - manual count needed`,
      body: `In election ${electionTitle} this vote ${reason} ${JSON.stringify(vote)}. A manual count will now be needed`
    };
  }

  /**
   * Build election opening email content
   * @param {string} ballotTitle - Ballot title
   * @param {string} editUrl - Form edit URL
   * @returns {{subject: string, body: string}}
   */
  static buildElectionOpeningEmailContent(ballotTitle, editUrl) {
    return {
      subject: `Election '${ballotTitle}' is now open`,
      body: `The ${ballotTitle} election is now open and accepting responses. You can view the form at: ${editUrl}`
    };
  }

  /**
   * Build election closure email content
   * @param {string} ballotTitle - Ballot title
   * @param {string} editUrl - Form edit URL
   * @param {boolean} manualCountRequired - Whether manual counting is needed
   * @returns {{subject: string, body: string}}
   */
  static buildElectionClosureEmailContent(ballotTitle, editUrl, manualCountRequired = false) {
    if (manualCountRequired) {
      return {
        subject: `Election '${ballotTitle}' has closed - Manual Counting Required`,
        body: `The ${ballotTitle} election has now closed. The form is no longer accepting responses. The results sheet contains invalid votes that must be manually counted. You can view the form at: ${editUrl}`
      };
    }
    return {
      subject: `Election '${ballotTitle}' has closed`,
      body: `The ${ballotTitle} election has now closed. The form is no longer accepting responses. All votes are valid and you can use the Form Response graph as the results. You can view the form at: ${editUrl}`
    };
  }

  /**
   * Build election officer added email content
   * @param {string} title - Form title
   * @param {string} editUrl - Form edit URL
   * @param {boolean} [isSharedDrive] - Whether files are in shared drive
   * @returns {{subject: string, body: string}}
   */
  static buildElectionOfficerAddedEmailContent(title, editUrl, isSharedDrive = false) {
    const baseMessage = `You are now an Election Officer and have edit access to the Form '${title}' and its result sheet. It can be found at: ${editUrl}`;
    const sharedDriveNote = isSharedDrive
      ? `\n\nNote: These files are located in a Shared Drive. If you cannot edit them, please contact your Shared Drive administrator to ensure you have the appropriate permissions.`
      : '';

    return {
      subject: `Form '${title}' shared with you`,
      body: baseMessage + sharedDriveNote
    };
  }

  /**
   * Build election officer removed email content
   * @param {string} title - Form title
   * @param {boolean} [isSharedDrive] - Whether files are in shared drive
   * @returns {{subject: string, body: string}}
   */
  static buildElectionOfficerRemovedEmailContent(title, isSharedDrive = false) {
    const baseMessage = `You are no longer an Election Officer and your edit access to the Form '${title}' and its result sheet has been removed`;
    const sharedDriveNote = isSharedDrive
      ? `\n\nNote: These files are located in a Shared Drive. Access may also be controlled at the Shared Drive level.`
      : '';

    return {
      subject: `Document access removed`,
      body: baseMessage + sharedDriveNote
    };
  }

  /**
   * Calculate election statistics
   * @param {Array<Object>} elections - Array of elections
   * @param {Date} [now] - Current time (for testing)
   * @returns {ElectionStats}
   */
  static calculateElectionStats(elections, now = new Date()) {
    const stats = {
      total: 0,
      active: 0,
      unopened: 0,
      closed: 0
    };

    if (!Array.isArray(elections)) {
      return stats;
    }

    stats.total = elections.length;
    const states = this.getElectionStates();

    for (const election of elections) {
      const state = this.calculateElectionState(election.Start, election.End, now);
      switch (state) {
        case states.ACTIVE:
          stats.active++;
          break;
        case states.UNOPENED:
          stats.unopened++;
          break;
        case states.CLOSED:
          stats.closed++;
          break;
      }
    }

    return stats;
  }

  /**
   * Format API response for active elections
   * @param {ProcessedElection[]} elections - Processed elections
   * @param {string} userEmail - User's email
   * @returns {{elections: ProcessedElection[], userEmail: string, count: number}}
   */
  static formatActiveElectionsResponse(elections, userEmail) {
    return {
      elections: elections,
      userEmail: userEmail,
      count: elections.length
    };
  }

  /**
   * Determine which election officers to add/remove
   * @param {string[]} newOfficers - New list of officer emails
   * @param {string[]} currentOfficers - Current list of officer emails
   * @returns {{toAdd: string[], toRemove: string[]}}
   */
  static calculateOfficerChanges(newOfficers, currentOfficers) {
    const normalizeAndFilter = (arr) =>
      (arr || [])
        .filter(e => e && typeof e === 'string')
        .map(e => this.normalizeEmail(e))
        .filter(e => e.length > 0);

    /** @type {Set<string>} */
    const newSet = new Set(normalizeAndFilter(newOfficers));
    /** @type {Set<string>} */
    const currentSet = new Set(normalizeAndFilter(currentOfficers));

    // Use Array.from() for TypeScript compatibility (GAS V8 supports Set spread, but TS target is ES5)
    const toAdd = Array.from(newSet).filter(e => !currentSet.has(e));
    const toRemove = Array.from(currentSet).filter(e => !newSet.has(e));

    return { toAdd, toRemove };
  }

  /**
   * Parse election officers string into array
   * @param {string} officersString - Comma-separated email string
   * @returns {string[]} Array of email addresses
   */
  static parseElectionOfficers(officersString) {
    if (!officersString || typeof officersString !== 'string') {
      return [];
    }
    return officersString
      .split(',')
      .map(e => e.trim())
      .filter(e => e.length > 0);
  }
};

// Node.js export for testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    Manager: VotingService.Manager
  };
}
