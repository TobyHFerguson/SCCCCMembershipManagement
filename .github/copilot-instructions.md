# SCCCC Management Copilot Instructions

## Project Overview
Google Apps Script (GAS) membership management system for SCCCC. Hybrid TypeScript/JavaScript with pure-logic core functions tested via Jest, and GAS-specific wrappers for runtime integration.

## Critical Architecture Patterns

### Namespace Declaration Pattern (CRITICAL)

**Hybrid environment challenge**: Files run concatenated in GAS but independently in Jest. `1namespaces.js` declares all root namespaces with `const`, loading first in GAS.

**REQUIRED pattern for ANY file extending a namespace**:
```javascript
// ✅ CORRECT: Works in both GAS and Jest
if (typeof NamespaceName === 'undefined') NamespaceName = {};
NamespaceName.SubNamespace = NamespaceName.SubNamespace || {};
```

**NEVER do this**:
```javascript
// ❌ WRONG: Conflicts with const in 1namespaces.js
var Audit = Audit || {};
const Common = Common || {};
```

**Why**: In GAS, `const Audit = {}` already exists from `1namespaces.js`. Redeclaring with `var`/`const` causes `SyntaxError: Identifier 'Audit' has already been declared`. The `typeof` check skips redeclaration in GAS but creates namespace in Jest.

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
- **`Service.WebApp`**: Web UI handlers (doGet/doPost endpoints)
- **`Service.Trigger`**: Time/form-based trigger functions

Services registered in `src/1namespaces.js` and routed via `src/webApp.js` doGet handler using `?service=` parameter.

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

### Testing
```bash
npm test                    # Run all Jest tests
npm test Manager.test.js    # Run specific test file
```

**Test structure**: Factory functions in `TestData` namespace provide default test objects with overrides (see `__tests__/Manager.test.js` lines 40-100). Mock GAS globals in `__mocks__/google-apps-script.ts`.

**Debugging tests**: Each test file has a table of contents comment. Tests organized by member lifecycle (onboarding, expiration, supporting functions).

### Deployment (Clasp)
Three environments: dev, staging, prod. Scripts use clasp-env to switch `.clasp.json`.

```bash
npm run dev:push            # Watch mode deployment to dev
npm run dev:deploy          # Deploy to dev test deployment
npm run stage:deploy        # Full staging deploy (push + version + redeploy)
npm run prod:deploy-live    # Production deploy with git versioning
```

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
- `src/webapp_endpoints.js`: Global functions callable from web UIs
- `src/webApp.js`: doGet router dispatching to service WebApp handlers
- `src/common/data/data_access.js`: `Common.Data.Access` namespace for data retrieval
- `src/services/MembershipManagement/Manager.js`: Pure membership logic
- `__tests__/Manager.test.js`: Comprehensive test suite with table of contents
- `docs/NAMESPACE_DECLARATION_PATTERN.md`: Namespace extension pattern guide
- `docs/LOGGER_ARCHITECTURE.md`: Logger layering and initialization guide
- `docs/BOOTSTRAP_CONFIGURATION.md`: Sheet configuration reference
- `docs/ExpirationFIFO_SCHEMA.md`: FIFO queue schema and contract

## Common Gotchas
- **Namespace declarations**: ALWAYS use `if (typeof Namespace === 'undefined')` pattern when extending namespaces (see `docs/NAMESPACE_DECLARATION_PATTERN.md`)
- **Sheet access always via Fiddler**: Never use `SpreadsheetApp.getActiveSpreadsheet()` directly for data access
- **Formula handling**: Use `convertLinks()` before `getDataWithFormulas()` for cells with rich text hyperlinks
- **Module exports**: Files include Node.js module checks (`if (typeof module !== 'undefined')`) for Jest compatibility
- **Environment switching**: Running wrong clasp command deploys to wrong environment - always use `npm run {env}:*` scripts
- **Test mocking**: GAS globals like `PropertiesService` mocked in `jest.setup.ts` (imports `__mocks__/google-apps-script.ts`)
- **Circular dependencies**: Build fails if Layer 0 modules use `Common.Logger.*` - tests enforce this
