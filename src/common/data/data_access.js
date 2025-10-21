/// <reference path="../../types/global.d.ts" />

/**
 * @returns {Fiddler<VotingService.Election>}
 */
function getElectionsFiddler() {
    return Common.Data.Storage.SpreadsheetManager.getFiddler('Elections');
}

/**
 * @returns {Fiddler<TokenDataType>}
 */
function getTokensFiddler() {
    return Common.Data.Storage.SpreadsheetManager.getFiddler('Tokens');
}

Common.Data.Access = {
    getBootstrapData: () => {
        const bootStrapFiddler = Common.Data.Storage.SpreadsheetManager.getFiddler('Bootstrap');
        return bootStrapFiddler.getData();
    },
    getEmailAddresses: function () {
        const members = Common.Data.Storage.SpreadsheetManager.getFiddler('ActiveMembers').getData();
        const emails = members.map(member => member.Email.toLowerCase());
        return emails;
    },
    getActiveMembers: () => {
        const members = Common.Data.Storage.SpreadsheetManager.getFiddler('ActiveMembers').getData().filter(member => member.Status === 'Active')
        return members;
    },
    getActionSpecs: () => {
        Common.Data.Storage.SpreadsheetManager.convertLinks('Action Specs');
        // We use getDataWithFormulas_ because the Body of an ActionSpec may contain formulas with a URL.
        const actionSpecsAsArray = /** @type {MembershipManagement.ActionSpec[]} */ (Common.Data.Storage.SpreadsheetManager.getDataWithFormulas(Common.Data.Storage.SpreadsheetManager.getFiddler('ActionSpecs')))
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
    getPublicGroups: () => {
        const publicGroups = Common.Data.Storage.SpreadsheetManager.getFiddler('PublicGroups').getData();
        return publicGroups;
    },
    getMember: (email) => {
        email = email.toLowerCase();
        const members = Common.Data.Storage.SpreadsheetManager.getFiddler('ActiveMembers').getData();
        const member = members.filter(member => member.Email.toLowerCase() === email).map(member => { return { ...member, Email: member.Email.toLowerCase() } })
        return member[0];
    },
    updateMember: (email, newMember) => {
        email = email.toLowerCase();
        Common.Data.Storage.SpreadsheetManager.getFiddler('ActiveMembers').mapRows(member => {
            return (member.Email.toLowerCase() === email) ? newMember : member;
        }).dumpValues();
        return true;
    },
    isMember:(email) => {
        email = email.toLowerCase();
        const members = Common.Data.Storage.SpreadsheetManager.getFiddler('ActiveMembers').getData();
        return members.some(member => member.Email.toLowerCase() === email);
    },
    getElections: () => {
        const votingData = Common.Data.Storage.SpreadsheetManager.getFiddler('Elections').getData();
        return votingData;
    }
}