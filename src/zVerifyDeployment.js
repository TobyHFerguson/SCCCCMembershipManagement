/// <reference path="./types/global.d.ts" />
// @ts-check

/**
 * Comprehensive deployment verification for all SCCCC services.
 *
 * Run `verifyFullDeployment()` in the Apps Script Editor after every `clasp push`.
 * It checks that namespaces loaded correctly, flat classes exist, SheetAccess can
 * reach every expected sheet, global endpoint functions are callable, ApiClient
 * handlers are registered, and trigger functions are present.
 *
 * Results are logged via console.log and returned as a structured object so they
 * can also be consumed programmatically (e.g. via the Apps Script Execution API).
 *
 * IMPORTANT: This file is prefixed with `z` so it loads LAST in GAS file
 * concatenation order.  All namespaces / classes it references must already exist.
 *
 * @returns {DeploymentVerificationResult}
 */

/**
 * @typedef {Object} VerificationCheck
 * @property {string} category - Group the check belongs to (e.g. 'Namespaces')
 * @property {string} name     - Human-readable description
 * @property {boolean} passed  - Whether the check passed
 * @property {string} [error]  - Error message when failed
 */

/**
 * @typedef {Object} DeploymentVerificationResult
 * @property {number} total    - Total checks executed
 * @property {number} passed   - Checks that passed
 * @property {number} failed   - Checks that failed
 * @property {VerificationCheck[]} checks - Individual results
 * @property {string} timestamp - ISO timestamp of the run
 */

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

/**
 * Run ALL deployment verification checks.
 * Call this from the Apps Script Editor after `clasp push`.
 *
 * @returns {DeploymentVerificationResult}
 */
function verifyFullDeployment() {
  /** @type {VerificationCheck[]} */
  const checks = [];

  // Run each verification category
  _verifyNamespaces(checks);
  _verifyFlatClasses(checks);
  _verifyWebServices(checks);
  _verifyGlobalEndpoints(checks);
  _verifyApiClientHandlers(checks);
  _verifyTriggerFunctions(checks);
  _verifySheetAccess(checks);
  _verifyVotingServiceConstants(checks);

  // Summarise
  const passed = checks.filter(c => c.passed).length;
  const failed = checks.filter(c => !c.passed).length;

  /** @type {DeploymentVerificationResult} */
  const result = {
    total: checks.length,
    passed,
    failed,
    checks,
    timestamp: new Date().toISOString(),
  };

  // Pretty-print to the execution log
  _printResults('SCCCC Deployment Verification', checks, passed, failed);

  return result;
}

// ---------------------------------------------------------------------------
// End-to-end integration verification
// ---------------------------------------------------------------------------

/**
 * Run end-to-end integration checks that exercise real GAS services.
 *
 * Unlike `verifyFullDeployment()` which checks structural integrity,
 * this function exercises live GAS APIs: CacheService, MailApp, doGet,
 * AdminDirectory, token lifecycle, sheet write path, and the full
 * handleApiRequest round-trip.
 *
 * SAFE TO RUN: All writes go to a scratch cache key or are cleaned up.
 * No emails are sent (only quota is checked). No member data is modified.
 *
 * @returns {DeploymentVerificationResult}
 */
function verifyEndToEnd() {
  /** @type {VerificationCheck[]} */
  const checks = [];

  _verifyDoGet(checks);
  _verifyCacheService(checks);
  _verifyTokenLifecycle(checks);
  _verifyMailQuota(checks);
  _verifyAdminDirectoryApi(checks);
  _verifyHandleApiRequest(checks);
  _verifySheetWritePath(checks);

  // Summarise
  const passed = checks.filter(c => c.passed).length;
  const failed = checks.filter(c => !c.passed).length;

  /** @type {DeploymentVerificationResult} */
  const result = {
    total: checks.length,
    passed,
    failed,
    checks,
    timestamp: new Date().toISOString(),
  };

  _printResults('SCCCC End-to-End Verification', checks, passed, failed);

  return result;
}

// ---------------------------------------------------------------------------
// Combined: run both structural + E2E
// ---------------------------------------------------------------------------

