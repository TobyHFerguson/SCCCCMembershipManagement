---
applyTo: '**'
---

# SCCCC Management Copilot Instructions

## Project Overview
Google Apps Script (GAS) membership management system for SCCCC. Hybrid TypeScript/JavaScript with pure-logic core functions tested via Jest, and GAS-specific wrappers for runtime integration.

**Architecture**: Data-driven Single Page Application (SPA) where server returns JSON data and client renders HTML. See `docs/SPA_ARCHITECTURE.md` for complete documentation.

## Setup and Commands

**Install dependencies:**
```bash
npm install
```

**Run tests:**
```bash
npm test                    # Run all Jest tests
npm test Manager.test.js    # Run specific test file
```

**Linting:**
This project uses Prettier for code formatting. Configuration is in `.prettierrc.js`.

**Deployment (Clasp):**
Three environments: dev, staging, prod. Scripts use clasp-env to switch `.clasp.json`.

```bash
npm run dev:push            # Watch mode deployment to dev
npm run dev:deploy          # Deploy to dev test deployment
npm run stage:deploy        # Full staging deploy (push + version + redeploy)
npm run prod:deploy-live    # Production deploy with git versioning
```

## Boundaries and Restrictions

**DO NOT:**
- Use `var` or `const` to redeclare namespaces (always use `if (typeof Namespace === 'undefined')` pattern)
- Access spreadsheets directly via `SpreadsheetApp.getActiveSpreadsheet()` - always use Fiddler
- Use `Common.Logger.*` in Layer 0 modules (SpreadsheetManager.js, Properties.js, Logger.js)
- Throw exceptions from Manager methods - return errors as data instead
- Commit secrets or credentials to source code
- Modify production configuration files without proper review
- Skip tests when modifying Manager class business logic
- Open a PR without running `npm test` and ensuring all tests pass

**ALWAYS:**
- Write comprehensive Jest tests for any pure business logic in Manager classes
- Use the namespace declaration pattern documented below when extending namespaces
- Run `npm test` BEFORE every commit and verify all tests pass
- Run `npm test` BEFORE opening any PR - PRs with failing tests will be rejected
- Fix any test failures immediately - do not commit broken tests
- Use `npm run {env}:*` scripts for deployment (never run clasp commands directly)

## Git Workflow

- **Branching**: Create feature branches for new features
- **Commits**: Commit frequently with descriptive messages
- **Testing**: ALL tests MUST pass before every commit (`npm test`)
- **PR Requirement**: Run `npm test` and verify 100% pass before opening PR
- **Multi-phase work**: Use "References #issue" in PR description (NOT "Fixes #issue") to keep issue open
- **Clean working directory**: Production deployments require clean git state (`git:enforce-clean`)
- **Version tracking**: Use `clasp:create-version` which embeds git tag/commit in GAS version

## Critical Architecture Patterns

### GAS Layer Separation (FUNDAMENTAL PRINCIPLE)

**Core Rule**: GAS layer files (in service namespaces like `MembershipManagement`, `VotingService`) MUST contain ONLY:
- GAS API calls (`MailApp`, `AdminDirectory`, `SpreadsheetApp`, `PropertiesService`, etc.)
- Date conversions between spreadsheet and ISO formats
- Fiddler operations (get/set data)
- Orchestration logic calling Manager pure functions
- Error handling and logging

**ALL business logic MUST be in Manager classes** with full Jest test coverage.

**Anti-pattern (BAD)**:
```javascript
// In MembershipManagement.processExpirationFIFO
const eligibleItems = [];
for (let i = 0; i < queue.length; i++) {
  const item = queue[i];
  if (!item || item.dead) continue;
  const next = new Date(item.nextAttemptAt);
  const isEligible = !item.nextAttemptAt || item.nextAttemptAt === '' || isNaN(next.getTime()) || next <= now;
  if (!isEligible) continue;
  if (eligibleItems.length < batchSize) {
    eligibleItems.push(item);
    eligibleIndices.push(i);
  }
}
// ❌ Complex pure logic in GAS layer - untestable without GAS runtime
```

