/**
 * VotingService namespace for election and ballot management.
*/
declare namespace VotingService {
    /**
     * Election state string literal type - matches the ElectionState object values in JavaScript
     */
    type ElectionState = 'UNOPENED' | 'ACTIVE' | 'CLOSED';

    /**
     * Represents an election object.
     */
    interface Election {
        Title: string;
        'Form Edit URL': string;
        'Election Officers': string; // Comma-separated emails
        Start?: string | Date;
        End?: string | Date;
        TriggerId?: string;
    }

    /**
     * Type alias for a ballot form (now using the augmented GoogleAppsScript.Forms.Form)
     */
    type Ballot = GoogleAppsScript.Forms.Form;
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
     * Sets the Election Officers for the ballot and its results spreadsheet.
     * @param {string} editUrl
     * @param {string[]} electionOfficers
     */
    function setElectionOfficers(editUrl: string, electionOfficers?: string[]): void;

    /**
     * Sends an email to a new election officer.
     * @param {string} email
     * @param {string} title
     * @param {string} url
     */
    function sendElectionOfficerAddEmail_(email: string, title: string, url: string): void;

    /**
     * Sends an email to a removed election officer.
     * @param {string} email
     * @param {string} title
     */
    function sendElectionOfficerRemoveEmail_(email: string, title: string): void;

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


    /**
     * Gets the state of an election (UNOPENED, ACTIVE, CLOSED).
     * @param {VotingService.Election} election The election object to check.
     * @returns {VotingService.ElectionState} The state of the election.
     */
    function getElectionState(election: VotingService.Election): VotingService.ElectionState;

    /**
     * 
     * @param election The election object.
     * @returns The spreadsheet ID from the election.
     * @throws {Error} If no spreadsheet ID is found.
     */
    function getSpreadsheetIdFromElection(election: Election): string;

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
         * Gets a fiddler attached to the valid results sheet for the given trigger ID.
         * @param {string} triggerId Trigger ID.
         * @returns {any | undefined} Fiddler instance or undefined.
         */
        getFiddlerForValidResults(triggerId: string): any | undefined;
    }

}


