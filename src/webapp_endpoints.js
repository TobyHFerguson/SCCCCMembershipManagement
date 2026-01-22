/**
 * Send a magic link to the user's email address.
 * 
 * @deprecated This function is deprecated and will be removed in a future release.
 *             Use sendVerificationCode() instead, which is part of the new SPA authentication flow.
 *             This function remains for backward compatibility when new auth is disabled.
 *             Call FeatureFlags.enableNewAuth() to switch to the new flow.
 * @param {string} email - The user's email address
 * @param {string} service - The service identifier (e.g., 'GroupManagementService')
 * @returns {{success: boolean, error?: string}} Result of the operation
 */
function sendMagicLink(email, service) {
  console.log('sendMagicLink(', email, service, ')');
  console.warn('[DEPRECATED] sendMagicLink is deprecated. Use sendVerificationCode instead. ' +
    'Call FeatureFlags.enableNewAuth() to switch to the new flow.');
  email = email.toLowerCase().trim(); // Normalize the email address
  return AuthUtils.sendMagicLink(email, service);
}

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
  const logger = new Common.Logging.ServiceLogger('Authentication', email);
  const auditEntries = [];
  
  // Check if the email is a valid active member
  const validEmails = Common.Data.Access.getEmailAddresses();
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
 * @returns {{success: boolean, token?: string, email?: string, service?: string, error?: string, errorCode?: string}}
 */
function verifyCode(email, code, service) {
  console.log('verifyCode(', email, code, ')');
  AppLogger.configure();
  AppLogger.info('WebApp', 'verifyCode() called', { email, service });
  
  // Normalize the email address
  email = email.toLowerCase().trim();
  
  // Create audit logger for verification attempts
  const logger = new Common.Logging.ServiceLogger('Authentication', email);
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
  
  return {
    success: true,
    token: token,
    email: email,
    service: service
  };
}

/**
 * Get service data for authenticated user
 * Called after successful verification code validation
 * 
 * For SPA architecture, this returns pure data (not HTML). The client will render the HTML.
 * 
 * LOGGING: This function logs both business audit (who accessed what) and system logs
 * for all service executions to support debugging and compliance.
 * 
 * @param {string} email - Authenticated user email
 * @param {string} service - Service name (e.g., 'DirectoryService')
 * @returns {object} Service-specific data for client-side rendering
 */
function getServiceContent(email, service) {
  console.log('getServiceContent(', email, service, ')');
  
  // Configure logger for this execution
  AppLogger.configure();
  
  // Create logger for this service execution
  const logger = new Common.Logging.ServiceLogger(service, email);
  const auditEntries = [];
  
  // Log service access start
  AppLogger.info('WebApp', `getServiceContent() called for service=${service}, user=${email}`);
  
  const webService = /** @type {any} */ (WebServices[service]);
  if (!webService) {
    console.error('Invalid service:', service);
    
    // Log error
    const errorEntry = logger.logError('getServiceContent', 'Invalid service specified: ' + service);
    auditEntries.push(errorEntry);
    _persistAuditEntries(auditEntries);
    
    return { error: 'Invalid service specified' };
  }
  
  // Debug logging
  console.log(`webService.Api:`, webService.Api);
  console.log(`Api keys:`, webService.Api ? Object.keys(webService.Api) : 'Api undefined');
  console.log(`typeof webService.Api.getData:`, webService.Api ? typeof webService.Api.getData : 'Api undefined');
  
  // Call service's API to get data (not HTML)
  // Access service namespace directly (e.g., GroupManagementService.Api.getData)
  // Note: webService IS the service namespace (e.g., GroupManagementService)
  if (webService.Api && typeof webService.Api.getData === 'function') {
    console.log(`Calling ${service}.Api.getData(${email})`);
    try {
      const data = webService.Api.getData(email);
      console.log(`${service}.Api.getData returned:`, data);
      
      // Log successful access
      const accessEntry = logger.logServiceAccess('getData');
      auditEntries.push(accessEntry);
      _persistAuditEntries(auditEntries);
      
      AppLogger.info('WebApp', `getServiceContent() completed successfully for service=${service}, user=${email}`);
      
      return data;
    } catch (error) {
      console.error(`Error in ${service}.Api.getData:`, error);
      
      // Log error
      const errorEntry = logger.logError('getData', error);
      auditEntries.push(errorEntry);
      _persistAuditEntries(auditEntries);
      
      return { 
        error: `Failed to load ${service}: ${error.message}`,
        serviceName: service 
      };
    }
  }
  
  // Fallback for services not yet migrated to new architecture
  console.warn(`Service ${service} does not have Api.getData() - using legacy approach`);
  console.warn(`webService:`, JSON.stringify(Object.keys(webService)));
  
  // For DirectoryService specifically (legacy)
  if (service === 'DirectoryService') {
    try {
      const directoryEntries = DirectoryService.getDirectoryEntries();
      console.log('getServiceContent: DirectoryService entries count:', directoryEntries ? directoryEntries.length : 0);
      console.log('getServiceContent: First entry:', directoryEntries && directoryEntries.length > 0 ? directoryEntries[0] : 'none');
      
      // Log successful access (legacy path)
      const accessEntry = logger.logServiceAccess('getDirectoryEntries');
      auditEntries.push(accessEntry);
      _persistAuditEntries(auditEntries);
      
      AppLogger.info('WebApp', `getServiceContent() completed (legacy path) for service=${service}, user=${email}`);
      
      return {
        serviceName: 'Directory',
        directoryEntries: directoryEntries
      };
    } catch (error) {
      // Log error
      const errorEntry = logger.logError('getDirectoryEntries', error);
      auditEntries.push(errorEntry);
      _persistAuditEntries(auditEntries);
      
      return {
        serviceName: 'Directory',
        error: error.message
      };
    }
  }
  
  // Generic fallback
  console.error(`Service ${service} has no Api.getData() method`);
  
  // Log error
  const errorEntry = logger.logError('getServiceContent', 'Service has no Api.getData() method');
  auditEntries.push(errorEntry);
  _persistAuditEntries(auditEntries);
  
  return {
    serviceName: webService.name || service,
    error: 'Service data not available'
  };
}