**Correct Pattern (GOOD)**:
```javascript
// In Manager.js (pure, testable)
static selectBatchForProcessing(queue, batchSize, now) {
  const eligibleItems = [];
  const eligibleIndices = [];
  // ... complex logic here
  return { eligibleItems, eligibleIndices };
}

// In MembershipManagement.js (GAS orchestration only)
const now = new Date(); // GAS: get current time
const { eligibleItems, eligibleIndices } = MembershipManagement.Manager.selectBatchForProcessing(queue, batchSize, now);
// ✅ Pure logic in Manager, GAS layer just calls it
```

**Benefits**:
- **Testability**: Complex logic covered by comprehensive Jest tests
- **Reliability**: Tests catch edge cases before deployment
- **Maintainability**: Business logic changes don't require GAS deployment to verify
- **Debuggability**: Pure functions can be debugged locally with Node.js

**Implementation Pattern**:
1. Write pure static methods in `Manager` class accepting all inputs (no GAS dependencies)
2. Write comprehensive Jest tests covering edge cases
3. GAS layer calls Manager methods, passing GAS-fetched data and injected functions
4. Mark GAS operations with `// GAS:` comments, pure function calls with `// PURE:`

**See**: `__tests__/FIFOBatchProcessing.test.js` for example of comprehensive pure function tests.

### Namespace Declaration Pattern (CRITICAL)

**Hybrid environment challenge**: Files run concatenated in GAS but independently in Jest. `1namespaces.js` declares all root namespaces with `const`, loading first in GAS.

**REQUIRED pattern for ANY file extending a namespace**:
```javascript
// ✅ CORRECT: Works in both GAS and Jest
if (typeof NamespaceName === 'undefined') NamespaceName = {};
NamespaceName.SubNamespace = NamespaceName.SubNamespace || {};

// ✅ CORRECT: Constants attached to namespace
NamespaceName.MY_CONSTANT = 'value';
NamespaceName.CONFIG = { key: 'value' };
```

**NEVER do this**:
```javascript
// ❌ WRONG: Conflicts with const in 1namespaces.js
var Audit = Audit || {};
const Common = Common || {};

// ❌ WRONG: Global constants conflict when files are concatenated
const VERIFICATION_CONFIG = { ... };
const EMAIL_REGEX = /pattern/;
```

**Why**: In GAS, `const Audit = {}` already exists from `1namespaces.js`. Redeclaring with `var`/`const` causes `SyntaxError: Identifier 'Audit' has already been declared`. The `typeof` check skips redeclaration in GAS but creates namespace in Jest.

**Constants**: ALL constants (configs, regex patterns, enums) MUST be attached to the namespace. Never use `const`/`let`/`var` for module-level constants - they become globals when GAS concatenates files.

**See**: `docs/NAMESPACE_DECLARATION_PATTERN.md` for complete documentation and examples.

### Generator/Consumer Separation (Testability Pattern)
**Core principle**: Pure JS business logic (generators) separated from GAS side-effects (consumers).

**Example - Expiration Processing**:
- `Manager.generateExpiringMembersList()`: Pure function returns message array (tested)
- `MembershipManagement.generateExpiringMembersList()`: GAS wrapper persists to `ExpirationFIFO` sheet
- `Manager.processExpiredMembers()`: Pure function accepts injected `sendEmailFun`/`groupRemoveFun` (tested)
- `MembershipManagement.processExpirationFIFO()`: GAS wrapper injects `MailApp`/`AdminDirectory`

**When adding features**: Extract business logic into `Manager` class methods accepting injected functions. Write GAS wrappers in `MembershipManagement` namespace.

### Data Access via Fiddler Library
All spreadsheet access goes through `Common.Data.Storage.SpreadsheetManager.getFiddler(sheetName)` which uses the external `bmPreFiddler` library. Sheets are configured in a `Bootstrap` sheet mapping references to sheet names/IDs.

**Pattern**:
```javascript
const fiddler = Common.Data.Storage.SpreadsheetManager.getFiddler('ActiveMembers');
const data = fiddler.getData();           // Get current data
fiddler.setData(newData).dumpValues();   // Write back to sheet
```

**Per-execution caching**: Fiddlers are automatically cached within a single GAS execution to avoid redundant spreadsheet opens. When multiple functions run in the same execution (e.g., `generateExpiringMembersList` calling `processExpirationFIFO`), fetch all needed fiddlers at the start and pass them through function calls to avoid cache lookups.

