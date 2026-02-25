/**
 * Send a verification code to the user's email address.
 * This is the new authentication flow for SPA services.
 * 
 * CRITICAL: Returns the server-normalized email on success so client uses
 * the exact same email as the cache key. This prevents "No verification code found"
 * errors caused by normalization differences between client and server.
 * 
 * @param {string} email - The user's email address
 * @param {string} service - The service identifier (e.g., 'GroupManagementService')
 * @returns {{success: boolean, email?: string, error?: string}} Result with normalized email on success
 */
function sendVerificationCode(email, service) {
  console.log('sendVerificationCode(', email, service, ')');
  AppLogger.configure();
  AppLogger.info('WebApp', 'sendVerificationCode() called', { email, service });
  
  // Normalize the email address
  email = email.toLowerCase().trim();
  
  // Create audit logger for verification attempts
  const logger = new ServiceLogger('Authentication', email);
  const auditEntries = [];
  
  // Check if the email is a valid active member
  const validEmails = DataAccess.getEmailAddresses();
  if (!validEmails.includes(email)) {
    // Act as if we sent the code (security: don't reveal if email exists)
    console.log('sendVerificationCode: email not found in active members, returning success (security)');
    
    // Audit log: verification code request for non-member (security event)
    const auditEntry = logger.logOperation(
      'VerificationCodeRequest',
      'fail',
      `Email ${email} requested verification code but is not an active member`,
      'Email not found in active members',
      { service: service, requestedEmail: email }
    );
    auditEntries.push(auditEntry);
    _persistAuditEntries(auditEntries);
    
    return { success: true };
  }
  
  // Get the service name for the email (use generic name if no service specified - SPA flow)
  const serviceName = (service && WebServices[service]) ? WebServices[service].name : 'SCCCC Services';
  
  // Request verification code (generates + sends email)
  const result = VerificationCode.requestCode(email, serviceName, service);
  
  // Audit log: verification code request
  const auditEntry = logger.logOperation(
    'VerificationCodeRequest',
    result.success ? 'success' : 'fail',
    result.success ? `Email ${email} requested verification code for ${serviceName}` : `Email ${email} failed to receive verification code`,
    result.error,
    { service: service, serviceName: serviceName, requestedEmail: email }
  );
  auditEntries.push(auditEntry);
  _persistAuditEntries(auditEntries);
  
  // Return success with normalized email so client uses same cache key
  if (result.success) {
    return { success: true, email: email };
  }
  
  return result;
}

/**
 * Verify a user-provided verification code.
 * On success, returns a redirect URL with a multi-use token.
 * 
 * @param {string} email - The user's email address
 * @param {string} code - The 6-digit verification code
 * @param {string} [service] - The service identifier (optional in SPA flow)
 * @returns {{success: boolean, redirectUrl?: string, error?: string}} Result with redirect URL on success
 */
/**
 * Verify a verification code and return a session token
 * @param {string} email - User email
 * @param {string} code - Verification code
 * @param {string} service - Service name
 * @returns {{success: boolean, token?: string, email?: string, service?: string, serviceData?: Record<string, any>, error?: string, errorCode?: string}} Result with token and bundled service data on success (JUSTIFIED: serviceData contains heterogeneous per-service data shapes)
 */
function verifyCode(email, code, service) {
  console.log('verifyCode(', email, code, ')');
  AppLogger.configure();
  AppLogger.info('WebApp', 'verifyCode() called', { email, service });
  
  // Normalize the email address
  email = email.toLowerCase().trim();
  
  // Create audit logger for verification attempts
  const logger = new ServiceLogger('Authentication', email);
  const auditEntries = [];
  
  // Verify the code
  const result = VerificationCode.verify(email, code);
  
  // Audit log: verification attempt
  const auditEntry = logger.logOperation(
    'VerificationCodeVerify',
    result.success ? 'success' : 'fail',
    result.success ? `Email ${email} successfully verified code for ${service || 'service'}` : `Email ${email} failed verification: ${result.error || 'Invalid or expired code'}`,
    result.error,
    { service: service, errorCode: result.errorCode, verifiedEmail: email }
  );
  auditEntries.push(auditEntry);
  _persistAuditEntries(auditEntries);
  
  if (!result.success) {
    return result;
  }
  
  // Generate a multi-use token for the session
  const token = TokenManager.getMultiUseToken(email);
  
  console.log('verifyCode: success, returning token for in-place content swap');

  // Bundle service data into the response to eliminate a round-trip (Phase 5 optimization)
  let serviceData;
  try {
    serviceData = getAllServiceData(token);
  } catch (err) {
    serviceData = { error: 'Failed to load service data: ' + err.message };
  }

  return {
    success: true,
    token: token,
    email: email,
    service: service,
    serviceData: serviceData
  };
}

/**
 * Helper function to persist audit entries
 * @param {AuditLogEntry[]} auditEntries - Audit entries to persist
 * @private
 */
