// --- Configuration ---
const SPREADSHEET_ID = SpreadsheetApp.getActiveSpreadsheet().getId(); // Use container spreadsheet
const DATA_SHEET_NAME = 'Members';           // Replace with your data sheet name
const TOKEN_SHEET_NAME = 'MagicLinkTokens'; // Sheet to store tokens (create this sheet)
const ACCESS_LINK_BASE_URL = ScriptApp.getService().getUrl(); // Base URL of your web app







 DirectoryService.getDirectoryEntries = () => {
  const activeMembers = Common.Data.Access.getActiveMembers();
  const publicMembers = activeMembers.filter(member => member['Directory Share Name'])
  const tableData = publicMembers.map(member => {
    return {
      First: member.First, 
      Last: member.Last, 
      email: member['Directory Share Email'] ?  member.Email : '',
      phone: member['Directory Share Phone'] ?  member.Phone : ''
  }})
  return tableData;
}
