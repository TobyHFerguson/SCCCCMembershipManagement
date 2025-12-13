function testListGroups() {
  const groups = GroupSubscription.listGroupsFor('toby.ferguson@sc3.club')
  console.log(groups)
};

function testGetMember() {
  const member = GroupSubscription.getMember('tg1@sc3.club', 'membership-automation@sc3.club')
  console.log(member)
}
// deliveryOptions links the value that GAS expects (as a key) to the human readable text that is displayed in the UI
// and the description that is displayed in the tooltip.
GroupSubscription.deliveryOptions = {
  "UNSUBSCRIBE": ["Unsubscribed", "Not subscribed to the group"],
  "ALL_MAIL": ["Each message", "Receive an email for every message"],
  "DAILY": ["Abridged", "Receive abridged, bundled emails (max 150 messages, at least once a day)"],
  "DIGEST": ["Digest", "Receive bundled emails (max 25 messages)"],
  "NONE": ["None", "Do not receive emails; read via the web app"]
};

GroupSubscription.hasMember = function (groupEmail, memberEmail) {
  const groups = GroupSubscription.listGroupsFor(memberEmail)
  return groups.map(g => g.email).includes(groupEmail)
}

GroupSubscription.updateMember = function (member, groupEmail) {
  return AdminDirectory.Members.update(member, groupEmail, member.email)
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
  try {
    const member = AdminDirectory.Members.get(groupEmail, memberEmail)
    return member;
  }
  catch (e) {
    if (e.message.includes('Resource Not Found:')) {
      return null;
    }
    e += ` when getting member ${memberEmail} from group ${groupEmail}`;
    throw e;
  }
}

GroupSubscription.subscribeMember = function (member, groupEmail) {
  try {
    const newMember = AdminDirectory.Members.insert(member, groupEmail);
    console.log(`Subscribed ${member.email} to group ${groupEmail}`)
  } catch (e) {
    // Skip if member already exists
    if (e.message.includes('Member already exists')) {
      return;
    }
    e.message += ` when subscribing user ${member.email} to group ${groupEmail}`;
    throw e;
  }

}

GroupSubscription.removeMember = function (groupEmail, userEmail) {
  try {
    AdminDirectory.Members.remove(groupEmail, userEmail);
    // Exceptions thrown when the userEmail is not part of the group
    // throws Resource Not Found when the members email is internal to the orgamization
    // throws Missing required field when the members email is external to the organization
  } catch (e) {
    // If the resource was not found then its already been deleted - we can ignore the error
    // This includes a group that is unknown!
    if (e.message.includes('Resource Not Found:')) {
      return;
    } else {
      e.message += ` when removing user ${userEmail} from group ${groupEmail}`;
      throw e;
    }
  }
  console.log(`Unsubscribed ${userEmail} from ${groupEmail}`);
  return true;
}

GroupSubscription.changeMembersEmail = function (groupEmail, originalEmail, newEmail) {
  const originalMember = this.getMember(groupEmail, originalEmail);
  if (originalMember) {
    const newMember = { ...originalMember, email: newEmail }
    delete newMember.id
    this.subscribeMember(newMember, groupEmail);
    this.removeMember(groupEmail, originalEmail)
  }
}