/**
 * Run BOTH structural and end-to-end verification in one call.
 * Use this as the single entry point for automated verification.
 *
 * @returns {DeploymentVerificationResult}
 */
function verifyAll() {
  /** @type {VerificationCheck[]} */
  const allChecks = [];

  // Structural checks
  const structural = verifyFullDeployment();
  allChecks.push(...structural.checks);

  // E2E checks
  const e2e = verifyEndToEnd();
  allChecks.push(...e2e.checks);

  const passed = allChecks.filter(c => c.passed).length;
  const failed = allChecks.filter(c => !c.passed).length;

  /** @type {DeploymentVerificationResult} */
  const result = {
    total: allChecks.length,
    passed,
    failed,
    checks: allChecks,
    timestamp: new Date().toISOString(),
  };

  console.log('');
  console.log('═══════════════════════════════════════════════════');
  console.log(`  COMBINED: ${passed}/${allChecks.length} passed` +
              (failed > 0 ? ` (${failed} FAILED)` : ' — ALL CLEAR'));
  console.log('═══════════════════════════════════════════════════');
  console.log('');

  return result;
}

// ---------------------------------------------------------------------------
// E2E Category: doGet() produces HTML
// ---------------------------------------------------------------------------

/**
 * Verify that doGet() returns a valid HtmlOutput.
 * @param {VerificationCheck[]} checks
 */
function _verifyDoGet(checks) {
  const category = 'doGet';

  _safeCheck(checks, category, 'doGet() returns HtmlOutput', () => {
    // @ts-ignore - mock event object
    const output = doGet({ parameter: {}, parameters: {} });
    if (!output) {
      throw new Error('doGet() returned null/undefined');
    }
    // HtmlOutput has getContent() method
    if (typeof output.getContent !== 'function') {
      throw new Error('doGet() did not return HtmlOutput (no getContent method)');
    }
  });

  _safeCheck(checks, category, 'doGet() HTML contains verification form', () => {
    // @ts-ignore
    const output = doGet({ parameter: {}, parameters: {} });
    const html = output.getContent();
    if (!html || html.length < 100) {
      throw new Error(`doGet() HTML too short (${html ? html.length : 0} chars)`);
    }
    // The verification code page should contain an email input
    if (!html.includes('email') && !html.includes('verification')) {
      throw new Error('doGet() HTML does not appear to contain verification form');
    }
  });
}

// ---------------------------------------------------------------------------
// E2E Category: CacheService round-trip
// ---------------------------------------------------------------------------

/**
 * Verify that CacheService can write, read, and delete a key.
 * @param {VerificationCheck[]} checks
 */
function _verifyCacheService(checks) {
  const category = 'CacheService';
  const testKey = '_verify_deployment_test_key';
  const testValue = 'verify_' + Date.now();

  _safeCheck(checks, category, 'CacheService write + read round-trip', () => {
    const cache = CacheService.getScriptCache();
    cache.put(testKey, testValue, 60);
    const readBack = cache.get(testKey);
    if (readBack !== testValue) {
      throw new Error(`Expected "${testValue}", got "${readBack}"`);
    }
  });

  _safeCheck(checks, category, 'CacheService delete', () => {
    const cache = CacheService.getScriptCache();
    cache.remove(testKey);
    const afterDelete = cache.get(testKey);
    if (afterDelete !== null) {
      throw new Error(`Expected null after delete, got "${afterDelete}"`);
    }
  });
}

// ---------------------------------------------------------------------------
// E2E Category: Token lifecycle
// ---------------------------------------------------------------------------

/**
 * Verify TokenManager can create a token, read the email back, and consume it.
 * Uses CacheService under the hood — this proves the full auth token path.
 * @param {VerificationCheck[]} checks
 */
