EmailService.sendTestEmail =  function(form) {
    console.log('send test email', form)
  var emailAddress = form.emailAddress;
  console.log('selectedKeys', form.selectedKeys);
  var selectedKeys = Array.isArray(form.selectedKeys) ? form.selectedKeys : [form.selectedKeys]; // Ensure selectedKeys is always an array
  var actionSpecs = Common.Data.Access.getActionSpecs(); // Assuming this function returns the ActionSpecs object

  selectedKeys.forEach(function (key) {
    spec = actionSpecs[key];
    if (spec) {
      const member = {
        First: 'John',
        Last: 'Doe',
        Joined: '2020-01-01',
        Expires: '2021-01-01',
        Period: 1,
        Directory: 'Yes',
        Phone: '123-456-7890',
        'Renewed On': '2020-12-31',
        Migrated: '2020-01-01',
        Email: emailAddress
      };

      const message = {
        to: member.Email,
        subject: MembershipManagement.Utils.expandTemplate(spec.Subject, member),
        htmlBody: MembershipManagement.Utils.expandTemplate(spec.Body, member)
      };
      console.log(message);
      MailApp.sendEmail(message);
    }
  });
}