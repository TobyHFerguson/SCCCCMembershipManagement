function testListGroups() {
    const groups = GroupSubscription.listGroupsFor('toby.ferguson@sc3.club')
    console.log(groups)
};

function testGetMember() {
    const member = GroupSubscription.getMember('tg1@sc3.club', 'membership-automation@sc3.club')
    console.log(member)
}


GroupSubscription.listGroupsFor = function (email) {
    let allGroups = [];
    const maxResults = 200;
    let pageToken = null;

    do {
        const groups = AdminDirectory.Groups.list({
            userKey: email,
            pageToken: pageToken,
            maxResults: maxResults,
        });
        if (groups && groups.groups) {
            allGroups = allGroups.concat(groups.groups);
            pageToken = groups.nextPageToken;
        }
    } while (pageToken);

    return allGroups;
}

GroupSubscription.getMember = function (groupEmail, memberEmail) {
    const member = AdminDirectory.Members.get(groupEmail, memberEmail)
    return member;
}

GroupSubscription.subscribeMember = function(member, groupEmail) {
    const newMember = AdminDirectory.Members.insert(member, groupEmail);
    console.log(`Subscribed ${member.email} to group ${groupEmail}`)
}

GroupSubscription.removeMember = function (groupEmail, userEmail) {
    try {
        AdminDirectory.Members.remove(groupEmail, userEmail);
        // Exceptions thrown when the userEmail is not part of the group
        // throws Resource Not Found when the members email is internal to the orgamization
        // throws Missing required field when the members email is external to the organization
    } catch (e) {
        // If the resource was not found then its already been deleted - we can ignore the error
        if (e.message.includes('Resource Not Found: memberKey')) {
            return;
        } else {
            throw new Error(`${e.message} when removing user ${userEmail} from group ${groupEmail}`);
        }
    }
    console.log(`Unsubscribed ${userEmail} from ${groupEmail}`);
    return true;
}

GroupSubscription.changeMembersEmail = function (groupEmail, originalEmail, newEmail)  {
    const originalMember = this.getMember(groupEmail, originalEmail);
    if (originalMember) {
        const newMember = { ...originalMember, email: newEmail }
        delete newMember.id
        this.subscribeMember(newMember, groupEmail);
        this.removeMember(groupEmail, originalEmail)
    }
}