function _persistAuditEntries(auditEntries) {
  if (!auditEntries || auditEntries.length === 0) {
    return;
  }
  
  try {
    // Persist entries using direct SpreadsheetApp access
    const numWritten = AuditPersistence.persistAuditEntries(auditEntries);
    
    AppLogger.debug('WebApp', `Persisted ${numWritten} audit entries`);
  } catch (error) {
    // Log error but don't fail the operation
    AppLogger.error('WebApp', 'Failed to persist audit entries', error);
  }
}

/**
 * Fetch data from all 5 services in a single call for authenticated user.
 * Replaces multiple individual getServiceContent() calls with one bulk request.
 * Individual service failures return error objects and do not prevent other services from loading.
 *
 * CRITICAL: No Date objects in return value - google.script.run cannot serialize them.
 *
 * @param {string} token - Multi-use auth token from verifyCode()
 * @returns {{email: string, services: Record<string, Record<string, any>>, homePageServices: Array} | {error: string, errorCode: string}} Combined service data or error (JUSTIFIED: each service returns a different data shape)
 */
function getAllServiceData(token) {
  AppLogger.configure();

  var email = TokenManager.getEmailFromMUT(token);
  if (!email) {
    return { error: 'Invalid or expired session', errorCode: 'INVALID_TOKEN' };
  }

  AppLogger.info('WebApp', 'getAllServiceData() called', { email: email });

  var serviceIds = [
    'DirectoryService',
    'GroupManagementService',
    'ProfileManagementService',
    'EmailChangeService',
    'VotingService'
  ];

  var services = /** @type {Record<string, any>} */ ({});

  for (var i = 0; i < serviceIds.length; i++) {
    var serviceId = serviceIds[i];
    var webService = /** @type {any} */ (WebServices[serviceId]);
    try {
      services[serviceId] = webService.Api.getData(email);
    } catch (err) {
      services[serviceId] = {
        error: 'Failed to load ' + serviceId + ': ' + err.message,
        serviceName: serviceId
      };
    }
  }

  var homePageServices = Common.HomePage.Manager.getAvailableServices();

  var logger = new ServiceLogger('AllServices', email);
  var auditEntries = [logger.logServiceAccess('getAllServiceData')];
  _persistAuditEntries(auditEntries);

  return {
    email: email,
    services: services,
    homePageServices: homePageServices
  };
}

/**
 * Refresh a session token.
 * Extends the expiration of an existing multi-use token.
 * 
 * @param {string} token - The current multi-use token
 * @returns {{success: boolean, token?: string, error?: string, errorCode?: string}} Result with new token on success
 */
function refreshSession(token) {
  console.log('refreshSession called');
  
  // Get the email from the current token
  const email = TokenManager.getEmailFromMUT(token);
  
  if (!email) {
    return {
      success: false,
      error: 'Invalid or expired session',
      errorCode: 'INVALID_TOKEN'
    };
  }
  
  // Generate a new multi-use token
  const newToken = TokenManager.getMultiUseToken(email);
  
  console.log('refreshSession: success for', email);
  
  return {
    success: true,
    token: newToken
  };
}

function processForm(form) {
  return EmailService.sendTestEmail(form)
}

function updateUserSubscriptions(updatedSubscriptions, userToken) {
    const userEmail = TokenManager.getEmailFromMUT(userToken);
    if (!userEmail) {
        console.warn(`Invalid or expired token: ${userToken}`);
        return JSON.stringify({ success: false, message: "Invalid session. Please refresh the page." });
    }
    const response = GroupManagementService.updateUserSubscriptions(updatedSubscriptions, userEmail);
    return response;
}

function updateProfile(userToken, updatedProfile ) {
    return ProfileManagementService.updateProfile(userToken, updatedProfile);
}

/**
 * Handle API requests for SPA services.
 * This is the main entry point for google.script.run API calls.
 * 
 * @param {{action: string, params?: Record<string, unknown>, token?: string}} request - The API request object with action, optional params, and optional auth token (JUSTIFIED: arbitrary API data from diverse service endpoints)
 * @returns {string} JSON-encoded API response
 */
function handleApiRequest(request) {
  console.log('handleApiRequest:', request && request.action);
  
  // Initialize API handlers if not already done
  if (typeof GroupManagementService.initApi === 'function') {
    GroupManagementService.initApi();
  }
  if (typeof ProfileManagementService.initApi === 'function') {
    ProfileManagementService.initApi();
  }
  if (typeof DirectoryService.initApi === 'function') {
    DirectoryService.initApi();
  }
  if (typeof EmailChangeService.initApi === 'function') {
    EmailChangeService.initApi();
  }
  if (typeof VotingService.initApi === 'function') {
    VotingService.initApi();
  }
  
  // Handle the request
  return ApiClient.handleRequest(request);
}

// Node.js export for testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { getAllServiceData: getAllServiceData, verifyCode: verifyCode };
}