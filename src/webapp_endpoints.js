function sendMagicLink(email, service) {
  console.log('sendMagicLink(', email, service, ')')
  email = email.toLowerCase().trim(); // Normalize the email address
  return Common.Auth.Utils.sendMagicLink(email, service)
}

/**
 * Send a verification code to the user's email address.
 * This is the new authentication flow for SPA services.
 * 
 * @param {string} email - The user's email address
 * @param {string} service - The service identifier (e.g., 'GroupManagementService')
 * @returns {{success: boolean, error?: string}} Result of the operation
 */
function sendVerificationCode(email, service) {
  console.log('sendVerificationCode(', email, service, ')');
  
  // Normalize the email address
  email = email.toLowerCase().trim();
  
  // Check if the email is a valid active member
  const validEmails = Common.Data.Access.getEmailAddresses();
  if (!validEmails.includes(email)) {
    // Act as if we sent the code (security: don't reveal if email exists)
    console.log('sendVerificationCode: email not found in active members, returning success (security)');
    return { success: true };
  }
  
  // Get the service name for the email
  const serviceName = WebServices[service] ? WebServices[service].name : service;
  
  // Request verification code (generates + sends email)
  const result = Common.Auth.VerificationCode.requestCode(email, serviceName, service);
  
  return result;
}

/**
 * Verify a user-provided verification code.
 * On success, returns a redirect URL with a multi-use token.
 * 
 * @param {string} email - The user's email address
 * @param {string} code - The 6-digit verification code
 * @param {string} service - The service identifier
 * @returns {{success: boolean, redirectUrl?: string, error?: string}} Result with redirect URL on success
 */
function verifyCode(email, code, service) {
  console.log('verifyCode(', email, service, ')');
  
  // Normalize the email address
  email = email.toLowerCase().trim();
  
  // Verify the code
  const result = Common.Auth.VerificationCode.verify(email, code);
  
  if (!result.success) {
    return result;
  }
  
  // Generate a multi-use token for the session
  const token = Common.Auth.TokenManager.getMultiUseToken(email);
  
  // Store a single-use token in TokenStorage for initial page load
  // This ensures backward compatibility with services expecting TokenStorage tokens
  const singleUseToken = Common.Auth.TokenStorage.generateAndStoreToken(email);
  
  // Build redirect URL with the token
  const baseUrl = ScriptApp.getService().getUrl();
  const redirectUrl = baseUrl + '?token=' + singleUseToken + '&service=' + service;
  
  console.log('verifyCode: success, redirecting to', redirectUrl);
  
  return {
    success: true,
    redirectUrl: redirectUrl,
    token: token  // Also return the multi-use token for SPAs
  };
}

/**
 * Refresh a session token.
 * Extends the expiration of an existing multi-use token.
 * 
 * @param {string} token - The current multi-use token
 * @returns {{success: boolean, token?: string, error?: string}} Result with new token on success
 */
function refreshSession(token) {
  console.log('refreshSession called');
  
  // Get the email from the current token
  const email = Common.Auth.TokenManager.getEmailFromMUT(token);
  
  if (!email) {
    return {
      success: false,
      error: 'Invalid or expired session',
      errorCode: 'INVALID_TOKEN'
    };
  }
  
  // Generate a new multi-use token
  const newToken = Common.Auth.TokenManager.getMultiUseToken(email);
  
  console.log('refreshSession: success for', email);
  
  return {
    success: true,
    token: newToken
  };
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

/**
 * Handle API requests for SPA services.
 * This is the main entry point for google.script.run API calls.
 * 
 * @param {Object} request - The API request object
 * @param {string} request.action - The action to perform
 * @param {Object} [request.params] - Action parameters
 * @param {string} [request.token] - Authentication token
 * @returns {string} JSON-encoded API response
 */
function handleApiRequest(request) {
  console.log('handleApiRequest:', request && request.action);
  
  // Initialize API handlers if not already done
  if (typeof GroupManagementService.initApi === 'function') {
    GroupManagementService.initApi();
  }
  
  // Handle the request
  return Common.Api.Client.handleRequest(request);
}