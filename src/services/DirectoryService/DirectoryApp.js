// --- Configuration ---
const SPREADSHEET_ID = '1WifVsHmL6pyI4J8j1-8xI3eKnGdY9WemA3UL9jCTaJI'; // Replace with your spreadsheet ID
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

DirectoryService.name = "Directory Service"
DirectoryService.service = "DirectoryService"

// --- Web App Functions ---