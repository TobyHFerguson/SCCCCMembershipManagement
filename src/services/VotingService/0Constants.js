// @ts-check
/**
 * Shared constants for the VotingService
 * This file contains all constants used across VotingService files to maintain DRY principles
 * and ensure consistency when deploying with clasp.
 */

// Column names for Elections sheet
const VOTE_TITLE_COLUMN_NAME = 'Title';
const FORM_EDIT_URL_COLUMN_NAME = 'Form Edit URL';
const ELECTION_OFFICERS_COLUMN_NAME = 'Election Officers';
const TRIGGER_ID_COLUMN_NAME = 'TriggerId';

// Sheet and folder names
const REGISTRATION_SHEET_NAME = 'Elections';
const RESULTS_SUFFIX = '- Results';
const INVALID_RESULTS_SHEET_NAME = 'Invalid Results';

// Form field names and messages
const TOKEN_ENTRY_FIELD_TITLE = 'VOTING TOKEN';
const TOKEN_HELP_TEXT = 'This question is used to validate your vote. Do not modify this field.';
const CONFIRMATION_MESSAGE = 'Your vote has been recorded successfully. You will be sent an email indicating how your vote was handled. Thank you for participating!';

// ElectionState enum equivalent for JavaScript
/** @type {{UNOPENED: VotingService.ElectionState, ACTIVE: VotingService.ElectionState, CLOSED: VotingService.ElectionState}} */
const ElectionState = {
    UNOPENED: 'UNOPENED',
    ACTIVE: 'ACTIVE',
    CLOSED: 'CLOSED'
};

// Export constants for use in other VotingService files
if (typeof VotingService === 'undefined') {
    // @ts-ignore
    var VotingService = {};
}

// @ts-ignore - Override the read-only property for deployment
VotingService.Constants = {
    VOTE_TITLE_COLUMN_NAME,
    FORM_EDIT_URL_COLUMN_NAME,
    ELECTION_OFFICERS_COLUMN_NAME,
    TRIGGER_ID_COLUMN_NAME,
    REGISTRATION_SHEET_NAME,
    RESULTS_SUFFIX,
    INVALID_RESULTS_SHEET_NAME,
    TOKEN_ENTRY_FIELD_TITLE,
    TOKEN_HELP_TEXT,
    CONFIRMATION_MESSAGE,
    ElectionState
};