function getGroupSettings_(groupEmails) {
  /**
   * Fetches settings for specified Google Groups using the Group Settings API.
   *
   * @param {string[]} groupEmails An array of Google Group email addresses.
   * @returns {object} A dictionary where keys are group email addresses and values are dictionaries
   * containing the group settings, or null if an error occurs.
   */

  var results = {};

  for (var i = 0; i < groupEmails.length; i++) {
    var groupEmail = groupEmails[i];
    try {
      var settings = GroupsSettings.Groups.get(groupEmail);
      results[groupEmail] = settings;
    } catch (e) {
      Logger.log("Error fetching settings for " + groupEmail + ": " + e);
      results[groupEmail] = null; // Indicate failure for this specific group.
    }
  }

  return results;
}

function testGetGroupSettings() {
  // Replace with your group emails:
  var groupEmailsToFetch = ["board_announcements@sc3.club"];

  var groupSettings = getGroupSettings_(groupEmailsToFetch);

  if (groupSettings) {
    for (var groupEmail in groupSettings) {
      if (groupSettings[groupEmail]) {
        Logger.log("Settings for " + groupEmail + ":");
        var settings = groupSettings[groupEmail];
        const keys = Object.keys(settings).sort()
        for (var key in settings) {
          Logger.log("  " + key + ": " + settings[key]);
        }
      } else {
        Logger.log("Could not retrieve settings for " + groupEmail);
      }
    }
  } else {
    Logger.log("Failed to retrieve group settings.");
  }
}

// Enable the Advanced Google Services:
// 1. In the Apps Script editor, go to "Resources" > "Advanced Google services...".
// 2. Enable the "Groups Settings API".
// 3. Click "Google Cloud Platform project" at the bottom.
// 4. In the Cloud Console, ensure the Groups Settings API is enabled for your project.