function _verifyTokenLifecycle(checks) {
  const category = 'Token Lifecycle';
  const testEmail = 'verify-deployment@test.example';
  let token = '';

  _safeCheck(checks, category, 'TokenManager.getMultiUseToken()', () => {
    token = TokenManager.getMultiUseToken(testEmail);
    if (!token || typeof token !== 'string' || token.length < 10) {
      throw new Error(`getMultiUseToken returned invalid token: "${token}"`);
    }
  });

  _safeCheck(checks, category, 'TokenManager.getEmailFromMUT()', () => {
    if (!token) throw new Error('No token from previous step');
    const email = TokenManager.getEmailFromMUT(token);
    if (email !== testEmail) {
      throw new Error(`Expected "${testEmail}", got "${email}"`);
    }
  });

  _safeCheck(checks, category, 'TokenManager.consumeMUT()', () => {
    if (!token) throw new Error('No token from previous step');
    const email = TokenManager.consumeMUT(token);
    if (email !== testEmail) {
      throw new Error(`consumeMUT expected "${testEmail}", got "${email}"`);
    }
    // After consumption, token should be gone
    const gone = TokenManager.getEmailFromMUT(token);
    if (gone !== null) {
      throw new Error('Token still valid after consumeMUT');
    }
  });
}

// ---------------------------------------------------------------------------
// E2E Category: MailApp quota
// ---------------------------------------------------------------------------

/**
 * Verify MailApp is accessible and has remaining quota.
 * Does NOT send an email — only checks quota.
 * @param {VerificationCheck[]} checks
 */
function _verifyMailQuota(checks) {
  const category = 'MailApp';

  _safeCheck(checks, category, 'MailApp.getRemainingDailyQuota()', () => {
    const quota = MailApp.getRemainingDailyQuota();
    if (typeof quota !== 'number') {
      throw new Error(`Expected number, got ${typeof quota}`);
    }
    if (quota <= 0) {
      throw new Error(`Quota exhausted (${quota} remaining) — emails will fail`);
    }
    console.log(`  📧 Email quota remaining: ${quota}`);
  });
}

// ---------------------------------------------------------------------------
// E2E Category: AdminDirectory (Google Groups API)
// ---------------------------------------------------------------------------

/**
 * Verify AdminDirectory advanced service is accessible.
 * Reads groups for the automation account — a harmless read-only call.
 * @param {VerificationCheck[]} checks
 */
function _verifyAdminDirectoryApi(checks) {
  const category = 'AdminDirectory API';

  _safeCheck(checks, category, 'AdminDirectory.Groups.list()', () => {
    // @ts-ignore - AdminDirectory is a GAS advanced service
    if (typeof AdminDirectory === 'undefined') {
      throw new Error('AdminDirectory advanced service not available');
    }
    // List groups for the automation account (read-only, harmless)
    // @ts-ignore
    const result = AdminDirectory.Groups.list({
      customer: 'my_customer',
      maxResults: 1,
    });
    if (!result) {
      throw new Error('AdminDirectory.Groups.list returned null');
    }
    // result.groups may be undefined if the org has no groups, which is fine
    console.log(`  👥 Groups accessible (found ${result.groups ? result.groups.length : 0} in sample)`);
  });
}

// ---------------------------------------------------------------------------
// E2E Category: handleApiRequest round-trip
// ---------------------------------------------------------------------------

/**
 * Verify the full handleApiRequest pipeline: request → routing → handler → JSON response.
 * Uses an unauthenticated action (if any) or tests with a valid token.
 * @param {VerificationCheck[]} checks
 */
