function testGetUserGroupSubscriptions() {
    const userEmail = "membership-automation@sc3.club"
    const userGroupSubscription = getUserGroupSubscription(userEmail);
    console.log("User Group Subscription:", JSON.stringify(userGroupSubscription, null, 2));
}

function testUpdateUserSubscriptions() {
    const userEmail = "membership-automation@sc3.club"
    const updatedSubscriptions = [
        {
            "groupName": "Test Group 1",
            "groupEmail": "tg1@sc3.club",
            "deliveryValue": "UNSUBSCRIBE",
            "deliveryName": "ALL_MAIL"
        },
        {
            "groupName": "Test Group 2",
            "groupEmail": "tg2@sc3.club",
            "deliveryValue": "UNSUBSCRIBE",
            "deliveryName": "UNSUBSCRIBED"
        },
        {
            "groupName": "Test Group 3",
            "groupEmail": "tg3@sc3.club",
            "deliveryValue": "DAILY",
            "deliveryName": "DAILY"
        }
    ]
    GroupManagementService.updateUserSubscriptions(updatedSubscriptions, userEmail);
}

GroupManagementService.getUserGroupSubscription = function(userEmail) {
    const groups = [
        // { name: "Ride Announcements", email: "ride-announcements@example.com" },
        // { name: "Member Discussions", email: "member-discussions@example.com" },
        // { name: "A Group Discussions", email: "a-group-discussions@example.com" },
        // { name: "Board Announcements", email: "board-announcements@example.com" },
        { name: "Test Group 1", email: "tg1@sc3.club" },
        { name: "Test Group 2", email: "tg2@sc3.club" },
        { name: "Test Group 3", email: "tg3@sc3.club" },
    ]
    const userGroupSubscription = groups.map(group => {
        const member = GroupSubscription.getMember(group.email, userEmail);
        if (member) {
            return {
                groupName: group.name,
                groupEmail: group.email,
                deliveryValue: member.delivery_settings,
                deliveryName: GroupSubscription.deliveryOptions[member.delivery_settings][0] // Add the human-readable name
            };
        } else {
            return {
                groupName: group.name,
                groupEmail: group.email,
                deliveryValue: "UNSUBSCRIBE",
                deliveryName: "UNSUBSCRIBED"
            };
        }
    });
    return userGroupSubscription;
}



GroupManagementService.updateUserSubscriptions = function (updatedSubscriptions, userEmail) {
    
    for (const subscription of updatedSubscriptions) {
        const member = GroupSubscription.getMember(subscription.groupEmail, userEmail);

        if (subscription.deliveryValue === "UNSUBSCRIBE") {
            GroupSubscription.removeMember(subscription.groupEmail, userEmail);
        } else {
            if (member) {
                member.delivery_settings = subscription.deliveryValue;
                GroupSubscription.updateMember(member, subscription.groupEmail);
            } else {
                const newMember = {
                    email: userEmail,
                    delivery_settings: subscription.deliveryValue
                };
                GroupSubscription.subscribeMember(newMember, subscription.groupEmail);
            }
        }
    }
    console.log(`GroupManagementService.updateUserSubscriptions(${JSON.stringify(updatedSubscriptions)}, ${userEmail}) was successful`);
    // **IMPORTANT:** Implement your actual logic here to update the user's
    // subscriptions in your data storage, using the 'userEmail' to identify the user
    // and the 'updatedSubscriptions' data (which now contains the underlying values).

    // Cleanup: Cache will expire automatically
    return { success: true, message: "Subscriptions updated successfully" };
}