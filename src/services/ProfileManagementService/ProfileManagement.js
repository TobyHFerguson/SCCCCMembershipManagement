
if (typeof require !== 'undefined') {
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

ProfileManagementService.getProfile = function (email) {
    return Commmon.Data.getMember(email);
}
ProfileManagementService.updateProfile = function (originalProfile, updatedProfile) {
    const forbiddenFields = ["Status", "Email", "Joined", "Expires", "Period", "Migrated", "Renewed On"]; // Define the fields that are forbidden to update
    ProfileManagementService._checkForForbiddenUpdates(originalProfile, updatedProfile, forbiddenFields);
    
    // Proceed with the update if no forbidden fields were modified
    return Common.Data.updateMember(email, updatedProfile);
    }

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    ProfileManagementService
  };
}