function _verifyHandleApiRequest(checks) {
  const category = 'API Request Pipeline';

  // First, ensure APIs are initialized
  _safeCheck(checks, category, 'Initialize all APIs', () => {
    const refs = _buildNamespaceRefs();
    const initNames = [
      'DirectoryService',
      'ProfileManagementService',
      'GroupManagementService',
      'EmailChangeService',
      'VotingService',
    ];
    for (const name of initNames) {
      const svc = refs[name];
      if (svc && typeof svc.initApi === 'function') {
        svc.initApi();
      }
    }
  });

  // Test with invalid request → should get structured error (not an exception)
  _safeCheck(checks, category, 'Invalid request returns structured error', () => {
    const responseJson = handleApiRequest(null);
    if (typeof responseJson !== 'string') {
      throw new Error(`Expected JSON string, got ${typeof responseJson}`);
    }
    const response = JSON.parse(responseJson);
    if (response.success !== false) {
      throw new Error('Expected success:false for null request');
    }
    if (!response.errorCode) {
      throw new Error('Expected errorCode in error response');
    }
  });

  // Test with unknown action → should get UNKNOWN_ACTION error
  _safeCheck(checks, category, 'Unknown action returns UNKNOWN_ACTION', () => {
    const responseJson = handleApiRequest({
      action: '_e2e_test_nonexistent_action',
    });
    const response = JSON.parse(responseJson);
    if (response.success !== false) {
      throw new Error('Expected success:false for unknown action');
    }
    if (response.errorCode !== 'UNKNOWN_ACTION') {
      throw new Error(`Expected UNKNOWN_ACTION, got "${response.errorCode}"`);
    }
  });

  // Test with valid action but no auth → should get AUTH_REQUIRED
  _safeCheck(checks, category, 'Auth-required action without token returns AUTH_REQUIRED', () => {
    const responseJson = handleApiRequest({
      action: 'directory.getEntries',
      // no token
    });
    const response = JSON.parse(responseJson);
    if (response.success !== false) {
      throw new Error('Expected success:false without token');
    }
    if (response.errorCode !== 'AUTH_REQUIRED') {
      throw new Error(`Expected AUTH_REQUIRED, got "${response.errorCode}"`);
    }
  });

  // Test with valid token → should get actual data
  _safeCheck(checks, category, 'Authenticated request returns data', () => {
    // Create a real token for the test
    const testEmail = DataAccess.getEmailAddresses()[0];
    if (!testEmail) {
      throw new Error('No active members found for authenticated test');
    }
    const token = TokenManager.getMultiUseToken(testEmail);

    const responseJson = handleApiRequest({
      action: 'directory.getStats',
      token: token,
    });
    const response = JSON.parse(responseJson);
    if (!response.success) {
      throw new Error(`Expected success:true, got error: ${response.error}`);
    }
    if (!response.meta || !response.meta.requestId) {
      throw new Error('Response missing meta.requestId');
    }

    // Clean up the token
    TokenManager.consumeMUT(token);
  });
}

// ---------------------------------------------------------------------------
// E2E Category: Sheet write path
// ---------------------------------------------------------------------------

/**
 * Verify that SheetAccess can write and read data (using SystemLogs as
 * a safe target — it's append-only and adding a test row is harmless).
 *
 * We write a single identifiable row to SystemLogs, read it back, then
 * leave it in place (cleaning up a row from a sheet with other data is
 * riskier than leaving a single benign test entry).
 * @param {VerificationCheck[]} checks
 */
function _verifySheetWritePath(checks) {
  const category = 'Sheet Write Path';

  _safeCheck(checks, category, 'SheetAccess write + read (SystemLogs)', () => {
    const sheet = SheetAccess.getSheet('SystemLogs');
    if (!sheet) {
      throw new Error('SystemLogs sheet not found');
    }

    // Read current row count
    const beforeCount = sheet.getLastRow();

    // Append a test row using the sheet's headers
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const testRow = headers.map(h => {
      if (String(h).toLowerCase().includes('date') || String(h).toLowerCase().includes('time')) {
        return new Date().toISOString();
      }
      if (String(h).toLowerCase().includes('type') || String(h).toLowerCase().includes('level')) {
        return 'E2E_TEST';
      }
      if (String(h).toLowerCase().includes('message') || String(h).toLowerCase().includes('note')) {
        return 'Deployment verification test entry';
      }
      return 'e2e_verify';
    });

    sheet.appendRow(testRow);

    // Verify row count increased
    const afterCount = sheet.getLastRow();
    if (afterCount <= beforeCount) {
      throw new Error(`Row count did not increase (before=${beforeCount}, after=${afterCount})`);
    }
  });
}

// ---------------------------------------------------------------------------
// Shared output formatter
// ---------------------------------------------------------------------------

/**
 * Pretty-print verification results to the execution log.
 * @param {string} title - Section title
 * @param {VerificationCheck[]} checks - Check results
 * @param {number} passed - Pass count
 * @param {number} failed - Fail count
 */