```javascript
// GOOD: Get fiddlers once and pass through to called functions
const membershipFiddler = getFiddler('ActiveMembers');
const expiryFiddler = getFiddler('ExpirySchedule');
// Pass to helper functions to avoid even cache lookups
someFunction({ fiddlers: { membershipFiddler, expiryFiddler } });

// ACCEPTABLE: Multiple getFiddler calls benefit from cache but still do lookup overhead
function foo() {
  const fiddler = getFiddler('ActiveMembers'); // Opens spreadsheet and caches
}
function bar() {
  const fiddler = getFiddler('ActiveMembers'); // Cache hit, but still does lookup
}
```

Call `Common.Data.Storage.SpreadsheetManager.clearFiddlerCache(sheetName)` if external code modifies a sheet and you need fresh data.

For formulas: `Common.Data.Storage.SpreadsheetManager.getDataWithFormulas(fiddler)` merges formula and value data.

### Circular Dependency Prevention (CRITICAL)

**Layered Architecture** (enforced by tests in `__tests__/circular-dependency.test.js`):

**Layer 0: Foundation (NO Common.Logger allowed)**
- `src/common/data/storage/SpreadsheetManager.js` - Low-level sheet access
- `src/common/config/Properties.js` - Property management
- `src/common/utils/Logger.js` - Structured logging

**Rules**:
- MUST use `Logger.log()` only (GAS built-in)
- MUST NOT use `Common.Logger.*` methods
- Reason: `Common.Logger` depends on Properties/SpreadsheetManager, creating circular dependency

**Layer 1: Infrastructure (Common.Logger safe)**
- `src/common/data/data_access.js` - High-level data access helpers
- Other utility modules

**Layer 2: Application Services**
- `MembershipManagement`, `VotingService`, etc.
- Use `Common.Logger.*` for all logging

**Logger Initialization**:
```javascript
// In onOpen, menu handler, or main entry point
function onOpen() {
  Common.Logger.configure();  // Loads config from Properties sheet
  Common.Logger.info('App', 'Application initialized');
}
```

**DO NOT**:
- Call `Common.Logger.*` in SpreadsheetManager.js or Properties.js
- Call Properties methods from Logger.js internal functions
- Use dynamic property lookups in hot code paths (logger calls on every log statement)

### Service-Based Architecture
Each service (`MembershipManagement`, `VotingService`, `DirectoryService`, etc.) follows namespace pattern:
- **`Service.Internal`**: Private GAS-dependent initialization helpers
- **`Service.Manager`**: Pure logic class (testable)
- **`Service.WebApp`**: Web UI handlers (doGet/doPost endpoints) - DEPRECATED for SPA services
- **`Service.Api`**: Data endpoints for SPA services (returns JSON, not HTML)
- **`Service.Trigger`**: Time/form-based trigger functions

Services registered in `src/1namespaces.js` and routed via `src/webApp.js` doGet handler using `?service=` parameter.

### SPA Architecture (CRITICAL for Web Services)

**ALL web services use data-driven Single Page Application architecture**. See `docs/SPA_ARCHITECTURE.md` for complete documentation.

**Core Rules**:
1. **Server returns JSON data ONLY** - never return HTML from `getServiceContent()`
2. **Client renders HTML from data** - all rendering in `_Header.html` renderer functions
3. **Scripts in innerHTML don't execute** - use `loadScript()` for external libraries
4. **Always escape user data** - use `escapeHtml()` to prevent XSS

**Adding a New Service**:
```javascript
// 1. Server endpoint (webapp_endpoints.js)
function getServiceContent(email, service) {
  if (service === 'YourService') {
    return {
      serviceName: 'Your Service',
      yourData: YourService.getData(email)
    };
  }
}

// 2. Client renderer (_Header.html)
function renderYourService(data, container) {
  // Set HTML structure
  container.innerHTML = `<div>...</div>`;
  
  // Load external scripts if needed
  loadScript('https://cdn.example.com/lib.js').then(() => {
    initLibrary(data.yourData);
  });
}

// 3. Add to router (_Header.html)
function renderService(serviceId, data, container) {
  switch(serviceId) {
    case 'YourService':
      renderYourService(data, container);
      break;
  }
}
```

