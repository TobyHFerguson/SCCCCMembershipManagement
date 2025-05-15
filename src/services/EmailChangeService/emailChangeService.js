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

// Function to update the user's email (placeholder - replace with your actual logic)
function updateEmailInDatabase(oldEmail, newEmail) {
  Logger.log(`[updateEmailInDatabase]  Old Email: ${oldEmail} New Email: ${newEmail}`);
  return true;
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
    throw new Error("Failed to send email.", 500);
  }
  console.log('Verification Code sent');
  return `Verification code sent to ${newEmail}. Retrieve that code and enter it here`;
}

function handleVerifyAndUpdateEmail(originalEmail, newEmail, verificationCode) {
    console.log('handleVerifyAndUpdateEmail(originalEmail, newEmail, verificationCode): ', originalEmail, newEmail, verificationCode)
  // 1. Validate input
  if (!originalEmail) {
    throw new Error("No original email");
  }
  if (!newEmail) {
    throw new Error("No new email");
  }

  if (!verificationCode) {
    throw new Error("No verification code")
  }

  // 2. Verify the token
  const storedData = getVerificationData(verificationCode);
  if (!storedData || storedData.type !== "emailUpdate" || storedData.oldEmail !== originalEmail || storedData.newEmail !== newEmail) { // check the values
    throw new Error("Invalid or expired verification code.");
  }

  

  // 4. Update the email in the database
  const updateSuccessful = updateEmailInDatabase(originalEmail, newEmail); // Use it here
  if (!updateSuccessful) {
    throw new Error("Failed to update email.", 500);
  }

  // 5. Invalidate the token and verification code
  deleteVerificationData(verificationCode);

  return `Email changed from ${originalEmail} to ${newEmail}`
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
