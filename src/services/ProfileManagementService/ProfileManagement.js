
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
  const userEmail = TokenManager.getEmailFromMUT(userToken);
  if (!userEmail) {
    console.warn(`Invalid or expired token: ${userToken}`);
    return JSON.stringify({ success: false, message: "Invalid session. Please refresh the page." });
  }
  if (!updatedProfile) {
    throw new Error("Original and updated profiles must be provided.");
  }
  const originalProfile = DataAccess.getMember(userEmail);
  if (!originalProfile) {
    throw new Error(`Profile not found for email: ${userEmail}`);
  }
  ProfileManagementService._checkForForbiddenUpdates(originalProfile, updatedProfile, forbiddenFields);
  console.log('originalProfile', originalProfile);
  console.log('updatedProfile', updatedProfile);
  updatedProfile = {...originalProfile, ...updatedProfile}; // Merge original and updated profiles
  console.log('mergedProfile', updatedProfile);

  // Proceed with the update if no forbidden fields were modified
  DataAccess.updateMember(userEmail, updatedProfile);
  return { success: true, message: "Profile updated successfully." };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    //@ts-ignore
    ProfileManagementService
  };
}