**NEVER**:
- Return HTML from `getServiceContent()` for SPA navigation
- Put `<script>` tags in template literals for `innerHTML`
- Use `document.write()` (destroys entire document)
- Skip `escapeHtml()` when inserting user data

**ALWAYS**:
- Use `loadScript(src)` for external JavaScript libraries
- Use `loadStylesheet(href)` for external CSS
- Pass `container` to renderer functions
- Include "Back to Services" navigation link
- Log to console during development
- Test on all responsive breakpoints
- **Remove Date objects before returning data from `Service.Api.getData()`** - `google.script.run` cannot serialize Date objects and will return `null` to the client. Format dates to strings using `Utilities.formatDate()` and delete the original Date properties.

### Responsive CSS Framework (SPA Services)

All web services MUST use the existing responsive CSS framework in `src/common/html/_Header.html`. DO NOT duplicate or reimplement the responsive breakpoint logic.

Features:
- Breakpoint-based responsive design using classes applied to the `<html>` element.
- Device classes: `is-mobile-portrait`, `is-mobile-landscape`, `is-tablet`.
- Base font-size scaling per device; use `rem` units for service styles.
- Shared utilities: `checkViewportAndApplyClasses()`, `disableForm()`, `enableForm()` are provided by `_Header.html`.

Service authoring pattern:
```
<!-- Service HTML (e.g. GroupManagementApp.html) -->
<!-- _Layout.html includes _Header.html which sets up the classes and utilities -->
<style>
  /* Desktop defaults */
  #serviceForm { display: grid; grid-template-columns: auto 1fr; gap: 10px; }

  /* Tablet */
  html.is-tablet #serviceForm { grid-template-columns: 1fr; }

  /* Mobile portrait */
  html.is-mobile-portrait #serviceForm { padding: 15px; gap: 12px; }
</style>

<script>
  async function saveData() {
    const form = document.getElementById('serviceForm');
    disableForm(form);
    try {
      await google.script.run.withSuccessHandler(() => enableForm(form)).saveData(data);
    } catch (e) {
      enableForm(form);
      throw e;
    }
  }
</script>
```

CRITICAL: always reference `_Header.html` for breakpoint behavior and UX helpers; test on desktop, tablet, mobile-portrait and mobile-landscape.

### Magic Link Authentication
Users access web services via tokenized URLs. Flow:
1. User requests access at `?page=request&service=ServiceName`
2. `Common.Auth.Utils.sendMagicLink()` generates token and emails link
3. User clicks link with `?token=xxx` parameter
4. `Common.Auth.TokenStorage.consumeToken()` validates and marks token as used
5. Service-specific `doGet()` renders content for authenticated user

### TypeScript Type Annotations in JavaScript
Use JSDoc with type references for IDE support:
```javascript
/// <reference path="./Types.d.ts" />
// @ts-check

/** @type {MembershipManagement.FIFOItem[]} */
const queue = [];
```

Type definitions in `src/types/*.d.ts` and service-specific `*.d.ts` files. The `@ts-check` comment enables TypeScript checking without compilation.

## Development Workflows

### Testing Details

**Test structure**: Factory functions in `TestData` namespace provide default test objects with overrides (see `__tests__/Manager.test.js` lines 40-100). Mock GAS globals in `__mocks__/google-apps-script.ts`.

**Debugging tests**: Each test file has a table of contents comment. Tests organized by member lifecycle (onboarding, expiration, supporting functions).

### Deployment Details

**Version tracking**: `clasp:create-version` embeds git tag/commit in GAS version description. Always commit before production deployment (`git:enforce-clean` enforces clean working directory).

**Testing deployed services**:
```bash
npm run dev:profile-test    # Opens ProfileManagementService in dev
npm run stage:group-test    # Opens GroupManagementService in staging
```

### Triggers and Background Processing
Time-based triggers call functions like `checkPaymentStatus()` and `processExpirationFIFOTrigger()` (see `src/services/MembershipManagement/Trigger.js`). Form submission triggers in VotingService (`onFormSubmit_`) validate votes and record to results sheets.

