
/**
 * Adds members to a Google Group using the Admin SDK API.
 *
 * @param {string} groupEmail The email address of the Google Group.
 * @param {string} memberEmails An array of email addresses to add.
 * @return {string} A success message or an error message.
 */
function addMembersToGroup(groupEmail, memberEmails) {
    const f = accumulateErrors((email) => addMemberToGroup(groupEmail, email));
    f(memberEmails);
}
function removeMembersFromGroup(groupEmail, memberEmails) {
    const f = accumulateErrors((email) => removeMemberFromGroup(groupEmail, email));
    f(memberEmails);
}

/**
 * Wraps a function to accumulate errors instead of stopping at the first error.
 * 
 * @param {Function} fn - The function to be wrapped. It should accept a single item as an argument.
 * @returns {Function} A function that takes an array of items, applies the wrapped function to each item,
 *                     and accumulates any errors that occur. If any errors are accumulated, it throws an
 *                     error containing all the error messages.
 */
function accumulateErrors(fn) {
    return function (items) {
        const errors = [];
        items.forEach(item => {
            try {
                fn(item);
            } catch (e) {
                errors.push(e.message || JSON.stringify(e));
            }
        });
        if (errors.length > 0) {
            throw new Error(`Errors occurred:\n${errors.join("\n")}`);
        }
    };
}

/**
 * Adds a single member to a Google Group using the Admin SDK API.
 *
 * @param {string} groupEmail The email address of the Google Group.
 * @param {string} memberEmail The email address of the member to add.
 * @customfunction
 */
function addMemberToGroup(groupEmail, email) {
    try {
        AdminDirectory.Members.insert({ email, role: "MEMBER" }, groupEmail);
        Logger.log(`Successfully added ${email} to ${groupEmail}`);
    } catch (e) {
        if (e.message && e.message.includes("Member already exists")) {
            Logger.log(`Member ${email} already exists in ${groupEmail}`);
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
function removeMemberFromGroup(groupEmail, memberEmail) {
    try {
        AdminDirectory.Members.remove(groupKey = groupEmail, memberKey = memberEmail);
        Logger.log(`Successfully removed ${memberEmail} from ${groupEmail}`);
    } catch (e) {
        if (e.message && e.message.includes("Resource Not Found")) {
            Logger.log(`Member ${memberEmail} does not exist in ${groupEmail}`);
        } else {
            throw e;
        }
    }
}
