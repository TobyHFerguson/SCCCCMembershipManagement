
/**
 * Adds members to a Google Group using the Admin SDK API.
 *
 * @param {string} groupEmail The email address of the Google Group.
 * @param {string} memberEmails An array of email addresses to add.
 * @return {string} A success message or an error message.
 * @customfunction
 */
function addMembersToGroup(groupEmail, memberEmails) {
    const errors = [];
    memberEmails.forEach(email => {
        try {
            AdminDirectory.Members.insert({ email, role: "MEMBER" }, groupEmail);
            Logger.log(`Successfully added ${email} to ${groupEmail}`);
        } catch (e) {
            if (e.message && e.message.includes("Member already exists")) {
                Logger.log(`Member ${email} already exists in ${groupEmail}`);
                return;
            }
            const errorMessage = `Error adding ${email}: ${e.message || JSON.stringify(e)}`;
            errors.push(errorMessage);
            Logger.log(errorMessage);
        }
    });
    if (errors.length > 0) {
        throw new Error(`Errors occurred:\n${errors.join("\n")}`);
    }
    return `Successfully added ${memberEmails.length} members to ${groupEmail}`;
}

function removeMembersFromGroup(groupEmail, memberEmails) {
    const errors = [];
    memberEmails.forEach(email => {
        try {
            AdminDirectory.Members.remove(groupKey = groupEmail, memberKey = email);
            Logger.log(`Successfully removed ${email} from ${groupEmail}`);
        } catch (e) {
            if (e.message && e.message.includes("Resource Not Found: memberKey")) {
                Logger.log(`member ${email} was not in group ${groupEmail}`);
                return;
            }
            const errorMessage = `Error removing ${email}: ${e.message || JSON.stringify(e)}`;
            errors.push(errorMessage);
            Logger.log(errorMessage);
        }
    });
    if (errors.length > 0) {
        throw new Error(`Errors occurred:\n${errors.join("\n")}`);
    }
    return `Successfully removed ${memberEmails.length} members from ${groupEmail}`;
}