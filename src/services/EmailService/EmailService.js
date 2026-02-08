EmailService.sendTestEmail = function (form) {
  const lookupEmail = form.lookupEmail;
  const sendToEmail = form.sendToEmail;
  const selectedKeys = Array.isArray(form.selectedKeys) ? form.selectedKeys : [form.selectedKeys]; // Ensure selectedKeys is always an array

  const actionSpecs = DataAccess.getActionSpecs(); // Assuming this function returns the ActionSpecs object

  const member = DataAccess.getMember(lookupEmail);
  if (!member) {
    console.error(`sending an email but the member ${lookupEmail} was not found`)
    return;
  }
  selectedKeys.forEach(function (key) {
    let spec = actionSpecs[key];
    if (spec) {
      const message = {
        to: sendToEmail,
        subject: MembershipManagement.Utils.expandTemplate(spec.Subject, member),
        // Body is converted to string during DataAccess.getActionSpecs() processing
        htmlBody: MembershipManagement.Utils.expandTemplate(/** @type {string} */ (spec.Body), member)
      };
      console.log(message);
      MailApp.sendEmail(message);
    }
  });
}