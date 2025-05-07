// --- Configuration ---
const SPREADSHEET_ID = '1WifVsHmL6pyI4J8j1-8xI3eKnGdY9WemA3UL9jCTaJI'; // Replace with your spreadsheet ID
const DATA_SHEET_NAME = 'Members';           // Replace with your data sheet name
const TOKEN_SHEET_NAME = 'MagicLinkTokens'; // Sheet to store tokens (create this sheet)
const ACCESS_LINK_BASE_URL = ScriptApp.getService().getUrl(); // Base URL of your web app
const EMAIL_SUBJECT = 'SCCCC Directory Access Link';
const EMAIL_BODY = 'Click the following link to access the SCCCC Directory (this link can only be used once):\n\n';
const MAGIC_LINK_INPUT = 'services/DirectoryService/html/magicLinkInput.html'; // Name of the HTML file for input form
const DIRECTORY = 'services/DirectoryService/html/directory.html'; // Name of the HTML file for the directory

// --- Helper Functions ---

function _generateToken() {
  return Utilities.getUuid(); // Generate a unique UUID
}

function getActiveSpreadsheetOrThrow() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) {
    throw new Error("getActiveSpreadsheet() returned null.");
  }
  return ss;
}

function getSheetByNameOrThrow(sheetName) {
  const ss = getActiveSpreadsheetOrThrow();
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    throw new Error(`Sheet "${sheetName}" not found.`);
  }
  return sheet;
}

function _getEmailAddresses() {
  const sheet = getSheetByNameOrThrow(DATA_SHEET_NAME);
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const emailIndex = headers.indexOf('Email');
  if (emailIndex === -1) {
    Logger.log('Error: "Email" column not found.');
    return [];
  }
  return data.slice(1).map(row => row[emailIndex].toLowerCase().trim()).filter(email => email !== '');
}

function storeToken(email, token) {
  const ss = getActiveSpreadsheetOrThrow();
  let tokenSheet = ss.getSheetByName(TOKEN_SHEET_NAME);
  if (!tokenSheet) {
    tokenSheet = ss.insertSheet(TOKEN_SHEET_NAME);
    tokenSheet.appendRow(['Email', 'Token', 'Timestamp', 'Used']);
  }
  tokenSheet.appendRow([email, token, new Date(), false]);
}

function getTokenData(token) {
  const tokenSheet = getSheetByNameOrThrow(TOKEN_SHEET_NAME);
  const data = tokenSheet.getDataRange().getValues();
  const headers = data[0];
  const tokenIndex = headers.indexOf('Token');
  const emailIndex = headers.indexOf('Email');
  const usedIndex = headers.indexOf('Used');
  const timestampIndex = headers.indexOf('Timestamp');

  if (tokenIndex === -1 || emailIndex === -1 || usedIndex === -1 || timestampIndex === -1) {
    throw new Error('Missing headers in token sheet.');
  }

  for (let i = 1; i < data.length; i++) {
    if (data[i][tokenIndex] === token) {
      return {
        email: data[i][emailIndex],
        timestamp: new Date(data[i][timestampIndex]),
        used: data[i][usedIndex],
        rowNumber: i + 1 // To update the 'Used' status
      };
    }
  }
  return null;
}

function markTokenAsUsed(tokenData) {
  if (tokenData && tokenData.rowNumber) {
    console.log(tokenData.rowNumber, Number.isInteger(tokenData.rowNumber));
    const tokenSheet = getSheetByNameOrThrow(TOKEN_SHEET_NAME);
    if (!tokenSheet) {
      throw new Error('Error: MagicLinkTokens sheet not found.');
    }
    const headers = tokenSheet.getRange(1, 1, 1, tokenSheet.getLastColumn()).getValues()[0];
    const usedColumnIndex = headers.indexOf('Used');
    if (usedColumnIndex == -1) {
      throw new Error('Error: "Used" column header not found in the first row of MagicLinkTokens sheet.');
    }
    const usedColumnNumber = usedColumnIndex + 1; // Convert 0-based index to 1-based column number
    tokenSheet.getRange(tokenData.rowNumber, usedColumnNumber).setValue(true);
    console.log('Token marked as used for email:', tokenData.email);
  }
}

function _sendEmail(email, accessLink) {
  const message = {
    to: email,
    subject: EMAIL_SUBJECT,
    body: EMAIL_BODY + accessLink
  }
  MailApp.sendEmail(message);
  console.log('Email sent:', message);
}

