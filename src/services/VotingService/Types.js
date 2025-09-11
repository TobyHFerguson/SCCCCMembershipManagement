

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
 * @typedef {Object} Vote
 * @ts-nocheck - the [''] below causes a ts 10003 error  
 * @property {string} [VOTER_EMAIL_COLUMN_NAME] - The email address of the voter.
 * @property {string} [TOKEN_ENTRY_FIELD_TITLE] - The token field title, if applicable.
 * @property {string} Timestamp - timestamp of vote.
 *
 * 
 * @description Represents a vote cast by a user in an election. It includes the voter's email and their selections.
 */
