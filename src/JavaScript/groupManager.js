
const GroupManager = (function () {
    function addMembersToGroups(members, groupEmails, groupAddFun) {
        processList(members, groupEmails, groupAddFun);
    }

    function removeMembersFromGroups(members, groupEmails, groupRemoveFun) {
        processList(members, groupEmails, groupRemoveFun);
    }

    function processList(members, groups, fun) {
        const errors = [];
        for (let i = members.length - 1; i >= 0; i--) {
            const member = members[i];
            for (let group of groups) {
                try {
                    fun(member, group);
                    members.splice(i, 1);
                } catch (error) {
                    errors.push(error);
                }
            }
        }
        if (errors.length > 0) {
            throw new AggregateError(errors, 'One or more errors occurred while processing the list');
        }
    }
    return { addMembersToGroups, removeMembersFromGroups };
})();


if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        GroupManager
    };
}