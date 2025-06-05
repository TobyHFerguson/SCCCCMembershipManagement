VotingService.Trigger = {
    onEdit: function (e) {
        const editedRange = e.range;
        const editedRow = editedRange.getRow();
        const editedColumn = editedRange.getColumn();
        const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];

        const formIdColumnIndex = headers.indexOf(FORM_ID_COLUMN_NAME) + 1;
        const resultsRecipientColumnIndex = headers.indexOf(RESULTS_RECIPIENT_COLUMN_NAME) + 1;
        const triggerStatusColumnIndex = headers.indexOf(TRIGGER_STATUS_COLUMN_NAME) + 1;

        if (editedColumn === formIdColumnIndex && editedRow > 1) {
            const formId = sheet.getRange(editedRow, formIdColumnIndex).getValue();
            const resultsRecipients = sheet.getRange(editedRow, resultsRecipientColumnIndex).getValue();

            if (formId) {
                return this._attachOnSubmitTrigger(formId, editedRow, triggerStatusColumnIndex, resultsRecipients);
            }
        }
    },
    _attachOnSubmitTrigger: function (formId, row, triggerStatusColumnIndex, resultsRecipients) {
        try {
            const form = FormApp.openById(formId);
            ScriptApp.newTrigger('votingFormSubmitHandler')
                .forForm(form)
                .onFormSubmit()
                .create();

            if (triggerStatusColumnIndex > 0) {
                SpreadsheetApp.getActiveSpreadsheet().getSheetByName(REGISTRATION_SHEET_NAME).getRange(row, triggerStatusColumnIndex).setValue('Active');
            }
            console.log(`Attached votingFormSubmitHandler trigger to form ID: ${formId}`);

            if (resultsRecipients) {
                this._shareResultsSheet(resultsRecipients);
            }

        } catch (error) {
            console.log(`Error attaching votingFormSubmitHandler trigger to form ID: ${formId}: ${error}`);
            if (triggerStatusColumnIndex > 0) {
                SpreadsheetApp.getActiveSpreadsheet().getSheetByName(REGISTRATION_SHEET_NAME).getRange(row, triggerStatusColumnIndex).setValue('Failed: ' + error);
            }
        }
    }, _shareResultsSheet: function (recipients) {
        const ss = SpreadsheetApp.openById(VOTE_DATA_SHEET_ID);
        const sheet = ss.getActiveSheet();
        const recipientEmails = recipients.split(',').map(email => email.trim());
        recipientEmails.forEach(email => {
            try {
                sheet.addViewer(email);
                console.log(`Shared results sheet with: ${email}`);
            } catch (error) {
                console.log(`Error sharing results sheet with ${email}: ${error}`);
            }
        });
    },
    votingFormSubmitHandler: function (e) {
        const formResponse = e.response;
        const itemResponses = formResponse.getItemResponses();
        const form = FormApp.getActiveForm();
        const formId = form.getId();
        const responsesSheet = SpreadsheetApp.openById(VOTE_DATA_SHEET_ID).getActiveSheet();
        const responseRow = responsesSheet.getLastRow();
        const responseValues = responsesSheet.getRange(responseRow, 1, 1, responsesSheet.getLastColumn()).getValues()[0];
        const headers = responsesSheet.getRange(1, 1, 1, responsesSheet.getLastColumn()).getValues()[0];

        // Assuming you have a question in your form to collect the token (adjust the question title)
        const tokenQuestionTitle = 'Your Voting Token';
        let submittedToken = null;
        itemResponses.forEach(response => {
            if (response.getItem().getTitle() === tokenQuestionTitle) {
                submittedToken = response.getResponse();
            }
        });

        if (!submittedToken) {
            console.log(`No token submitted in form ID: ${formId}, response: ${formResponse.getId()}`);
            // Optionally mark as invalid in the form response sheet
            return;
        }

        const tokenData = Common.Auth.TokenManager.getTokenData();

        if (tokenData) {
            const voterEmail = tokenData.Email; // Assuming email is in the second column

            // Optional: Verify if the email is a registered member
            if (Common.Data.Access.isMember(voterEmail)) {
                this._recordVote(formId, voterEmail, headers, responseValues);
                Common.Auth.TokenStorage.markTokenAsUsed(submittedToken);
                this._replaceTokenWithEmail(responsesSheet, responseRow, headers, voterEmail, tokenQuestionTitle);
                console.log(`Valid vote recorded for ${voterEmail} in form ID: ${formId}`);
            } else {
                console.log(`Non-member email ${voterEmail} tried to vote in form ID: ${formId}`);
                // Optionally mark as invalid
            }
        } else {
            console.log(`Invalid token ${submittedToken} submitted in form ID: ${formId}`);
            // Optionally mark as invalid
        }
    },
    _recordVote: function (formId, voterEmail, headers, responseValues) {
        const ss = SpreadsheetApp.openById(VOTE_DATA_SPREADSHEET_ID);
        const sheet = ss.getActiveSheet();
        const timestamp = new Date();
        const voteData = [timestamp, formId, voterEmail, ...responseValues];
        sheet.appendRow(voteData);
    },
    _replaceTokenWithEmail: function (responsesSheet, row, headers, email, tokenQuestionTitle) {
        const tokenColumnIndex = headers.indexOf(tokenQuestionTitle) + 1;
        if (tokenColumnIndex > 0) {
            responsesSheet.getRange(row, tokenColumnIndex).setValue(email);
        }
    }
}