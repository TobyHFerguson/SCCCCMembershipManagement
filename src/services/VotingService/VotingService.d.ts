/**
     * The default ballot folder ID.
     */
declare const BALLOT_FOLDER_ID: string;
/**
 * The column name for the vote title.
 */
declare const VOTE_TITLE_COLUMN_NAME: string;
/**
 * The column name for the voter email.
 */
declare const VOTER_EMAIL_COLUMN_NAME: string;
/**
 * The column name for the form edit URL.
 */
declare const FORM_EDIT_URL_COLUMN_NAME: string;
/**
 * The column name for editors.
 */
declare const EDITORS_COLUMN_NAME: string;
/**
 * The column name for trigger status.
 */
declare const TRIGGER_STATUS_COLUMN_NAME: string;
/**
 * The ID of the central vote data sheet.
 */
declare const VOTE_DATA_SHEET_ID: string;
/**
 * The name of the registration sheet.
 */
declare const REGISTRATION_SHEET_NAME: string;
/**
 * The suffix for results sheets.
 */
declare const RESULTS_SUFFIX: string;
/**
 * The title of the token entry field.
 */
declare const TOKEN_ENTRY_FIELD_TITLE: string;
/**
 * The help text for the token entry field.
 */
declare const TOKEN_HELP_TEXT: string;
/**
 * The confirmation message shown after voting.
 */
declare const CONFIRMATION_MESSAGE: string;

/**
 * VotingService namespace for election and ballot management.
*/
declare namespace VotingService {
    /**
 * Represents an election object.
 */
    interface Election {
        Title: string;
        [FORM_EDIT_URL_COLUMN_NAME]: string;
        Start?: string | Date;
        End?: string | Date;
        TriggerId?: string;
    }

    /**
     * Represents a ballot form.
     */
    interface Ballot extends GoogleAppsScript.Forms.Form {
        setPublished(enabled: boolean): Ballot;
        isPublished(): boolean;
    }
    /**
     * Gets the ballot folder ID.
     * @returns {string}
     */
    function getBallotFolderId(): string;

    /**
     * Manages the lifecycle of elections by opening/closing ballots and attaching/removing triggers.
     * @returns {void}
     */
    function manageElectionLifecycles(): void;

    /**
     * Opens an election by publishing the ballot and attaching the onSubmit trigger.
     * @param {Ballot} ballot
     * @returns {string} The unique ID of the created trigger.
     */
    function openElection_(ballot: Ballot): string;

    /**
     * Attaches the ballotSubmitHandler trigger to the ballot's response spreadsheet.
     * @param {Ballot} ballot
     * @returns {string} The unique ID of the created trigger.
     */
    function attachOnSubmitTrigger_(ballot: Ballot): string;

    /**
     * Cleans up orphaned triggers not associated with active ballots.
     * @param {string[]} activeTriggerIds
     */
    function cleanUpOrphanedTriggers(activeTriggerIds: string[]): void;

    /**
     * Closes the election by unpublishing the ballot and removing the onSubmit trigger.
     * @param {Ballot} ballot
     * @param {string} triggerId
     * @returns {boolean}
     */
    function closeElection_(ballot: Ballot, triggerId: string): boolean;

    /**
     * Removes the onSubmit trigger by its ID.
     * @param {string} triggerId
     * @returns {boolean}
     */
    function removeOnSubmitTrigger_(triggerId: string): boolean;

    /**
     * Creates a ballot form from a source form and shares results with editors.
     * @param {string} formId
     * @param {string[]} editors
     * @returns {{ title: string, url: string }}
     */
    function createBallotForm(formId: string, editors: string[]): { title: string, url: string };

    /**
     * Retrieves a ballot form by ID or URL.
     * @param {string} id
     * @returns {Ballot}
     */
    function getBallot(id: string): Ballot;

    /**
     * Makes a published copy of a Google Form in the given folder.
     * @param {string} formId
     * @param {string} destinationFolderId
     * @returns {string} The edit URL of the new form.
     */
    function makePublishedCopyOfFormInFolder_(formId: string, destinationFolderId: string): string;

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
     * Sets the editors for the ballot and its results spreadsheet.
     * @param {string} editUrl
     * @param {string[]} editors
     */
    function setEditors(editUrl: string, editors?: string[]): void;

    /**
     * Sends an email to a new editor.
     * @param {string} email
     * @param {string} title
     * @param {string} url
     */
    function sendEditorAddEmail_(email: string, title: string, url: string): void;

    /**
     * Sends an email to a removed editor.
     * @param {string} email
     * @param {string} title
     */
    function sendEditorRemoveEmail_(email: string, title: string): void;

    /**
     * Sets the form to accept or not accept responses.
     * @param {string} formId
     * @param {boolean} active
     */
    function collectResponses(formId: string, active?: boolean): void;

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

    type DataType = {
        /**
         * Gets the fiddler for the Elections sheet.
         * @returns {any} Fiddler instance for the Elections sheet.
         */
        getFiddler_(): any;

        /**
         * Retrieves the election data from the Elections sheet.
         * @returns {Election[]} Array of Election objects.
         */
        getElectionData(): Election[];

        /**
         * Stores the election data in the Elections sheet.
         * Overwrites existing data.
         * @param {Election[]} elections Array of election objects to store.
         */
        storeElectionData(elections: Election[]): void;

        /**
         * Checks if the given email has already voted in the specified election.
         * @param {string} email Email address to check.
         * @param {Election} election Election object.
         * @returns {boolean} True if the email has already voted, false otherwise.
         */
        hasVotedAlreadyInThisElection(email: string, election: Election): boolean;

        /**
         * Gets the list of voter emails for the specified election.
         * @param {Election} election Election object.
         * @returns {string[]} Array of voter emails.
         */
        getVoters_(election: Election): string[];

        /**
         * Gets the result spreadsheet ID for the given trigger ID.
         * @param {string} triggerId Trigger ID.
         * @returns {string | undefined} Spreadsheet ID or undefined if not found.
         */
        getResultIdForTrigger_(triggerId: string): string | undefined;

        /**
         * Gets a fiddler attached to the valid results sheet for the given trigger ID.
         * @param {string} triggerId Trigger ID.
         * @returns {any | undefined} Fiddler instance or undefined.
         */
        getFiddlerForValidResults(triggerId: string): any | undefined;
    }
   


}
