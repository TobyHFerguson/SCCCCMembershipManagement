# Release Notes
This file tracks those non-code changes needed to achieve a specific release, such as updating the website or changing spreadsheet structures etc. 
To the extent that these changes are driven by specific issues then those issues are linked herein.

# 1.1.1 - mobile services
* **Website Changes:**
  [X] Update Member Services page to use the term 'Magic Links' and to describe the overall process

# 1.2.0 - Voting Service
## Documentation
 - [ ] Election Manual
 - [ ] Update Membership Director Manual
## Apps Script
### Services
 - [ ] Add **Drive** as an Apps Script Service
 - [ ] Accept new permissions
### Triggers
 - [ ] Run `triggers.gs/setupElectionsTriggers()`
### Groups
  - [X] Add a group `Election Administrators` (election.admin@sc3.club)
  - [X] Add a description that links to the manual for elections. 
  - [X] `membership@sc3.club` is the Owner
  - [X] Add `membership-automation@sc3.club` as member
  - [X] Set the group options to **invite only**
## SC3 Election Registration SpreadSheet
 - [X] Add Elections sheet with columns:
      * Title (string)
      * Form Edit URL (string)
      * Election Officers (string)
      * Start (Date)
      * End (Date)
      * TriggerId (String - hidden)
 - [X] Make `election.admins@sc3.club` an editor
 - [X] Add Configuration Sheet:
    * Add Key & Value Columns
    * Add BALLOT_FOLDER_URL key with appropriate value
## SC3 Membership (Responses) - Bootstrap Sheet
 - [X] Add row for **Elections** spreadsheet
 - [X] Add row for **Bootstrap** sheet
