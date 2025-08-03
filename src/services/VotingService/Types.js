/**
 * @typedef Election
 * @property {string} ID - The unique identifier for the election, typically the Google Form ID.
 * @property {string} Title - The title of the election to be displayed to users.
 * @property {Array<string>} Organizers - A list of email addresses of the election organizers.
 * @property {Date} Start - The start date of the election, when voting can commence.
 * @property {Date} End - The end date of the election, when voting stops.
 * @property {Array<string>} Voters - A list of email addresses of members who have voted in this election.
 */

/**
 * @interface ElectionRegistrationManager
 * @description Interface for managing election registrations.
 * This interface defines methods for adding, retrieving, and managing elections.
 * It abstracts the underlying storage mechanism, allowing for flexibility in implementation.
 * * @property {function(): Array<Election>} getElections - Retrieves a list of all elections.
 * * @property {function(Election): void} addElection - Adds a new election to the storage.
 * * @property {function(string): [Election]} storeElections - Stores a list of elections.
 */