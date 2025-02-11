
/**
 * Adds members to a Google Group using the Admin SDK API.
 *
 * @param {string} groupEmail The email address of the Google Group.
 * @param {string} memberEmails An array of email addresses to add.
 * @return {string} A success message or an error message.
 */
function addMembersToGroup(groupEmail, memberEmails) {
    const f = accumulateErrors((email) => addMemberToGroup_(groupEmail, email));
    f(memberEmails);
}
function removeMembersFromGroup(groupEmail, memberEmails) {
    const f = accumulateErrors((email) => removeMemberFromGroup_(groupEmail, email));
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


