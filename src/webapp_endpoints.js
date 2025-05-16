function sendMagicLink(email, service) {
  console.log('sendMagicLink(', email, service,')')
  email = email.toLowerCase().trim(); // Normalize the email address
  return Common.Auth.Utils.sendMagicLink(email, service)
}

function getDirectoryEntries() {
  return JSON.stringify(DirectoryService.getDirectoryEntries())
}

function processForm(form) {
  EmailService.sendTestEmail(form)
}