## Service-Specific Conventions

### MembershipManagement
**FIFO Attempt Pattern**: `ExpirationFIFO` sheet stores failed email/group operations. Items have:
- Attempt bookkeeping: `attempts`, `lastAttemptAt`, `nextAttemptAt`, `lastError`
- `dead` flag when max attempts exceeded (moved to dead-letter sheet)
- Exponential backoff via `MembershipManagement.Utils.computeNextAttemptAt(attempts)`

**Manager is authoritative**: Business logic in `Manager` class decides retry behavior. GAS wrapper only persists `failedMeta` returned by `processExpiredMembers()`.

### VotingService
**Form-based voting**: Elections use Google Forms. Each election has:
- Ballot form (Google Form) owned by `membership_automation@sc3.club`
- Results spreadsheet with `Validated Results` and `Invalid Results` sheets
- `onFormSubmit` trigger to validate votes (checks multi-voting)

**Election lifecycle**: `manageElectionLifecycles()` opens/closes forms based on `Start`/`End` dates in `Elections` sheet. States: `UNOPENED`, `ACTIVE`, `CLOSED` (see `VotingService.Constants.ElectionState`).

**Constants pattern**: `src/services/VotingService/0Constants.js` defines column names and constants used across VotingService. Filename prefix `0` ensures it loads first in GAS concatenation.

### Template Expansion
Email templates use `{FieldName}` placeholders expanded by `MembershipManagement.Utils.expandTemplate(template, row)`. Date fields automatically formatted. See `ActionSpecs` sheet for email templates with hyperlinks stored as formulas.

### Audit Logging Pattern

**Pure business logic generates audit entries**:
- `Manager` classes accept optional `auditLogger` parameter in constructor
- Methods return `{ ..., auditEntries: Audit.LogEntry[] }` alongside business results
- GAS wrappers persist audit entries to `Audit` sheet via fiddler

**Example**:
```javascript
const auditLogger = new Audit.Logger();
const manager = new MembershipManagement.Manager(
  actionSpecs, groups, groupManager, emailSender, 
  undefined,  // today
  auditLogger
);

const result = manager.processPaidTransactions(txns, members, schedule);
// result.auditEntries contains log entries for persistence
```

**Error Handling Pattern**:
- Manager methods MUST return errors as data, not throw exceptions
- Return shape: `{ businessResult, auditEntries, errors }` where `errors` is an array
- Allows partial success handling and consistent audit logging
- See `docs/ISSUE-AGGREGATEERROR.md` for rationale

## Bootstrap Configuration

All sheet references configured in `Bootstrap` sheet:

| Reference | iD | sheetName | createIfMissing |
|-----------|---|-----------|-----------------|
| SystemLogs |  | System Logs | True |
| Properties |  | Properties | False |
| ActiveMembers |  | ActiveMembers | False |
| ExpirationFIFO |  | ExpirationFIFO | True |

See `docs/BOOTSTRAP_CONFIGURATION.md` for full schema.

**When adding new sheets**:
1. Add row to Bootstrap sheet
2. Add TypeScript type definition in `src/types/global.d.ts`
3. Use via `Common.Data.Storage.SpreadsheetManager.getFiddler('SheetName')`

## Key Files Reference
- `src/1namespaces.js`: All service namespaces (loads first)
- `src/webapp_endpoints.js`: Global functions callable from web UIs via `google.script.run`
- `src/webApp.js`: doGet router dispatching to service WebApp handlers
- `src/common/data/data_access.js`: `Common.Data.Access` namespace for data retrieval
- `src/common/html/_Header.html`: Shared responsive CSS framework (MUST use for all web services)
- `src/common/html/_Layout.html`: Master HTML template that includes `_Header.html` and service content
- `src/services/MembershipManagement/Manager.js`: Pure membership logic (testable)
- `src/services/MembershipManagement/MembershipManagement.js`: GAS orchestration
- `src/services/GroupManagementService/Manager.js`: SPA service Manager example
- `src/services/GroupManagementService/Api.js`: SPA API layer example
- `src/services/GroupManagementService/GroupManagementApp.html`: SPA HTML with CSS framework
- `__tests__/Manager.test.js`: Comprehensive test suite with table of contents
- `__mocks__/google-apps-script.ts`: GAS globals mocking
- `jest.setup.ts`: Global test configuration
- `src/types/global.d.ts`: Global TypeScript types
- `src/types/membership.d.ts`: Membership-specific types
- `docs/NAMESPACE_DECLARATION_PATTERN.md`: Namespace extension pattern (CRITICAL)
- `docs/LOGGER_ARCHITECTURE.md`: Logger layering and initialization
- `docs/BOOTSTRAP_CONFIGURATION.md`: Sheet configuration reference
- `docs/ExpirationFIFO_SCHEMA.md`: FIFO queue schema and contract
- `docs/GAS-PR-TESTING.md`: How to test PRs in GAS environment
- `docs/issues/ISSUE-SPA-AND-AUTH-COMBINED.md`: SPA migration master plan

