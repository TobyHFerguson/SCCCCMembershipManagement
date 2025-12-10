const SCRIPT_PROP = PropertiesService.getScriptProperties();


EmailChangeService.handleSendVerificationCode = function (originalEmail, newEmail) {
  console.log('handleSendVerificationCode(originalEmail, newEmail): ', originalEmail, newEmail)
  if (!newEmail) {
    throw new Error("Missing new email.");
  }
  if (!originalEmail) {
    throw new Error("Missing original email");
  }
  // 2.  Basic email validation (This is now done in the HTML, but we keep it here for defense in depth)
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
    throw new Error("Invalid email address.");
  }


  // 4. Generate and store the verification code
  const verificationCode = EmailChangeService.Internal._generateVerificationCode();
  EmailChangeService.Internal.storeVerificationData(newEmail, verificationCode, "emailUpdate", originalEmail); // Store with new token

  console.log(`verificationCode: ${verificationCode}`)
  // 5. Send the verification email
  const emailSent = EmailChangeService.Internal.sendVerificationEmail(newEmail, verificationCode);
  if (!emailSent) {
    throw new Error("Failed to send email.");
  }
  console.log('Verification Code sent');
  return `Verification code sent to ${newEmail}. Retrieve that code and enter it here`;
}

EmailChangeService.handleVerifyAndGetGroups = function (originalEmail, newEmail, verificationCode) {
  console.log('handleVerifyAndGetGroups (originalEmail, newEmail, verificationCode): ', originalEmail, newEmail, verificationCode);

  // 1. Validate input
  if (!originalEmail) {
    throw new Error("No original email provided.");
  }
  if (!newEmail) {
    throw new Error("No new email provided.");
  }
  if (!verificationCode) {
    throw new Error("No verification code provided.");
  }

  // 2. Verify the token
  const storedData = EmailChangeService.Internal.getVerificationData(verificationCode);
  if (!storedData || storedData.type !== "emailUpdate" || storedData.oldEmail !== originalEmail || storedData.newEmail !== newEmail) {
    throw new Error("Invalid or expired verification code.");
  }

  // 3. Find all groups the originalEmail is a member of using listGroupsFor
  try {
    const groups = GroupSubscription.listGroupsFor(originalEmail);
    const groupData = groups.map(function(group) {
      /** @type {'Pending' | 'Success' | 'Failed'} */
      var status = "Pending";
      return {
        groupEmail: group.email,
        oldEmail: originalEmail,
        newEmail: newEmail,
        status: status
      };
    });

    // 4. Invalidate the token
    EmailChangeService.Internal.deleteVerificationData(verificationCode);

    return groupData;

  } catch (error) {
    console.error("Error retrieving group memberships using Directory API:", error);
    throw new Error("Failed to retrieve group memberships.");
  }
}

EmailChangeService.handleChangeEmailInGroupsUI = function (oldEmail, newEmail, groupData) {
  var results = [];

  for (var i = 0; i < groupData.length; i++) {
    var groupEmail = groupData[i].groupEmail;
    var updateResult = EmailChangeService.Internal.updateUserEmailInGroup(groupEmail, oldEmail, newEmail);
    results.push(updateResult);
  }


  const sheetRefs = ['ActiveMembers', 'ExpirySchedule'];
  EmailChangeService.Internal.changeEmailInSpreadsheets(oldEmail, newEmail, sheetRefs)

  // Log the change
  const fiddler = Common.Data.Storage.SpreadsheetManager.getFiddler('EmailChange');
  const data = fiddler.getData();
  data.push({ date: new Date(), from: oldEmail, to: newEmail })
  fiddler.setData(data).dumpValues();

  return results;
}

EmailChangeService.Internal = {
  // Function to generate a random verification code
  _generateVerificationCode: function () {
    let code = "";
    for (let i = 0; i < 6; i++) {
      code += Math.floor(Math.random() * 10);
    }
    return code;
  },

  // Function to store verification data
  storeVerificationData: function (newEmail, verificationCode, type, oldEmail) {
    const key = "verification_" + verificationCode;
    const value = JSON.stringify({
      newEmail: newEmail,
      code: verificationCode,
      expiry: Date.now() + 15 * 60 * 1000,
      type: type, // Add a type to distinguish token usage
      oldEmail: oldEmail
    });
    SCRIPT_PROP.setProperty(key, value);
  },

  // Function to retrieve verification data
  getVerificationData: function (verificationCode) {
    const key = "verification_" + verificationCode;
    const storedData = SCRIPT_PROP.getProperty(key);
    if (storedData) {
      const data = JSON.parse(storedData);
      if (data.expiry < Date.now()) {
        EmailChangeService.Internal.deleteVerificationData(verificationCode);
        return null;
      }
      return data;
    }
    return null;
  },

  // Function to delete verification data
  deleteVerificationData: function (verificationCode) {
    const key = "verification_" + verificationCode;
    SCRIPT_PROP.deleteProperty(key);
  },

  // Function to send the verification email
  sendVerificationEmail: function (email, code) {
    const subject = "Verify Your New Email Address";
    const body = `
    <p>Your verification code is: <strong>${code}</strong></p>
    <p>This code will expire in 15 minutes.</p>
    <p>If you did not request this email change, please ignore this message.</p>
  `;
    const htmlBody = body;

    try {
      MailApp.sendEmail({
        to: email,
        subject: subject,
        htmlBody: htmlBody,
      });
      return true;
    } catch (error) {
      Logger.log(`Error sending verification email: ${error}`);
      return false;
    }
  },
  updateUserEmailInGroup: function (groupEmail, originalEmail, newEmail) {
    /** @type {'Pending' | 'Success' | 'Failed'} */
    var status = "Pending";
    var error = null;

    try {
      GroupSubscription.changeMembersEmail(groupEmail, originalEmail, newEmail)
      status = 'Success'
    } catch (e) {
      status = "Failed";
      error = e.message;
      Logger.log(`Error changing members email from ${originalEmail} to ${newEmail} in group ${groupEmail}: ${e}`);
    }

    return { groupEmail: groupEmail, status: status, error: error };
  },

  changeEmailInSpreadsheets: function (oldEmail, newEmail, sheetRefs) {
    for (const ref of sheetRefs) {
      const fiddler = Common.Data.Storage.SpreadsheetManager.getFiddler(ref);
      fiddler.mapRows((row) => {
        if (row.Email.toLowerCase() === oldEmail.toLowerCase()) {
          row.Email = newEmail.toLowerCase()
        }
        return row;
      })
      fiddler.dumpValues()
    }
  }
}
