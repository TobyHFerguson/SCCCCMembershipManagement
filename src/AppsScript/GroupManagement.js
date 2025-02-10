
function addMembersToGroups() {
    const action = (args) => log('addMemberToGroup:', ...args);
    // const action
    manageMembersInGroups_('Bulk Add Emails', action);
}

function removeMembersFromGroups() {
    manageMembersInGroups_('Bulk Remove Emails', removeMemberFromGroup);
}

function manageMembersInGroups_(emailSheetName, action) {
    const memberEmails = getFiddler_(emailSheetName);
    const groupEmailAddresses = getFiddler_('Group Email Addresses').getData();

    memberEmails.filterRows(e => { groupEmailAddresses.forEach(g => action(e, g)); return false }).dumpValues();
}


/**
 * Adds a single member to a Google Group using the Admin SDK API.
 *
 * @param {string} groupEmail The email address of the Google Group.
 * @param {string} memberEmail The email address of the member to add.
 * @customfunction
 */
function addMemberToGroup(email, groupEmail) {
    try {
        AdminDirectory.Members.insert({ email, role: "MEMBER" }, groupEmail);
        log(`Successfully added ${email} to ${groupEmail}`);
    } catch (e) {
        if (e.message && e.message.includes("Member already exists")) {
            log(`Member ${email} already exists in ${groupEmail}`);
        } else {
            throw e
        }
    }
}

/**
 * Removes a single member from a Google Group using the Admin SDK API.
 *
 * @param {string} groupEmail The email address of the Google Group.
 * @param {string} memberEmail The email address of the member to remove.
 * @customfunction
 */
function removeMemberFromGroup(email, groupEmail) {
    try {
        AdminDirectory.Members.remove(groupKey = groupEmail, memberKey = memberEmail);
        log(`Successfully removed ${memberEmail} from ${groupEmail}`);
    } catch (e) {
        if (e.message && e.message.includes("Resource Not Found")) {
            log(`Member ${memberEmail} does not exist in ${groupEmail}`);
        } else {
            throw e;
        }
    }
}
