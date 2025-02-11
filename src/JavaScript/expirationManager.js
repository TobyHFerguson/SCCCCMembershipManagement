if (typeof require !== 'undefined') {
    var {ActionType }= require('./triggers');
}

const ExpirationManager = (function () {
    function expireMembers(expiringMembersQueue, membershipData, groupRemoveList, emailSendList) {
        let numProcessed = 0;
        if (!expiringMembersQueue || expiringMembersQueue.length === 0) {
            return numProcessed;
        }
        for (i = expiringMembersQueue.length - 1; i >= 0; i--) {
            const member = expiringMembersQueue[i];
            const memberIndex = membershipData.findIndex(m => m.Email === member.Email);
            if (memberIndex === -1) {
                console.log(`Member ${member.Email} is supposed to be expiring but they're not found in membership data`);
                continue;
            }
            const memberData = membershipData[memberIndex];
            membershipData.splice(memberIndex, 1);
            groupRemoveList.push(memberData);
            emailSendList.push({ Email: memberData.Email, Type: ActionType.Expiry4 });
            expiringMembersQueue.splice(i, 1);
            numProcessed += 1;
        }
        return numProcessed
    }

    return {
        expireMembers,
    };
})();

if (typeof module !== 'undefined') {
    module.exports = ExpirationManager;
}
