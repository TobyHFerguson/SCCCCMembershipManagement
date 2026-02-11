
if (typeof require !== 'undefined') {
  //@ts-ignore
  ProfileManagementService = {};
}
ProfileManagementService._checkForForbiddenUpdates = function (originalObject, updatedObject, forbiddenFields) {
  for (const field of forbiddenFields) {
    if (updatedObject.hasOwnProperty(field) &&
      originalObject.hasOwnProperty(field) &&
      updatedObject[field] !== originalObject[field]) {
      throw new Error(`Update to forbidden field: ${field}`);
    } else if (updatedObject.hasOwnProperty(field) &&
      !originalObject.hasOwnProperty(field)) {
      throw new Error(`Addition of forbidden field: ${field}`);
    }
  }

  // Check if any *other* fields have been updated
  for (const key in updatedObject) {
    if (updatedObject.hasOwnProperty(key) && !forbiddenFields.includes(key)) {
      if (!originalObject.hasOwnProperty(key) || updatedObject[key] !== originalObject[key]) {
        return; // Other fields were updated, no exception
      }
    }
  }

  // If we reach here, only the non-forbidden fields (if any) remain unchanged.
  // Now, check if any non-forbidden fields were *removed*
  for (const key in originalObject) {
    if (originalObject.hasOwnProperty(key) && !forbiddenFields.includes(key) && !updatedObject.hasOwnProperty(key)) {
      return; // Other fields were updated (removed), no exception
    }
  }

  // If no other fields were added, removed, or changed, then only forbidden fields
  // (if any) might have been changed (and we already threw errors for those).
  // Therefore, if we reach here, no *other* fields were updated.
  return; // Only allowed updates (or no updates)
}

ProfileManagementService.updateProfile = function (userToken, updatedProfile) {
  const forbiddenFields = ["Status", "Email", "Joined", "Expires", "Period", "Migrated", "Renewed On"]; // Define the fields that are forbidden to update
  try {
    const userEmail = TokenManager.getEmailFromMUT(userToken);
    if (!userEmail) {
      AppLogger.warn('ProfileManagementService', `updateProfile: Invalid or expired token`);
      return { success: false, message: "Invalid session. Please refresh the page." };
    }
    if (!updatedProfile) {
      AppLogger.error('ProfileManagementService', 'updateProfile: No updated profile provided');
      return { success: false, message: "Profile updates must be provided." };
    }
    const originalProfile = DataAccess.getMember(userEmail);
    if (!originalProfile) {
      AppLogger.error('ProfileManagementService', `updateProfile: Profile not found for email: ${userEmail}`);
      return { success: false, message: "Profile not found." };
    }
    ProfileManagementService._checkForForbiddenUpdates(originalProfile, updatedProfile, forbiddenFields);
    const mergedProfile = {...originalProfile, ...updatedProfile};

    // Proceed with the update if no forbidden fields were modified
    DataAccess.updateMember(userEmail, mergedProfile);
    return { success: true, message: "Profile updated successfully." };
  } catch (error) {
    AppLogger.error('ProfileManagementService', `updateProfile failed: ${error.message}`, error);
    return { success: false, message: "Failed to update profile: " + error.message };
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    //@ts-ignore
    ProfileManagementService
  };
}