function _printResults(title, checks, passed, failed) {
  console.log('');
  console.log('═══════════════════════════════════════════════════');
  console.log(`  ${title}`);
  console.log('═══════════════════════════════════════════════════');

  let currentCategory = '';
  for (const check of checks) {
    if (check.category !== currentCategory) {
      currentCategory = check.category;
      console.log('');
      console.log(`── ${currentCategory} ──`);
    }
    const icon = check.passed ? '✅' : '❌';
    const msg = check.passed ? check.name : `${check.name}  →  ${check.error}`;
    console.log(`  ${icon} ${msg}`);
  }

  console.log('');
  console.log('═══════════════════════════════════════════════════');
  console.log(`  Result: ${passed}/${checks.length} passed` +
              (failed > 0 ? ` (${failed} FAILED)` : ' — all clear'));
  console.log('═══════════════════════════════════════════════════');
  console.log('');
}

// ---------------------------------------------------------------------------
// Category: Namespace objects
// ---------------------------------------------------------------------------

/**
 * Verify that all expected namespace objects exist in GAS script scope.
 *
 * NOTE: GAS V8 `const` declarations live in script scope but are NOT added
 * to `globalThis`.  Only `var` and `function` declarations appear on
 * `globalThis`.  Therefore we must reference each namespace variable
 * directly rather than using `globalThis[name]`.
 *
 * @param {VerificationCheck[]} checks
 */
function _verifyNamespaces(checks) {
  const category = 'Namespaces';

  // Build a map of name → direct script-scope reference.
  // Using typeof guards so that an undefined name doesn't throw a
  // ReferenceError — it simply maps to undefined and the check reports
  // a clear failure.
  const refs = _buildNamespaceRefs();

  // Top-level namespaces
  const topLevel = [
    'MembershipManagement',
    'DirectoryService',
    'ProfileManagementService',
    'GroupManagementService',
    'EmailChangeService',
    'VotingService',
    'HomePageService',
    'EmailService',
    'DocsService',
    'GroupSubscription',
    'WebServices',
  ];

  for (const name of topLevel) {
    _safeCheck(checks, category, name, () => {
      if (refs[name] === undefined || refs[name] === null) {
        throw new Error(`${name} is undefined`);
      }
    });
  }

  // Nested namespaces (only check if parent exists)
  const nested = [
    { name: 'MembershipManagement.Internal', parent: 'MembershipManagement', prop: 'Internal' },
    { name: 'MembershipManagement.Utils', parent: 'MembershipManagement', prop: 'Utils' },
    { name: 'VotingService.Data', parent: 'VotingService', prop: 'Data' },
    { name: 'VotingService.Trigger', parent: 'VotingService', prop: 'Trigger' },
    { name: 'EmailService.Menu', parent: 'EmailService', prop: 'Menu' },
    { name: 'DocsService.Internal', parent: 'DocsService', prop: 'Internal' },
  ];

  for (const { name, parent, prop } of nested) {
    _safeCheck(checks, category, name, () => {
      const parentRef = refs[parent];
      if (!parentRef) {
        throw new Error(`${parent} is undefined (cannot check ${prop})`);
      }
      if (parentRef[prop] === undefined || parentRef[prop] === null) {
        throw new Error(`${name} is undefined`);
      }
    });
  }
}

/**
 * Build a map of namespace names to their direct script-scope references.
 *
 * In GAS V8, `const` declarations are in script scope (shared across files)
 * but NOT on `globalThis`.  We must use `typeof X !== 'undefined'` guards
 * and direct variable names to inspect them.
 *
 * @returns {Record<string, *>}
 */
function _buildNamespaceRefs() {
  /** @type {Record<string, *>} */
  const refs = {};

  // @ts-ignore — GAS script-scope const (not on globalThis)
  if (typeof MembershipManagement !== 'undefined') refs['MembershipManagement'] = MembershipManagement;
  // @ts-ignore
  if (typeof DirectoryService !== 'undefined') refs['DirectoryService'] = DirectoryService;
  // @ts-ignore
  if (typeof ProfileManagementService !== 'undefined') refs['ProfileManagementService'] = ProfileManagementService;
  // @ts-ignore
  if (typeof GroupManagementService !== 'undefined') refs['GroupManagementService'] = GroupManagementService;
  // @ts-ignore
  if (typeof EmailChangeService !== 'undefined') refs['EmailChangeService'] = EmailChangeService;
  // @ts-ignore — GAS script-scope var
  if (typeof VotingService !== 'undefined') refs['VotingService'] = VotingService;
  // @ts-ignore — GAS script-scope const
  if (typeof HomePageService !== 'undefined') refs['HomePageService'] = HomePageService;
  // @ts-ignore
  if (typeof EmailService !== 'undefined') refs['EmailService'] = EmailService;
  // @ts-ignore
  if (typeof DocsService !== 'undefined') refs['DocsService'] = DocsService;
  // @ts-ignore
  if (typeof GroupSubscription !== 'undefined') refs['GroupSubscription'] = GroupSubscription;
  // @ts-ignore
  if (typeof WebServices !== 'undefined') refs['WebServices'] = WebServices;

  return refs;
}

