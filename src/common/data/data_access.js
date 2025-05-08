Common.Data.Access = {
    getEmailAddresses: function () {
        const members = Common.Data.Storage.SpreadsheetManager.getFiddler('ActiveMembers').getData();
        const emails = members.map(member => member.Email);
        return emails;
    },
    getActiveMembers: () => {
        const members = Common.Data.Storage.SpreadsheetManager.getFiddler('ActiveMembers').getData().filter(member => member.Status === 'Active')
        return members;
    },
    getActionSpecs: () => {
        Common.Data.Storage.SpreadsheetManager.convertLinks('Action Specs');
        // We use getDataWithFormulas_ because the Body of an ActionSpec may contain formulas with a URL.
        const actionSpecsAsArray = Common.Data.Storage.SpreadsheetManager.getDataWithFormulas(Common.Data.Storage.SpreadsheetManager.getFiddler('ActionSpecs'))
        const actionSpecs = Object.fromEntries(actionSpecsAsArray.map(spec => [spec.Type, spec]));
        for (const actionSpec of Object.values(actionSpecs)) {
            let match = actionSpec.Body.match(/=hyperlink\("(https:\/\/docs.google.com\/document\/d\/[^"]+)"/);
            if (match) {
                let url = match[1];
                actionSpec.Body = DocsService.convertDocToHtml(url);
            }
        }
        return actionSpecs;
    },
    getGroupEmails:() => {
        const groupEmails = Common.Data.Storage.SpreadsheetManager.getFiddler('GroupEmails').getData();
        return groupEmails;
      }
}