/**
 * Helper function to persist audit entries
 * Internal helper for getServiceContent logging
 * 
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
 * Render home page HTML content for authenticated user
 * Called after successful verification code validation to show available services
 * 
 * For SPA architecture, this returns pure data (not HTML). The client will render the HTML.
 * 
 * @param {string} email - Authenticated user email
 * @returns {{services: Array}} Services data for client-side rendering
 */
function getHomePageContent(email) {
  console.log('getHomePageContent(', email, ')');
  
  // Return just the data - client will render the HTML
  return {
    services: Common.HomePage.Manager.getAvailableServices()
  };
}

/**
 * Render verification page HTML content for sign-out flow
 * Returns the initial verification code input page
 * 
 * @returns {string} HTML content for the verification page
 */
function getVerificationPageContent() {
  try {
    // Check feature flag to determine which auth flow to use
    const useNewAuth = FeatureFlags.isNewAuthEnabled();
    
    const VERIFICATION_CODE_INPUT = 'common/auth/verificationCodeInput';
    const MAGIC_LINK_INPUT = 'common/auth/magicLinkInput';
    const contentFileName = useNewAuth ? VERIFICATION_CODE_INPUT : MAGIC_LINK_INPUT;
    
    // Create template for just the content (no layout wrapper)
    // This is used for container replacement when signing out
    const template = HtmlService.createTemplateFromFile(contentFileName);
    template.service = ''; // No specific service for verification page
    
    // Evaluate and return just the inner HTML content
    const content = template.evaluate().getContent();
    return content;
  } catch (error) {
    console.error('getVerificationPageContent() ERROR:', error.message);
    console.error('Error stack:', error.stack);
    // Return a fallback error message that will at least show something to the user
    return '<div style="padding: 2rem; text-align: center; color: red;">Error loading verification page: ' + error.message + '<br><br>Please refresh the page.</div>';
  }
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

function getProfile(userToken) {
    const userEmail = TokenManager.getEmailFromMUT(userToken);
    if (!userEmail) {
        console.warn(`Invalid or expired token: ${userToken}`);
        return { success: false, message: "Invalid session. Please refresh the page." };
    }
    const profile = Common.Data.Access.getMember(userEmail);
    if (!profile) {
        return { success: false, message: `Profile not found for email: ${userEmail}` };
    }
    return { success: true, profile: profile };
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
  return Common.Api.Client.handleRequest(request);
}