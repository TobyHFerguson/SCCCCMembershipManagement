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



function _sendEmail(email, accessLink) {
  const message = {
    to: email,
    subject: EMAIL_SUBJECT,
    body: EMAIL_BODY + accessLink
  }
  MailApp.sendEmail(message);
  console.log('Email sent:', message);
}

function getDirectoryEntries() {
  const members = SpreadsheetManager.getFiddler('ActiveMembers').getData()
  const publicMembers = members.filter(member => member['Directory Share Name'])
  const tableData = publicMembers.map(member => {
    return {
      First: member.First, 
      Last: member.Last, 
      email: member['Directory Share Email'] ?  member.Email : '',
      phone: member['Directory Share Phone'] ?  member.Phone : ''
  }})
  return JSON.stringify(tableData);
}

// --- Web App Functions ---



function sendMagicLink(email) {
  email = email.toLowerCase().trim(); // Normalize the email address
  const validEmails = _getEmailAddresses();
  const message = 'If the email address entered was that of a club member then an email with the access link was sent to that address from "membership-automation@sc3.club". If you do not receive an email, please contact the club administrator, after checking your Spam or Junk folders.';
  if (validEmails.includes(email)) {
    const token = Common.Auth.TokenManager._generateToken();
    Common.Auth.TokenStorage.storeToken(email, token);
    const accessLink = ACCESS_LINK_BASE_URL + '?token=' + token + '&service=DirectoryService';
    _sendEmail(email, accessLink);
    return { success: true, message };
  } else {
    return { success: false, message };
  }
}