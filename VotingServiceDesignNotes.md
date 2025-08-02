# Voting Service Design Notes
## Workflow
### Election Organizer
#### Ballot Creation
* Creates a new Google Form with the necessary questions to represent the ballot
* Transfers ownership of this form to the Election System Operator (membership_automation@sc3.club)
#### Election Results Review
* Checks the 'Invalid' visual summary (sheet is red)
* If sheet is valid then uses the form's visual summary to display the result
* If sheet is invalid then manually filters out all invalid responses and manually creates the necessary graphs
#### Alerts
The Election Organizer will receive email alerts if there are any invalid votes, giving them forewarning that they will have to perform manual filtering and graphing operations
### Voter
#### Election Announcement
Receives an election announcement email telling them that a new election is active
#### Active Elections
* Uses the Voting Service to see the list of elections, via the standard Magic Link mechanism
* From the list of elections selects an active election to participate in which presents them with the ballot
#### Voting
* Uses the ballot as a Google form,
* Fills in the form with their responses
* Submits the form
#### Confirmation
* Sees a confirmation message
* Does not see 'Submit another response' link, reinforcing the one time nature of their vote
#### Re-voting attempts
* If the member submits the ballot again they will still see a confirmation but the vote will be marked as 'invalid' internally.
* A record is kept of the elections a voter has participated in, to ensure that they are filtered out of any elections they've already voted in.
### Election System Operator
The ESO is responsible for technical setup, security & maintenance
#### Setup (after form ownership transfer)
##### Manual
* Receives ownership of the Google Form and its linked Google Sheet from the Form Designer.
* Adds a new row for the vote to the **Election Registrations** spreadsheet:
* The Elections Registration spreadsheet has one row per election, with the following columns:
  * **Election title** - textual title to be displayed to users, 
  * **Form ID** - ID of the Google Form,
  * **Token question ID** - Entry ID of the token question added to the Google Form 
  * **Results recipients list** - comma separated list of email addresses with whom the responses sheet is to be shared, 
  * **Start date** - First date on when the election is active and voting can commence
  * **End date** - Last date on which voting can occur
  * **Voters** - comma separated list of members that have voted in this election
##### Automated
When the row has been added to the **Elections Registrations** sheet, a trigger (`handleRegistrationSheetEdit`) is fired which will:
* Add a results sheet to the form
* Shares that sheet with the addresses in the recipients list
* Add a Token question to the end of the form, noting the EntryID in the **Vote Registrations** sheet
* Install an `onFormSubmit` trigger (`ballotSubmitHandler`) to the form to process the submission:
  * Adds the submitted data to a 'validated' sheet which will mark a submission as invalid iff its token is invalid
  * Marks the entire results spreadsheet and emails the recipients if any invalid token has been found
  * Using the email associated with the vote token adds the member's email to the **Voters** list for the specific vote
#### Voting Service
* The Voting Service presents the user with a table of votes.
* Each row shows the vote's:
  *  **Title** - hyperlinked to the pre-filled ballot if the vote hasn't yet voted in this election
  *  **Active dates**
  *  **Voted on** - date (blank if not already voted on by this user)
*  If the user selects an election title the corresponding vote form is opened up, pre-filled with a vote token to mark their single vote. (We'd like to force the current page to be overwritten - is that possible?)
# Testing the service
## Setup
* Integrate the dev and staging URLs into the SC3 Test site
## Development
* Separate out the triggers from the underlying functions
* Test the underlying functions independently, so that wiring the functions into the triggers is a separate development step
### Vote Organizer
1. Create a form 'Test vote 1' with a single question: 'black === white?'
2.Transfer ownership of that form to the Voter Operator
### Voter Operator
1. Add the form ID to the Vote Registrations sheet
2. Check that the following new entries are created:
   1. A Trigger Status - active
   2. The results sheet is shared with the results recipients
### Voter workflow
1. Use the test URL to request a magic link for the Voting service for membership-automation@sc3.club
2. Open the email
3. Check that an active vote is available
4. Select the active vote
5. Vote for black === white - No
6. Submit the form (Can the form be submitted multiple times?)
### 