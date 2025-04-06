function getActiveGroupSettings_(groupEmails) {
  /**
   * Fetches settings for specified Google Groups using the Group Settings API,
   * filtering out settings with "deprecated" in their description.
   *
   * @param {string[]} groupEmails An array of Google Group email addresses.
   * @returns {object} A dictionary where keys are group email addresses and values are dictionaries
   * containing the active group settings, or null if an error occurs.
   */

  const deprecatedSettings = [
    "whoCanInvite",
    "whoCanAdd",
    "maxMessageBytes",
    "showInGroupDirectory",
    "allowGoogleCommunication",
    "messageDisplayFont",
    "whoCanAddReferences",
    "whoCanAssignTopics",
    "whoCanUnassignTopic",
    "whoCanTakeTopics",
    "whoCanMarkDuplicate",
    "whoCanMarkNoResponseNeeded",
    "whoCanMarkFavoriteReplyOnAnyTopic",
    "whoCanMarkFavoriteReplyOnOwnTopic",
    "whoCanUnmarkFavoriteReplyOnAnyTopic",
    "whoCanEnterFreeFormTags",
    "whoCanModifyTagsAndCategories",
    "whoCanApproveMembers",
    "whoCanBanUsers",
    "whoCanModifyMembers",
    "whoCanApproveMessages",
    "whoCanDeleteAnyPost",
    "whoCanDeleteTopics",
    "whoCanLockTopics",
    "whoCanMoveTopicsIn",
    "whoCanMoveTopicsOut",
    "whoCanPostAnnouncements",
    "whoCanHideAbuse",
    "whoCanMakeTopicsSticky"
  ]
  var results = {};

  for (var i = 0; i < groupEmails.length; i++) {
    var groupEmail = groupEmails[i];
    try {
      var allSettings = GroupsSettings.Groups.get(groupEmail);
      deprecatedSettings.forEach(setting => delete allSettings[setting]);

      results[groupEmail] = allSettings;
    } catch (e) {
      Logger.log("Error fetching settings for " + groupEmail + ": " + e);
      results[groupEmail] = null; // Indicate failure for this specific group.
    }
  }

  return results;
}



function testGetActiveGroupSettings() {
  // Replace with your group emails:
  var groupEmailsToFetch = ["board_announcements@sc3.club"];

  var groupSettings = getActiveGroupSettings_(groupEmailsToFetch);

  if (groupSettings) {
    for (var group in groupSettings) {
      if (groupSettings[group]) {
        Logger.log("Active settings for " + group + ":");
        const settings = groupSettings[group];
        const keys = Object.keys(settings).sort();
        console.log(`#keys: ${keys.length}`);
        for (const key in keys) {
          Logger.log("  " + key + ": " + settings[key]);
        }
      } else {
        Logger.log("Could not retrieve settings for " + group);
      }
    }
  } else {
    Logger.log("Failed to retrieve group settings.");
  }
}


function writeGroupEmailSettingsByType() {
  const groupsByType = ConfigurationManager.getFiddler('GroupsByType');

  const settingsToBeWritten = groupsByType.map(gbt => {
    const settings = getActiveGroupSettings(gbt.email)[0];
    settings.type = gbt.type;
    return settings;
  });
  const groupSettingsFiddler = ConfigurationManager.getFiddler('GroupSettings');
  groupSettingsFiddler.setData(settingsToBeWritten).dumpValues();
}

function updateGroupsFromGroupSettings() {
  const groups = ConfigurationManager.getFiddler('GroupSettings').getData()
 groups.filter(group => group.email === 'rides@sc3.club').forEach(group => GroupsSettings.Groups.update(group, group.email))
}


