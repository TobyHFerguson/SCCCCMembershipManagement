/**
 * @typedef Election
 * @property {string} ID - The unique identifier for the election, typically the Google Form ID.
 * @property {string} Title - The title of the election to be displayed to users.
 * @property {Array<string>} Organizers - A list of email addresses of the election organizers.
 * @property {Date} Start - The start date of the election, when voting can commence.
 * @property {Date} End - The end date of the election, when voting stops.
 * @property {Array<string>} Voters - A list of email addresses of members who have voted in this election.
 * @property {String} TriggerId - The ID of the trigger associated with this election, if applicable.
 */

/**
 * @typedef {Object} ProcessedElection
 * @property {string} title - The title of the election.
 * @property {Date} opens - The formatted start date of the election.
 * @property {Date} closes - The formatted end date of the election.
 * @property {string} status - The status of the election, indicating if it's active or inactive.
 * @property {string} url - A prefilled URL for the voting form with a token field for the user. 
 */

/**
 * @typedef {Object} ElectionRegistrationManager
 * @description Interface for managing election registrations.
 * This interface defines methods for adding, retrieving, and managing elections.
 * It abstracts the underlying storage mechanism, allowing for flexibility in implementation.
 * * @property {function(): Array<Election>} getElections - Retrieves a list of all elections.
 * * @property {function(Election): void} addElection - Adds a new election to the storage.
 * * @property {function(string): [Election]} storeElections - Stores a list of elections.
 */

/**
 * @typedef {Object} VotingService
 * @property {string} TOKEN_QUESTION_TITLE - The title of the question in the voting form that holds the token.
 * @property {string} name - The name of the voting service.
 * @property {string} service - The service identifier for the voting service.
 * @property {Object} WebApp - Contains methods related to the web application interface of the voting service.
 * @property {Object} Trigger - Contains methods related to triggers and event handling for the voting service.
 * @property {Object} Data - An interface for managing election data, including retrieving and storing elections.
 * @property {function(string): GoogleAppsScript.Forms.Form} getBallot - Retrieves a ballot form by its ID.
 * @property {function(string): string} createBallotForm - Creates a new ballot form from a source form ID and returns the new form ID.
 * @property {function(): void} manageElectionLifecycles - Manages the lifecycle of elections, opening and closing them based on their start and end dates.
 * @property {function(Election): string} attachOnSubmitTrigger - Attaches an on-submit trigger to a ballot form.
 * @property {function(Election, string): boolean} closeElection - Closes an election by setting it to not accepting responses and removing its trigger.
 * @property {function(string): boolean} removeOnSubmitTrigger - Removes the on-submit trigger associated with a given trigger ID.
 * @property {function(string): string} getTriggerId - Retrieves the unique ID of a trigger associated with a form.
 * @property {function(Election): void} openElection - Opens an election by setting it to accepting responses and attaching the necessary trigger.
 * @property {function(Election): void} closeElection_ - Closes an election by setting it to not accepting responses and removing its trigger.
 * @property {function(string): void} attachOnSubmitTrigger_ - Attaches the votingFormSubmitHandler trigger to a specified form ID.
 * @property {function(string): string} extractGasFormId - Extracts the Google Form ID from a URL.
 * @property {function(string): string} getForm - Retrieves a Google Form by its ID.
 * @property {function(string): boolean} isValidFormId - Checks if a given form ID is valid.
 * @property {function(): Array<ProcessedElection>} getProcessedElections - Retrieves a list of processed elections with formatted dates and statuses.
 * @property {ElectionRegistrationManager} Data - An interface for managing election registrations.
 * 
 * @description The VotingService provides functionalities for managing elections, collecting votes, and handling voting-related operations.
 */

/**
 * @typedef {Object} Vote
 * @ts-nocheck - the [''] below causes a ts 10003 error  
 * @property {string} ['Voter Email'] - The email address of the voter.
 * @property {string} [TOKEN_ENTRY_FIELD_TITLE] - The token field title, if applicable.
 * @property {string} Timestamp - timestamp of vote.
 *
 * 
 * @description Represents a vote cast by a user in an election. It includes the voter's email and their selections.
 */