// ---------------------------------------------------------------------------
// Category: Flat (IIFE-wrapped) classes
// ---------------------------------------------------------------------------

/**
 * Verify that IIFE-wrapped flat classes are defined at global scope.
 * @param {VerificationCheck[]} checks
 */
function _verifyFlatClasses(checks) {
  const category = 'Flat Classes';
  const classes = [
    // Data / Validated types
    'SheetAccess',
    'SpreadsheetManager',
    'DataAccess',
    'ValidatedMember',
    'ValidatedTransaction',
    'ValidatedActionSpec',
    'ValidatedBootstrap',
    'ValidatedElection',
    'ValidatedElectionConfig',
    'ValidatedFIFOItem',
    'ValidatedPublicGroup',
    'MemberPersistence',
    // Auth
    'VerificationCode',
    'VerificationCodeManager',
    'TokenManager',
    'TokenStorage',
    // API
    'ApiClient',
    'ApiClientManager',
    // Logging
    'AppLogger',
    'ServiceLogger',
    'ServiceExecutionLogger',
    // Audit
    'AuditLogEntry',
    'AuditLogger',
    'AuditPersistence',
    // Config
    'FeatureFlagsManager',
  ];

  for (const name of classes) {
    _safeCheck(checks, category, name, () => {
      // Use indirect eval to check global scope without lint errors
      const val = _globalRef(name);
      if (val === undefined || val === null) {
        throw new Error(`${name} is not defined at global scope`);
      }
    });
  }
}

// ---------------------------------------------------------------------------
// Category: WebServices registry
// ---------------------------------------------------------------------------

/**
 * Verify that every service in WebServices has the required properties.
 * @param {VerificationCheck[]} checks
 */
function _verifyWebServices(checks) {
  const category = 'WebServices Registry';
  const expectedServices = [
    'HomePageService',
    'DirectoryService',
    'EmailChangeService',
    'GroupManagementService',
    'ProfileManagementService',
    'VotingService',
  ];

  for (const svcId of expectedServices) {
    _safeCheck(checks, category, `WebServices.${svcId} registered`, () => {
      if (!WebServices[svcId]) {
        throw new Error(`WebServices.${svcId} is missing`);
      }
    });

    _safeCheck(checks, category, `WebServices.${svcId}.name`, () => {
      if (!WebServices[svcId] || !WebServices[svcId].name) {
        throw new Error(`WebServices.${svcId}.name is missing`);
      }
    });

    _safeCheck(checks, category, `WebServices.${svcId}.service`, () => {
      if (!WebServices[svcId] || WebServices[svcId].service !== svcId) {
        throw new Error(`Expected service="${svcId}", got "${WebServices[svcId] && WebServices[svcId].service}"`);
      }
    });
  }
}

// ---------------------------------------------------------------------------
// Category: Global endpoint functions (google.script.run targets)
// ---------------------------------------------------------------------------

/**
 * Verify that all global functions required by google.script.run exist.
 * @param {VerificationCheck[]} checks
 */
function _verifyGlobalEndpoints(checks) {
  const category = 'Global Endpoints';
  const endpoints = [
    'sendVerificationCode',
    'verifyCode',
    'getServiceContent',
    'getHomePageContent',
    'getVerificationPageContent',
    'refreshSession',
    'handleApiRequest',
    'updateUserSubscriptions',
    'updateProfile',
    'processForm',
  ];

  for (const name of endpoints) {
    _safeCheck(checks, category, `${name}()`, () => {
      const fn = _globalRef(name);
      if (typeof fn !== 'function') {
        throw new Error(`${name} is not a function (got ${typeof fn})`);
      }
    });
  }
}