function getData(userObject) {
  const sheet = getSheetByNameOrThrow(DATA_SHEET_NAME);
  const values = sheet.getDataRange().getValues();
  const headers = values[0];

  const requiredHeaders = ['First', 'Last', 'Email', 'Phone', 'Directory Share Name', 'Directory Share Email', 'Directory Share Phone'];
  const headerIndexes = {};

  requiredHeaders.forEach(header => {
    const index = headers.indexOf(header);
    if (index === -1) {
      throw new Error(`Error: Required header "${header}" not found.`);
    }
    headerIndexes[header] = index;
  });

  const firstIndex = headerIndexes['First'];
  const lastIndex = headerIndexes['Last'];
  const emailIndex = headerIndexes['Email'];
  const phoneIndex = headerIndexes['Phone'];
  const directoryShareNameIndex = headerIndexes['Directory Share Name'];
  const directoryShareEmailIndex = headerIndexes['Directory Share Email'];
  const directorySharePhoneIndex = headerIndexes['Directory Share Phone'];

  // Filter out any rows where the user doesn't want their name exposed
  const filteredRows = values.slice(1).filter(row => {
    return (directoryShareNameIndex !== -1 && row[directoryShareNameIndex])
  });

  let processedRows = filteredRows;
  if (userObject && userObject.email) {
    processedRows = filteredRows.filter(row => row[emailIndex] === userObject.email);
  }

  const tableData = processedRows.map(row => ({
    First: row[firstIndex] !== undefined ? row[firstIndex] : '',
    Last: row[lastIndex] !== undefined ? row[lastIndex] : '',
    email: (row[directoryShareEmailIndex] && row[emailIndex] !== undefined) ? row[emailIndex] : '',
    phone: (row[directorySharePhoneIndex] && row[phoneIndex] !== undefined) ? row[phoneIndex] : '',
  }));

  return JSON.stringify(tableData);
}

// --- Web App Functions ---

function doGet(e) {
  console.log('doGet called with parameters:', e.parameter);
  console.log('Request URL:', e.parameter.requestUrl);
  const page = e.parameter.page;
  const token = e.parameter.token;

  if (page === 'request') {
    console.log('Requesting access via email');
    return HtmlService.createTemplateFromFile(MAGIC_LINK_INPUT)
      .evaluate()
      .setTitle('Request Access')
      .setSandboxMode(HtmlService.SandboxMode.IFRAME);
  } else if (token) {
    console.log('Token received:', token);
    const tokenData = getTokenData(token);

    if (tokenData && !tokenData.used) {
      console.log('Token is valid and not used. Email:', tokenData.email);
      markTokenAsUsed(tokenData);
      const template = HtmlService.createTemplateFromFile(DIRECTORY);
      template.userEmail = tokenData.email; // Assign the email to a template variable
      const htmlOutput = template.evaluate()
        .setTitle('SCCCC Directory')
        .setSandboxMode(HtmlService.SandboxMode.IFRAME)
        .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
      return htmlOutput;
    } else {
      console
      return HtmlService.createHtmlOutput('<h1>Invalid or Used Link</h1><p>The access link is either invalid or has already been used.</p>');
    }
  } else {
    console.log('No token provided. Displaying welcome message.');
    // const html = '<h1>Welcome</h1><p><a href="' + ScriptApp.getService().getUrl() + '?page=request"  target="_self">Request Access</a></p>';
    const html = '<h1>Welcome</h1><p><a href="' + ScriptApp.getService().getUrl() + '?page=request" target="_top">Request Access</a></p>';
    console.log('HTML:', html);
    const htmlOutput = HtmlService.createHtmlOutput(html)
      .setTitle('Welcome')
      .setSandboxMode(HtmlService.SandboxMode.IFRAME)
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
    console.log('HTML Output:', htmlOutput);
    return htmlOutput;
  }
}

function doPost(e) {
  // Handle POST requests if needed (currently not used)
}

function sendMagicLink(email) {
  email = email.toLowerCase().trim(); // Normalize the email address
  const validEmails = _getEmailAddresses();
  const message = 'If the email address entered was that of a club member then an email with the access link was sent to that address from "membership-automation@sc3.club". If you do not receive an email, please contact the club administrator, after checking your Spam or Junk folders.';
  if (validEmails.includes(email)) {
    const token = _generateToken();
    storeToken(email, token);
    const accessLink = ACCESS_LINK_BASE_URL + '?token=' + token;
    _sendEmail(email, accessLink);
    return { success: true, message };
  } else {
    return { success: false, message };
  }
}