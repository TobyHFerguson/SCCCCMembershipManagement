# Voting Service Design Notes
## Workflow
### Vote Organizer
#### Form Creation
* Creates a new Google Form with the necessary questions
* Transfers ownership of this form to the Vote System Operator (membership_automation@sc3.club)
#### Results Review
* Checks the 'Invalid' visual summary (sheet is red)
* If sheet is valid then uses the form's visual summary to display the result
* If sheet is invalid then manually filters out all invalid responses and manually creates the necessary graphs
#### Alerts
The Vote Organizer will receive email alerts if there are any invalid entries, giving them forewarning that they will have to perform manual filtering and graphing operations
### Voter
#### Voting Announcement
Receives voting announcement email telling them that a new vote is active
#### Active Votes
* Uses the Voting Service to see the list of active votes, via the standard Magic Link mechanism
* From the list of Active Votes selects an active vote to participate in, causing another Magic Link to be sent to them, containing a link to the corresponding voting for
#### Voting
* Uses the magic link to access the active vote as a Google Form
* Fills in the form with their responses
* Submits the form
#### Confirmation
* Sees a confirmation message
* Does not see 'Submit another response' link, reinforcing the one time nature of their vote
#### Re-voting attempts
* If the member submits the form again they will still see a confirmation but the vote will be marked as 'invalid' internally.
* A record is kept of the votes a voter has participated in, to ensure that they are filtered out of any votes they've already voted in.
### Voting System Operator
The VSO is responsible for technical setup, security & maintenance
#### Setup (after form ownership transfer)
##### Manual
* Receives ownership of the Google Form and its linked Google Sheet from the Form Designer.
* Adds a new row for the vote to the Vote Registrations spreadsheet, with the title, form ID, results list, start & end dates
##### Automated
When the row has been added, a trigger is fired which will:
* Add a results sheet to the form, and share that sheet with the addresses in the results list
* Install an onFormSubmit trigger to the form to process the submission:
  * Adds the submitted data to a 'validated' sheet which will mark each submission as valid or invalid
  * A vote is invalid if it has been submitted twice
#### Voting Service
* The Voting Service presents the user with a list of active votes. Selecting an active vote link will cause a Magic Link to be sent to that user, including a the Form URL prefilled with a voting token. 
* When the user opens the Magic Link the Form will already have the Token question pre-filled (and the text of the question will encourage them not to modify that question). 
# Testing the service
## Setup
* Integrate the dev and staging URLs into the SC3 Test site
## Development
* Push to dev
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