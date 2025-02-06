function sendEmailFromSpreadsheet() {
    // 1. Get the Google Doc containing the email body.
    const docId = '18qd572oyGt8bc3DDXU3p14AFxeAYGUA5W5mCArv5ajY'; // **REPLACE with your Doc ID**
    const doc = DocumentApp.openById(docId);
    const emailBody = doc.getBody().getText(); // Get the *entire* document content.

    // 2. Get the Spreadsheet data.
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("Email Schedule"); // **REPLACE with your sheet name**
    const data = sheet.getDataRange().getValues();
    const fieldNames = data[0];  // Assuming first row has field names

    // 3. Iterate through the spreadsheet rows.
    for (let i = 1; i < data.length; i++) {
        const rowData = data[i];
        let populatedBody = emailBody;

        // 4. Substitute placeholders.
        for (let j = 0; j < fieldNames.length; j++) {
            const fieldName = fieldNames[j];
            const fieldValue = rowData[j] || ""; // Handle empty cells
            const placeholder = `{${fieldName}}`;
            const regex = new RegExp(placeholder, 'g');
            populatedBody = populatedBody.replace(regex, fieldValue);
        }

        // 5. Extract Recipient, Subject, etc. (from Spreadsheet or Doc)
        const to = rowData[fieldNames.indexOf("Email")]; // Get recipient from spreadsheet
        const subject = rowData[fieldNames.indexOf("Subject")]; // Get subject from spreadsheet

        // 6. Send the email directly (no draft).
        if (to && subject) { // Only send if recipient and subject are present
            GmailApp.sendEmail(to, subject, '', {
                htmlBody: populatedBody, // Use htmlBody for formatted content if needed
                // cc: rowData[fieldNames.indexOf("CC")], // Add CC if needed
                // bcc: rowData[fieldNames.indexOf("BCC")], // Add BCC if needed
                // attachments: [...], // Add attachments if needed
            });
            Logger.log(`Email sent to ${to} (row ${i + 1})`);
        } else {
            Logger.log(`Recipient or Subject missing for row ${i + 1}. Skipping.`);
        }
    }
}

function getDocumentIdByTitle(title) {
    // 1. Get all the files in the user's Google Drive.  You can refine this search
    //    if you know the document is in a specific folder.
    const files = DriveApp.searchFiles('title = "' + title + '"');

    // 2. Iterate through the files.
    while (files.hasNext()) {
        const file = files.next();

        // 3. Check if the file is a document and if the title matches exactly.
        if (file.getMimeType() === MimeType.GOOGLE_DOCS && file.getName() === title) {
            return file.getId(); // Return the ID if found.
        }
    }

    // 4. Return null if no document with that title is found.
    return null;
}

function testGetDocumentId() {
    const docTitle = "Your Document Title Here"; // Replace with the actual title.
    const docId = getDocumentIdByTitle(docTitle);

    if (docId) {
        Logger.log("Document ID: " + docId);
    } else {
        Logger.log("No document found with the title: " + docTitle);
    }
}