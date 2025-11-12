// Guarded initializer for EmailService
if (typeof EmailService === 'undefined') {
  // @ts-ignore - create global namespace in GAS environment
  var EmailService = { Menu: {} };
}

EmailService.sendTestEmail = function (form) {
  const lookupEmail = form.lookupEmail;
  const sendToEmail = form.sendToEmail;
  const selectedKeys = Array.isArray(form.selectedKeys) ? form.selectedKeys : [form.selectedKeys]; // Ensure selectedKeys is always an array

  const actionSpecs = Common.Data.Access.getActionSpecs(); // Assuming this function returns the ActionSpecs object

  const member = Common.Data.Access.getMember(lookupEmail);
  if (!member) {
    console.error(`sending an email but the member ${lookupEmail} was not found`)
    return;
  }
  let spec;
  selectedKeys.forEach(function (key) {
    spec = actionSpecs[key];
    if (spec) {
      const message = {
        to: sendToEmail,
        subject: MembershipManagement.Utils.expandTemplate(spec.Subject, member),
        htmlBody: MembershipManagement.Utils.expandTemplate(spec.Body, member)
      };
      console.log(message);
      MailApp.sendEmail(message);
    }
  });
}