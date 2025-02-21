function removeMemberFromGroup_(groupId, userEmail) {
    try {
      GroupsApp.getGroupById(groupId).removeMember(userEmail);
      Logger.log('User ' + userEmail + ' removed from group ' + groupId);
      return true; // Indicate success
    } catch (error) {
      Logger.log('Error removing user: ' + error);
      return false; // Indicate failure
    }
  }
  
  // Example usage:
  function testRemoveMember() {
    var groupId = 'YOUR_GROUP_ID'; // Replace with the actual group ID
    var userEmail = 'user@example.com'; // Replace with the user's email
  
    var success = removeMemberFromGroup_(groupId, userEmail);
  
    if (success) {
      Logger.log("Removal successful!");
    } else {
      Logger.log("Removal failed.");
    }
  }

  function findGroupIdByEmail_(groupEmail) {
    try {
      var group = GroupsApp.getGroupByEmail(groupEmail);
      return group.getId();
    } catch (error) {
      Logger.log('Error finding group: ' + error);
      return null;
    }
  }
  
  function testFindGroupId() {
    var groupEmail = 'board_announcements@sc3.club'; // Replace with the group's email
    var groupId = findGroupIdByEmail_(groupEmail);
  
    if (groupId) {
      Logger.log('Group ID: ' + groupId);
    } else {
      Logger.log('Group not found.');
    }
  }