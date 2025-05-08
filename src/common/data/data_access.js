Common.Data.Access = {
    getEmailAddresses: function () {
        const members = SpreadsheetManager.getFiddler('ActiveMembers').getData();
        const emails = members.map(member => member.Email);
        return emails;
    },
    getActiveMembers: () => {
        const members = SpreadsheetManager.getFiddler('ActiveMembers').getData().filter(member => member.Status === 'Active')
        return members;
    }
    
}