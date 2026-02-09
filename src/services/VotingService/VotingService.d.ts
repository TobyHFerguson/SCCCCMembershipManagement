/// <reference path="../../types/global.d.ts" />

/**
 * VotingService namespace for election and ballot management.
*/
declare namespace VotingService {
    /**
     * Creates a published copy of a Google Form in the given folder with Shared Drive detection.
     * @param {string} formId
     * @param {string} destinationFolderId
     * @returns {{url: string, isSharedDrive: boolean, sourceTitle: string}} Object containing the edit URL, Shared Drive status, and source form title.
     */
    function makePublishedCopyOfFormInFolder_(formId: string, destinationFolderId: string): {url: string, isSharedDrive: boolean, sourceTitle: string};

    /**
     * Sets the editors for the ballot and its results spreadsheet.
     * @param {string} editUrl
     * @param {string[]} electionOfficers
     * @param {boolean} [isSharedDrive=false]
     */
    function setElectionOfficers(editUrl: string, electionOfficers?: string[], isSharedDrive?: boolean): void;

    /**
     * Sends an email to an added election officer.
     * @param {string} email
     * @param {string} title
     * @param {string} url
     * @param {boolean} [isSharedDrive=false]
     */
    function sendElectionOfficerAddEmail_(email: string, title: string, url: string, isSharedDrive?: boolean): void;

    /**
     * Sends an email to a removed election officer.
     * @param {string} email
     * @param {string} title
     * @param {boolean} [isSharedDrive=false]
     */
    function sendElectionOfficerRemoveEmail_(email: string, title: string, isSharedDrive?: boolean): void;

    /**
     * Represents the state of an election as a string literal type - matches the ElectionState object values in JavaScript
     */
    type ElectionState = 'UNOPENED' | 'ACTIVE' | 'CLOSED';

    /**
     * Represents an election object.
     * @deprecated Use ValidatedElection class instead for type safety and validation
     */
    interface Election {
        Title: string;
        'Form Edit URL': string;
        'Election Officers': string; // Comma-separated emails
        Start?: string | Date;
        End?: string | Date;
        TriggerId?: string;
        [key: string]: any; // Allow string indexing for column names
    }

    /**
     * Type alias for a ballot form (now using the augmented GoogleAppsScript.Forms.Form)
     */
    type Ballot = GoogleAppsScript.Forms.Form;

    /**
     * Shared constants for the VotingService
     */
    interface Constants {
        VOTE_TITLE_COLUMN_NAME: string;
        FORM_EDIT_URL_COLUMN_NAME: string;
        ELECTION_OFFICERS_COLUMN_NAME: string;
        TRIGGER_ID_COLUMN_NAME: string;
        REGISTRATION_SHEET_NAME: string;
        RESULTS_SUFFIX: string;
        INVALID_RESULTS_SHEET_NAME: string;
        TOKEN_ENTRY_FIELD_TITLE: string;
        TOKEN_HELP_TEXT: string;
        CONFIRMATION_MESSAGE: string;
        ElectionState: {
            UNOPENED: ElectionState;
            ACTIVE: ElectionState;
            CLOSED: ElectionState;
        };
    }

    /**
     * Constants namespace
     */
    const Constants: Constants;
    /**
     * Gets the ballot folder ID from ElectionConfiguration sheet.
     * @returns {string} The Google Drive folder ID for storing ballot forms
     * @throws {Error} If the configuration is missing or invalid
     */
    function getBallotFolderId(): string;

    /**
     * Safely gets the ballot folder ID with user-friendly error handling.
     * @returns {string} The ballot folder ID
     * @throws {Error} User-friendly error message for configuration issues
     */
    function getBallotFolderIdSafe(): string;

    /**
     * Manages the lifecycle of elections by opening/closing ballots and attaching/removing triggers.
     * @returns {void}
     */
    function manageElectionLifecycles(): void;


    /**
     * Cleans up orphaned triggers not associated with active ballots.
     * @param {string[]} activeTriggerIds
     */
    function cleanUpOrphanedTriggers(activeTriggerIds: string[]): void;

    /**
     * Creates a ballot form from a source form and shares results with election officers.
     * @param {string} formId
     * @param {string[]} electionOfficers
     * @returns {{ title: string, url: string }}
     */
    function createBallotForm(formId: string, electionOfficers: string[]): { title: string, url: string };

    /**
     * Retrieves a ballot form by ID or URL.
     * @param {string} id
     * @returns {Ballot}
     */
    function getBallot(id: string): Ballot;

    /**
     * Adds a required token question to the form.
     * @param {Ballot} form
     */
    function addTokenQuestion_(form: Ballot): void;

    /**
     * Creates a results spreadsheet for the ballot form.
     * @param {string} formId
     * @returns {GoogleAppsScript.Spreadsheet.Spreadsheet}
     */
    function createResultsSpreadsheet_(formId: string): GoogleAppsScript.Spreadsheet.Spreadsheet;

    /**
     * Sets the Election Officers for the ballot and its results spreadsheet.
     * @param {string} editUrl
     * @param {string[]} electionOfficers
     */
    function setElectionOfficers(editUrl: string, electionOfficers?: string[]): void;

    /**
     * Sets the form to accept or not accept responses.
     * @param {string} formId
     * @param {boolean} active
     */
    function collectResponses(formId: string, active?: boolean): void;

    /**
     * Provides information about managing Election Officers for ballots in Shared Drives
     * @param {string} editUrl
     * @returns {{isSharedDrive: boolean, driveInfo: string, recommendations: string[]}}
     */
    function getElectionOfficerManagementInfo(editUrl: string): {
        isSharedDrive: boolean;
        driveInfo: string;
        recommendations: string[];
    };

    /**
     * Creates a pre-filled URL for a question in a form.
     * @param {string} formId
     * @param {string} questionTitle
     * @param {string} answer
     * @returns {string}
     */
    function createPrefilledUrlWithTitle(formId: string, questionTitle: string, answer?: string): string;

    /**
     * Gets the trigger ID for a ballot.
     * @param {string} ballotId
     */
    function getTriggerIdForBallot_(ballotId: string): string | null;


    /**
     * Gets the state of an election (UNOPENED, ACTIVE, CLOSED).
     * @param election The validated election object to check.
     * @returns The state of the election.
     */
    function getElectionState(election: ValidatedElection): VotingService.ElectionState;

    /**
     * 
     * @param election The election object.
     * @returns The spreadsheet ID from the election.
     * @throws {Error} If no spreadsheet ID is found.
     */
    function getSpreadsheetIdFromElection(election: ValidatedElection): string;

    type DataType = {


        /**
         * Retrieves the election data from the Elections sheet as validated objects.
         * Delegates to DataAccess.getElections() which returns typed ValidatedElection instances.
         */
        getElectionData(): ValidatedElection[];

        /**
         * Stores the election data in the Elections sheet.
         * Overwrites existing data.
         * @param elections Array of validated election objects to store.
         */
        storeElectionData(elections: ValidatedElection[]): void;

        /**
         * Checks if the given email has already voted in the specified election.
         * @param email Email address to check.
         * @param election Validated election object.
         * @returns True if the email has already voted, false otherwise.
         */
        hasVotedAlreadyInThisElection(email: string, election: ValidatedElection): boolean;


    }

}