## Common Gotchas
- **Namespace declarations**: ALWAYS use `if (typeof Namespace === 'undefined')` pattern when extending namespaces (see `docs/NAMESPACE_DECLARATION_PATTERN.md`)
- **Sheet access always via Fiddler**: Never use `SpreadsheetApp.getActiveSpreadsheet()` directly for data access
- **Formula handling**: Use `convertLinks()` before `getDataWithFormulas()` for cells with rich text hyperlinks
- **Module exports**: Files include Node.js module checks (`if (typeof module !== 'undefined')`) for Jest compatibility
- **Environment switching**: Running wrong clasp command deploys to wrong environment - always use `npm run {env}:*` scripts
- **Test mocking**: GAS globals like `PropertiesService` mocked in `jest.setup.ts` (imports `__mocks__/google-apps-script.ts`)
- **Circular dependencies**: Build fails if Layer 0 modules use `Common.Logger.*` - tests enforce this

## Current Migration: SPA Architecture + Verification Code Authentication

**Active Project**: Migrating 5 web services from magic link + multi-page to verification code + SPA architecture.

**Status**: Tracked in Issue #291

**Completed Phases**:
- Phase 0: Foundation (ApiClient, FeatureFlags, VerificationCode infrastructure)
- Phase 1: Authentication flow (verification code UI, backward compatibility)
- Phase 2: GroupManagementService SPA migration
- Phase 3: ProfileManagementService SPA migration
- Phase 4: DirectoryService SPA migration
- Phase 5: EmailChangeService SPA migration
- Phase 6: VotingService SPA migration
- Phase 7: Cleanup (deprecation notices, documentation updates)

**Key Migration Principles**:
1. **Feature Flags**: Use `Common.Config.FeatureFlags.isNewAuthEnabled()` for safe rollout
2. **Backward Compatibility**: Magic links still work when flag is OFF (deprecated, will be removed)
3. **Verification Codes**: 6-digit codes, 10-minute expiry, rate limiting (5 attempts)
4. **SPA Pattern**: Single doGet for bootstrap, then `google.script.run` APIs
5. **Session Management**: Tokens in memory only (not in HTML/URL)
6. **CSS Framework**: MUST use existing `_Header.html` responsive framework

**Services in Migration Scope**:
1. ✅ GroupManagementService (Phase 2)
2. ✅ ProfileManagementService (Phase 3)
3. ✅ DirectoryService (Phase 4)
4. ✅ EmailChangeService (Phase 5)
5. ✅ VotingService (Phase 6)

**Out of Scope**: EmailService, DocsService (modal dialogs), MembershipManagement (triggers only)

**Complete Plan**: `docs/issues/ISSUE-SPA-AND-AUTH-COMBINED.md`

**Deprecated Code (Phase 7)**:
The following will be removed after Phase 8 production rollout:
- `sendMagicLink()` in `webapp_endpoints.js`
- `Common.Auth.Utils.sendMagicLink()` in `utils.js`
- `src/common/auth/magicLinkInput.html`

**CRITICAL for SPA Development**:
- ALL business logic in `Service.Manager.js` (pure, testable)
- GAS orchestration ONLY in `Service.Api.js`
- Follow `GroupManagementService` as template
- Use responsive CSS framework from `_Header.html`
- Test coverage: Manager 100%, Api 95%+
- Manual test all breakpoints before PR review