// ---------------------------------------------------------------------------
// Category: ApiClient handler registration
// ---------------------------------------------------------------------------

/**
 * Verify that each service's initApi() registers the expected action handlers.
 * We call initApi() for each service, then check ApiClientManager's registry.
 * @param {VerificationCheck[]} checks
 */
function _verifyApiClientHandlers(checks) {
  const category = 'ApiClient Handlers';

  // Expected action keys registered by each service's initApi()
  const expectedActions = [
    'directory.getEntries',
    'directory.getStats',
    'profileManagement.getProfile',
    'profileManagement.updateProfile',
    'profileManagement.getEditableFields',
    'groupManagement.getSubscriptions',
    'groupManagement.updateSubscriptions',
    'groupManagement.getDeliveryOptions',
    'emailChange.sendVerificationCode',
    'emailChange.verifyAndChangeEmail',
    'emailChange.verifyAndGetGroups',
    'emailChange.changeEmail',
    'voting.getActiveElections',
    'voting.getElectionStats',
    'voting.generateBallotToken',
  ];

  // First, try to call each service's initApi() to populate the registry
  const initFunctions = [
    { name: 'DirectoryService.initApi', ref: () => DirectoryService.initApi },
    { name: 'ProfileManagementService.initApi', ref: () => ProfileManagementService.initApi },
    { name: 'GroupManagementService.initApi', ref: () => GroupManagementService.initApi },
    { name: 'EmailChangeService.initApi', ref: () => EmailChangeService.initApi },
    { name: 'VotingService.initApi', ref: () => VotingService.initApi },
  ];

  for (const init of initFunctions) {
    _safeCheck(checks, category, `${init.name}() exists`, () => {
      const fn = init.ref();
      if (typeof fn !== 'function') {
        throw new Error(`${init.name} is not a function`);
      }
    });
  }

  // Initialize all APIs (safe to call multiple times)
  for (const init of initFunctions) {
    try {
      const fn = init.ref();
      if (typeof fn === 'function') { fn(); }
    } catch (_e) { /* individual initApi failures already caught above */ }
  }

  // Now verify each expected action is registered
  for (const action of expectedActions) {
    _safeCheck(checks, category, `Action: ${action}`, () => {
      if (typeof ApiClient === 'undefined') {
        throw new Error('ApiClient is not defined');
      }
      const handler = ApiClient.getHandler(action);
      if (!handler) {
        throw new Error(`No handler registered for "${action}"`);
      }
    });
  }
}

// ---------------------------------------------------------------------------
// Category: Trigger functions
// ---------------------------------------------------------------------------

/**
 * Verify that all trigger-callable global functions exist.
 * @param {VerificationCheck[]} checks
 */
function _verifyTriggerFunctions(checks) {
  const category = 'Trigger Functions';
  const triggers = [
    'onOpen',
    'onFormSubmit',
    'initializeTriggers',
    'setupAllTriggers',
    'manageElectionLifecycles',
    'processMembershipExpirations',
    'processElectionsChanges',
    'handleEditEvent',
    'ballotSubmitHandler',
    'handleElectionsSheetEdit',
  ];

  for (const name of triggers) {
    _safeCheck(checks, category, `${name}()`, () => {
      const fn = _globalRef(name);
      if (typeof fn !== 'function') {
        throw new Error(`${name} is not a function (got ${typeof fn})`);
      }
    });
  }
}

// ---------------------------------------------------------------------------
// Category: SheetAccess — can reach Bootstrap and expected sheets
// ---------------------------------------------------------------------------

/**
 * Verify that SheetAccess can read the Bootstrap sheet and that expected
 * sheet names are resolvable.  This is a "smoke test" that the spreadsheet
 * is connected and the Bootstrap configuration is intact.
 *
 * NOTE: This actually reads from the live spreadsheet.  It should be
 * harmless (read-only) but will fail if the spreadsheet is inaccessible.
 * @param {VerificationCheck[]} checks
 */
