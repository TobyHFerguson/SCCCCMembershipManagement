function testGetUserGroupSubscriptions() {
    const userEmail = "membership-automation@sc3.club"
    const userGroupSubscription = GroupManagementService.getUserGroupSubscription(userEmail);
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

/**
 * Get user's group subscriptions
 * Uses Manager class for pure business logic
 * 
 * @param {string} userEmail - User's email address
 * @returns {GroupManagementService.GroupSubscription[]} Array of subscription objects
 */
GroupManagementService.getUserGroupSubscription = function(userEmail) {
    // PURE: Normalize email
    const normalizedEmail = GroupManagementService.Manager.normalizeEmail(userEmail);
    
    // GAS: Get public groups
    const groups = DataAccess.getPublicGroups();
    
    // GAS: Get member data for each group
    /** @type {Record<string, GroupManagementService.GroupMember|null>} */
    const membersByGroup = {};
    groups.forEach(group => {
        const member = GroupSubscription.getMember(group.Email, normalizedEmail);
        // @ts-ignore - GAS Admin SDK Member type has optional email, but at runtime email is always present
        membersByGroup[group.Email] = member;
    });
    
    // PURE: Build subscriptions using Manager
    // @ts-ignore - GroupSubscription.deliveryOptions returns string[] but Manager expects [string, string] tuples - compatible at runtime
    const subscriptions = GroupManagementService.Manager.buildUserSubscriptions(groups, membersByGroup, GroupSubscription.deliveryOptions);
    
    return subscriptions;
}



GroupManagementService.updateUserSubscriptions = function (updatedSubscriptions, userEmail) {
    // PURE: Normalize email
    const normalizedEmail = GroupManagementService.Manager.normalizeEmail(userEmail);
    
    // GAS: Get current member status for each group
    /** @type {Record<string, GroupManagementService.GroupMember|null>} */
    const currentMembersByGroup = {};
    for (const subscription of updatedSubscriptions) {
        const member = GroupSubscription.getMember(subscription.groupEmail, normalizedEmail);
        // @ts-ignore - GAS Admin SDK Member type has optional email, but at runtime email is always present
        currentMembersByGroup[subscription.groupEmail] = member;
    }
    
    // PURE: Calculate actions using Manager
    const { actions } = GroupManagementService.Manager.calculateActions(
        updatedSubscriptions,
        currentMembersByGroup,
        normalizedEmail
    );
    
    // GAS: Execute actions
    for (const action of actions) {
        switch (action.action) {
            case 'unsubscribe':
                GroupSubscription.removeMember(action.groupEmail, action.userEmail);
                break;
            case 'subscribe':
                const newMember = {
                    email: action.userEmail,
                    delivery_settings: action.deliveryValue
                };
                GroupSubscription.subscribeMember(newMember, action.groupEmail);
                break;
            case 'update':
                const member = GroupSubscription.getMember(action.groupEmail, action.userEmail);
                if (member) {
                    member.delivery_settings = action.deliveryValue;
                    GroupSubscription.updateMember(member, action.groupEmail);
                }
                break;
        }
    }
    
    console.log(`GroupManagementService.updateUserSubscriptions(${JSON.stringify(updatedSubscriptions)}, ${userEmail}) was successful`);

    // Cleanup: Cache will expire automatically
    return { success: true, message: "Subscriptions updated successfully" };
}