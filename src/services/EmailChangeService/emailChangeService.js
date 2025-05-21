const SCRIPT_PROP = PropertiesService.getScriptProperties();

// Function to generate a random verification code
function generateVerificationCode() {
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += Math.floor(Math.random() * 10);
  }
  return code;
}

// Function to store verification data
function storeVerificationData(newEmail, verificationCode, type, oldEmail) {
  const key = "verification_" + verificationCode;
  const value = JSON.stringify({
    newEmail: newEmail,
    code: verificationCode,
    expiry: Date.now() + 15 * 60 * 1000,
    type: type, // Add a type to distinguish token usage
    oldEmail: oldEmail
  });
  SCRIPT_PROP.setProperty(key, value);
}

// Function to retrieve verification data
function getVerificationData(verificationCode) {
  const key = "verification_" + verificationCode;
  const storedData = SCRIPT_PROP.getProperty(key);
  if (storedData) {
    const data = JSON.parse(storedData);
    if (data.expiry < Date.now()) {
      deleteVerificationData(verificationCode);
      return null;
    }
    return data;
  }
  return null;
}

// Function to delete verification data
function deleteVerificationData(verificationCode) {
  const key = "verification_" + verificationCode;
  SCRIPT_PROP.deleteProperty(key);
}

// Function to send the verification email
function sendVerificationEmail(email, code) {
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
}



function handleSendVerificationCode(newEmail, email) {
    console.log('handleSendVerificationCode(newEmail, email): ', newEmail, email)
  if (!newEmail) {
    throw new Error("Missing new email.", 400);
  }
  if (!email) {
    throw new Error("Missing original email");
  }
  // 2.  Basic email validation (This is now done in the HTML, but we keep it here for defense in depth)
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
    throw new Error("Invalid email address.", 400);
  }


  // 4. Generate and store the verification code
  const verificationCode = generateVerificationCode();
  storeVerificationData(newEmail, verificationCode, "emailUpdate", email); // Store with new token

  console.log(`verificationCode: ${verificationCode}`)
  // 5. Send the verification email
  const emailSent = sendVerificationEmail(newEmail, verificationCode);
  if (!emailSent) {
    throw new Error("Failed to send email.");
  }
  console.log('Verification Code sent');
  return `Verification code sent to ${newEmail}. Retrieve that code and enter it here`;
}

function handleVerifyAndGetGroups(originalEmail, newEmail, verificationCode) {
  console.log('handleVerifyAndGetGroups (using Directory API): ', originalEmail, newEmail, verificationCode);

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
  const storedData = getVerificationData(verificationCode);
  if (!storedData || storedData.type !== "emailUpdate" || storedData.oldEmail !== originalEmail || storedData.newEmail !== newEmail) {
    throw new Error("Invalid or expired verification code.");
  }

 // 3. Find all groups the originalEmail is a member of using listGroupsFor
  try {
    const groups = GroupSubscription.listGroupsFor(originalEmail);
    const groupData = groups.map(group => ({
      groupEmail: group.email,
      oldEmail: originalEmail,
      newEmail: newEmail,
      status: "Pending"
    }));

    // 4. Invalidate the token
    deleteVerificationData(verificationCode);

    return groupData;

  } catch (error) {
    console.error("Error retrieving group memberships using Directory API:", error);
    throw new Error("Failed to retrieve group memberships.");
  }
}

// You'll need to have these functions defined elsewhere in your Apps Script:
// - getVerificationData(verificationCode)
// - deleteVerificationData(verificationCode)


function updateUserEmailInGroup(groupEmail, originalEmail, newEmail) {
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
}

function handleChangeEmailInGroupsUI(oldEmail, newEmail, groupData) {
  var results = [];

  for (var i = 0; i < groupData.length; i++) {
    var groupEmail = groupData[i].groupEmail;
    var updateResult = updateUserEmailInGroup(groupEmail, oldEmail, newEmail);
    results.push(updateResult);
  }


  const sheetRefs = ['ActiveMembers', 'ExpirySchedule'];
  changeEmailInSpreadsheets(oldEmail, newEmail, sheetRefs)

  // Log the change
  const fiddler = Common.Data.Storage.SpreadsheetManager.getFiddler('EmailChange');
  const data = fiddler.getData();
  data.push({date: new Date(), from: oldEmail, to: newEmail})
  fiddler.setData(data).dumpValues();

  return results;
}

function changeEmailInSpreadsheets(oldEmail, newEmail, sheetRefs) {
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

function changeEmailInSpreadsheet(oldEmail, newEmail, fiddler) {
}

// Placeholder for token validation
function isValidToken(token, type) {
  const data = getVerificationData(token);
  return data !== null && data.type === type;
}

//function to get user Identifier
function getStoredUserIdentifier(token) {
  // --------------------------------------------------------------------------
  //  Replace this with your actual database lookup logic.
  //  This is a placeholder.  You'll need to adapt this to how you
  //  store user data (e.g., in a Google Sheet, a Firestore database, etc.).
  // --------------------------------------------------------------------------
  const tokenData = Common.Auth.TokenStorage.getTokenData(token)
  return tokenData.email;
}

EmailChangeService.name = "Email Change Service"
EmailChangeService.service = "EmailChangeService"
