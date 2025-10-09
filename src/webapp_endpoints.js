function sendMagicLink(email, service) {
  console.log('sendMagicLink(', email, service, ')')
  email = email.toLowerCase().trim(); // Normalize the email address
  return Common.Auth.Utils.sendMagicLink(email, service)
}

function getDirectoryEntries() {
  return JSON.stringify(DirectoryService.getDirectoryEntries())
}

function processForm(form) {
  return EmailService.sendTestEmail(form)
}

function handleChangeEmailInGroupsUI(originalEmail, newEmail, groupMembershipData) {
  return EmailChangeService.handleChangeEmailInGroupsUI(originalEmail, newEmail, groupMembershipData)
}

function handleVerifyAndGetGroups(originalEmail, newEmail, verificationCode) {
  return EmailChangeService.handleVerifyAndGetGroups(originalEmail, newEmail, verificationCode);
}

function handleSendVerificationCode(newEmail, originalEmail) {
  return EmailChangeService.handleSendVerificationCode(newEmail, originalEmail)
}

function updateUserSubscriptions(updatedSubscriptions, userToken) {
    const response = GroupManagementService.WebApp.updateUserSubscriptions(updatedSubscriptions, userToken);
    return response;
}

function updateProfile(userToken, updatedProfile ) {
    return ProfileManagementService.updateProfile(userToken, updatedProfile);
}

function isMember(email) {
    return ElectionRegistrationService.isMember(email);
}