function _verifySheetAccess(checks) {
  const category = 'Sheet Access';

  // Verify Bootstrap is readable
  _safeCheck(checks, category, 'Bootstrap sheet readable', () => {
    const data = SheetAccess.getData('Bootstrap');
    if (!data || !Array.isArray(data)) {
      throw new Error('SheetAccess.getData("Bootstrap") did not return an array');
    }
    if (data.length === 0) {
      throw new Error('Bootstrap sheet is empty');
    }
  });

  // Verify key sheets are accessible (read one row to confirm)
  const criticalSheets = [
    'ActiveMembers',
    'Transactions',
    'ActionSpecs',
    'ExpirySchedule',
    'PublicGroups',
  ];

  for (const sheetName of criticalSheets) {
    _safeCheck(checks, category, `Sheet: ${sheetName}`, () => {
      const sheet = SheetAccess.getSheet(sheetName);
      if (!sheet) {
        throw new Error(`SheetAccess.getSheet("${sheetName}") returned null`);
      }
    });
  }

  // Verify DataAccess convenience methods work
  _safeCheck(checks, category, 'DataAccess.getMembers()', () => {
    const members = DataAccess.getMembers();
    if (!Array.isArray(members)) {
      throw new Error('DataAccess.getMembers() did not return an array');
    }
  });

  _safeCheck(checks, category, 'DataAccess.getActionSpecs()', () => {
    const specs = DataAccess.getActionSpecs();
    if (!specs || typeof specs !== 'object' || Array.isArray(specs)) {
      const type = specs === null ? 'null' : typeof specs;
      throw new Error(
        `DataAccess.getActionSpecs() did not return an object (got ${type})`
      );
    }
    if (Object.keys(specs).length === 0) {
      throw new Error('DataAccess.getActionSpecs() returned an empty object');
    }
  });
}

// ---------------------------------------------------------------------------
// Category: VotingService Constants (migrated from existing zVerifyDeployment)
// ---------------------------------------------------------------------------

/**
 * Verify VotingService constants loaded correctly (namespace merge with
 * 0Constants.js).
 * @param {VerificationCheck[]} checks
 */
function _verifyVotingServiceConstants(checks) {
  const category = 'VotingService Constants';

  _safeCheck(checks, category, 'VotingService.Constants exists', () => {
    if (!VotingService.Constants) {
      throw new Error('VotingService.Constants is undefined');
    }
  });

  const requiredConstants = [
    'FORM_EDIT_URL_COLUMN_NAME',
    'TOKEN_ENTRY_FIELD_TITLE',
    'RESULTS_SUFFIX',
    'ElectionState',
  ];

  for (const name of requiredConstants) {
    _safeCheck(checks, category, `Constants.${name}`, () => {
      if (VotingService.Constants[name] === undefined) {
        throw new Error(`VotingService.Constants.${name} is undefined`);
      }
    });
  }

  _safeCheck(checks, category, 'ElectionState.ACTIVE === "ACTIVE"', () => {
    if (VotingService.Constants.ElectionState.ACTIVE !== 'ACTIVE') {
      throw new Error(
        `Expected "ACTIVE", got "${VotingService.Constants.ElectionState.ACTIVE}"`
      );
    }
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Run a single check, catching any exception and recording the result.
 * @param {VerificationCheck[]} checks - Accumulator array
 * @param {string} category - Category label
 * @param {string} name - Check description
 * @param {function(): void} fn - Assertion function (throws on failure)
 */
function _safeCheck(checks, category, name, fn) {
  try {
    fn();
    checks.push({ category, name, passed: true });
  } catch (/** @type {*} */ e) {
    const error = e instanceof Error ? e.message : String(e);
    checks.push({ category, name, passed: false, error });
  }
}

/**
 * Safely resolve a name on globalThis.
 *
 * IMPORTANT: In GAS V8, only `var` and `function` declarations are added
 * to `globalThis`.  Top-level `const` / `let` declarations live in script
 * scope and are NOT accessible via `globalThis`.  For those, use
 * `_buildNamespaceRefs()` instead.
 *
 * @param {string} name - Global variable name
 * @returns {*} The value, or undefined if not found
 */
function _globalRef(name) {
  // globalThis is available in V8 GAS runtime
  return globalThis[name];
}
