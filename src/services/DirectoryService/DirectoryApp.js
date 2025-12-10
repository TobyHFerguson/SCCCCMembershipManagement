// --- Configuration ---
const SPREADSHEET_ID = SpreadsheetApp.getActiveSpreadsheet().getId(); // Use container spreadsheet
const DATA_SHEET_NAME = 'Members';           // Replace with your data sheet name
const TOKEN_SHEET_NAME = 'MagicLinkTokens'; // Sheet to store tokens (create this sheet)
const ACCESS_LINK_BASE_URL = ScriptApp.getService().getUrl(); // Base URL of your web app

// Namespace declaration pattern (works in both GAS and Jest)
// @ts-ignore
if (typeof DirectoryService === 'undefined') DirectoryService = {};

/**
 * SECURITY BOUNDARY: Get directory entries for public display
 * 
 * This function is the security boundary that ensures only explicitly
 * opted-in member data is returned to the client. It:
 * 1. Filters to Active members only
 * 2. Filters to members who have opted to share their name
 * 3. Returns ONLY the four allowed fields (First, Last, email, phone)
 * 4. Respects individual privacy settings for email/phone
 * 
 * DO NOT bypass this function or use Manager.getDirectoryEntries directly
 * in Api.getData - that would expose full member objects to the client.
 * 
 * @returns {Array<{First: string, Last: string, email: string, phone: string}>}
 */
DirectoryService.getDirectoryEntries = function() {
  const activeMembers = Common.Data.Access.getMembers().filter(member => member.Status === 'Active');
  
  // Filter to members who have opted to share their name in the directory
  const publicMembers = activeMembers.filter(member => member['Directory Share Name']);
  
  // Transform to directory entries, respecting individual privacy settings
  // SECURITY: Only return the four allowed fields
  // NOTE: email and phone will be empty strings when their respective checkboxes are false
  const tableData = publicMembers.map(member => {
    return {
      First: member.First || '', 
      Last: member.Last || '', 
      email: member['Directory Share Email'] ? (member.Email || '') : '',
      phone: member['Directory Share Phone'] ? (member.Phone || '') : ''
    };
  });
  
  return tableData;
};

// Node.js module exports (for Jest testing)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    getDirectoryEntries: DirectoryService.getDirectoryEntries
  };
}
