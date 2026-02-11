---
applyTo: '**'
---

# SCCCC Membership Management - Copilot Instructions

> **📚 Universal GAS Patterns**: For Google Apps Script development best practices (type safety, testing,
> TDD workflow, architecture patterns, Core/Adapter separation, Fiddler usage), see [`gas-best-practices.md`](./gas-best-practices.md).
>
> **📝 Writing Issues for Agents**: When creating GitHub issues for automated coding agents,
> follow [`agent-issue-guidelines.md`](./agent-issue-guidelines.md).
>
> This file contains **SCCCCMembershipManagement-specific** guidelines only.

---

## Project Overview

Google Apps Script (GAS) membership management system for **Santa Cruz County Cycling Club (SCCCC)**. 

**Technology Stack**:
- Hybrid TypeScript/JavaScript
- Pure-logic core functions (Manager classes) tested via Jest
- GAS-specific wrappers for runtime integration
- Data storage: Google Sheets via Fiddler library
- Authentication: Verification codes + magic links (deprecated)

**Architecture**: Data-driven Single Page Application (SPA) where server returns JSON data and client renders HTML. See `docs/SPA_ARCHITECTURE.md` for complete documentation.

---

## Quick Start

**Install dependencies:**
```bash
npm install
```

**Run tests:**
```bash
npm test                    # Run all Jest tests
npm test Manager.test.js    # Run specific test file
```

**Validation (run before every commit):**
```bash
npm run verify-rules        # Check all code rules (universal + project-specific)
npm run validate-all        # Full pipeline: typecheck + verify-rules + tests
```

**Linting:**
```bash
# Prettier auto-formats on save (config in .prettierrc.js)
npx prettier --write .
```

**Deployment (Clasp):**
Three environments: dev, staging, prod. Scripts use clasp-env to switch `.clasp.json`.

```bash
npm run dev:push            # Watch mode deployment to dev
npm run dev:deploy          # Deploy to dev test deployment
npm run stage:deploy        # Full staging deploy (push + version + redeploy)
npm run prod:deploy-live    # Production deploy with git versioning
```

---

## Project-Specific Boundaries

> **Note**: For universal GAS restrictions (type safety, no `any`, Core/Adapter pattern, etc.), 
> see [`gas-best-practices.md`](./gas-best-practices.md).

**DO NOT (SCCCCMembershipManagement-specific)**:
- Access spreadsheets directly via `SpreadsheetApp.getActiveSpreadsheet()` - **always use SheetAccess**
- Use SpreadsheetManager or Fiddler directly in new code - **use SheetAccess abstraction**
- Use `AppLogger` in Layer 0 modules (SpreadsheetManager.js, Properties.js, Logger.js) - creates circular dependency
- Throw exceptions from Manager methods - **return errors as data** instead (allows partial success handling)
- Skip tests when modifying Manager class business logic
- Open a PR without running `npm test` and ensuring all tests pass
- Modify production configuration without review

**ALWAYS (SCCCCMembershipManagement-specific)**:
- Run `npm test` BEFORE every commit and verify all tests pass
- Use `npm run {env}:*` scripts for deployment (never run clasp commands directly)
- Use SheetAccess for ALL spreadsheet operations (wraps SpreadsheetManager/Fiddler)
- Extract business logic into testable Manager classes
- Follow the SPA architecture for web services (see below)

### Automated Rule Verification

Project-specific rules are enforced by `verify-project-rules.sh`. Universal GAS rules are enforced by `verify-gas-rules.sh` (shared via symlink from `_shared/`).

**Run all checks:**
```bash
npm run verify-rules        # Runs both scripts
npm run validate-all        # Full pipeline: typecheck:src + verify-rules + tests
```

**What gets checked automatically:**

| Rule | Script | Check Type |
|------|--------|------------|
| No direct SpreadsheetManager in services | `verify-project-rules.sh` | ❌ Error |
| No `getActiveSpreadsheet()` in services | `verify-project-rules.sh` | ⚠️ Warning |
| No AppLogger in Layer 0 modules | `verify-project-rules.sh` | ❌ Error |
| No `@param {Object}` | `verify-gas-rules.sh` | ❌ Error |
| No unjustified `@param {any}` | `verify-gas-rules.sh` | ❌ Error |
| No forbidden GAS APIs | `verify-gas-rules.sh` | ❌ Error |
| No static class fields | `verify-gas-rules.sh` | ❌ Error |
| No bare class declarations | `verify-gas-rules.sh` | ❌ Error |
| `Record<string, any>` audit | `verify-gas-rules.sh` | ⚠️ Warning |

**Justification pattern**: Rules that allow exceptions require `JUSTIFIED:` on the same line:
```javascript
// ✅ Passes verification
@param {any} data - Debug payload (JUSTIFIED: arbitrary debugging data, JSON-serialized)

// ❌ Fails verification
@param {any} data - The data
```

---

## Service Architecture

### Service Organization

Each service follows this namespace pattern:

- **`Service.Internal`**: Private GAS-dependent initialization helpers
- **`Service.Manager`**: Pure logic class (100% testable, no GAS dependencies)
- **`Service.Api`**: Data endpoints for SPA services (returns JSON only, not HTML)
- **`Service.Trigger`**: Time/form-based trigger functions

**Service Registry**: All services registered in `src/1namespaces.js` and routed via `src/webApp.js` doGet handler.

### SPA Architecture (CRITICAL for Web Services)

**ALL web services MUST use Single Page Application architecture**. See `docs/SPA_ARCHITECTURE.md` for complete documentation.

**Core Principles**:
1. **Server returns JSON data ONLY** - never return HTML from `getServiceContent()`
2. **Client renders HTML from data** - all rendering in `_Header.html` renderer functions
3. **Scripts in innerHTML don't execute** - use `loadScript()` for external libraries
4. **Always escape user data** - use `escapeHtml()` to prevent XSS
5. **Remove Date objects** before returning from `Service.Api.getData()` - GAS cannot serialize them

**SPA Code Quality Requirements** (enforced before PR approval):
- ✅ All `Service.Api.getData()` methods have try-catch, return errors as data
- ✅ No Date objects in returned data (formatted to strings and deleted)
- ✅ All client renderers use `|| defaults` for null-safe data access
- ✅ Form validation checks `.trim() !== ''` not just `!== ''`
- ✅ Submit buttons check `changed && valid`, not just `changed`
- ✅ JSDoc includes Date serialization warnings
- ✅ Manually tested on all responsive breakpoints

**See**: `docs/SPA_ARCHITECTURE.md` for complete patterns and examples.

### Responsive CSS Framework

**CRITICAL**: Use the existing responsive CSS framework in `src/common/html/_Header.html`. **DO NOT** duplicate responsive logic.

**Key Points**:
- GAS does NOT support `@media` queries - use class-based selectors instead
- Classes applied to `<html>` element: `is-mobile-portrait`, `is-mobile-landscape`, `is-tablet`
- Desktop = no class (default styles)
- Use `rem` units for sizes (base font-size scales per device)

**Pattern**:
```css
/* Desktop defaults (no class prefix) */
#form { display: grid; grid-template-columns: 150px 1fr; }

/* Tablet */
html.is-tablet #form { grid-template-columns: 130px 1fr; }

/* Mobile Landscape */
html.is-mobile-landscape #form { grid-template-columns: 120px 1fr; }

/* Mobile Portrait - single column */
html.is-mobile-portrait #form { 
  grid-template-columns: 1fr; 
  gap: 10px; 
}
```

**Always test on all 4 breakpoints**: desktop, tablet, mobile-landscape, mobile-portrait.

---

## Data Access Pattern

**ALWAYS use `SheetAccess` for spreadsheet operations** (not direct SpreadsheetManager or Fiddler calls):

**Recommended Pattern**:
```javascript
// Read data as objects
const data = SheetAccess.getData('ActiveMembers');

// Read data as 2D arrays (with headers)
const allData = SheetAccess.getDataAsArrays('ActiveMembers');

// Write data
SheetAccess.setData('ActiveMembers', updatedData);

// For formulas/rich text links
SheetAccess.convertLinks('ActionSpecs');
const specs = SheetAccess.getDataWithFormulas('ActionSpecs');

// Advanced: Get raw Sheet or Fiddler when needed
const sheet = SheetAccess.getSheet('ActiveMembers');
const fiddler = SheetAccess.getFiddler('ActiveMembers');
```

**SheetAccess provides abstraction over Fiddler library**, enabling future migration to native SpreadsheetApp without changing call sites.

### Legacy Pattern (avoid in new code)
```javascript
// ❌ Old pattern - direct SpreadsheetManager/Fiddler use
const fiddler = SpreadsheetManager.getFiddler('ActiveMembers');
const data = fiddler.getData();
```

**Per-execution caching**: SheetAccess maintains Fiddler's per-execution caching behavior. When multiple functions run in the same execution, the same data is reused automatically.

**Sheets Configuration**: All sheet references configured in `Bootstrap` sheet. See `docs/BOOTSTRAP_CONFIGURATION.md`.

### Column-Order Independence (CRITICAL for ValidatedXXX types)

**ValidatedXXX classes** (`ValidatedMember`, `ValidatedTransaction`, `ValidatedElection`, etc.) are domain objects whose property keys correspond to sheet column names. **Sheet column order must NEVER be assumed** — columns can be reordered without breaking code.

**Rules** (see `gas-best-practices.md` → Column-Order Independence for full details):
- ✅ `fromRow()` MUST use header-based lookup (map `headers[i]` → `rowArray[i]`)
- ✅ Writing to sheets MUST use `sheetHeaders.map(h => member[h])` — never `toArray()`
- ✅ `MemberPersistence.writeChangedCells` compares `original[j]` vs `member[headers[j]]`
- ✅ Every `ValidatedXXX` class MUST have a column-order independence test
- ❌ **NEVER** use `toArray()` for sheet persistence — only for serialization/testing

---

## Circular Dependency Prevention

**Layered Architecture** (enforced by tests in `__tests__/circular-dependency.test.js`):

**Layer 0: Foundation** (NO `AppLogger` allowed):
- `src/common/data/storage/SpreadsheetManager.js` - Low-level sheet access
- `src/common/config/Properties.js` - Property management
- `src/common/utils/Logger.js` - Structured logging (defines AppLogger)

Use `Logger.log()` (GAS built-in) only - no `AppLogger` methods.

**Layer 1: Infrastructure** (`AppLogger` safe):
- `src/common/data/SheetAccess.js` - Spreadsheet abstraction layer (wraps SpreadsheetManager)
- `src/common/data/data_access.js` - High-level data access
- Other utility modules

**Layer 2: Application Services**:
- `MembershipManagement`, `VotingService`, etc.
- Use `AppLogger` for all logging

**Logger Initialization**:
```javascript
function onOpen() {
  AppLogger.configure();  // Loads config from Properties sheet
  AppLogger.info('App', 'Application initialized');
}
```

---

## Service-Specific Conventions

### MembershipManagement

**FIFO Retry Pattern**: `ExpirationFIFO` sheet stores failed email/group operations for retry with exponential backoff.

**Item Structure**:
- Bookkeeping: `attempts`, `lastAttemptAt`, `nextAttemptAt`, `lastError`
- `dead` flag when max attempts exceeded (moved to dead-letter sheet)
- Retry schedule: `MembershipManagement.Utils.computeNextAttemptAt(attempts)`

**Manager is Authoritative**: Business logic in `Manager` class decides retry behavior. GAS wrapper only persists `failedMeta` returned by `processExpiredMembers()`.

**See**: `docs/ExpirationFIFO_SCHEMA.md` for complete schema.

### VotingService

**Form-Based Voting**: Elections use Google Forms.

**Election Components**:
- Ballot form (Google Form) owned by `membership_automation@sc3.club`
- Results spreadsheet with `Validated Results` and `Invalid Results` sheets
- `onFormSubmit` trigger validates votes (prevents multi-voting)

**Election Lifecycle**: `manageElectionLifecycles()` opens/closes forms based on `Start`/`End` dates in `Elections` sheet.

**States**: `UNOPENED`, `ACTIVE`, `CLOSED` (see `VotingService.Constants.ElectionState`)

**Constants Pattern**: `src/services/VotingService/0Constants.js` defines column names. Filename prefix `0` ensures it loads first in GAS concatenation.

### Template Expansion

Email templates use `{FieldName}` placeholders expanded by `MembershipManagement.Utils.expandTemplate(template, row)`. 

- Date fields automatically formatted
- Templates stored in `ActionSpecs` sheet
- Hyperlinks stored as formulas

### Audit Logging

**Pure Logic Generates Audit Entries**:
- `Manager` classes accept optional `auditLogger` parameter
- Methods return `{ ..., auditEntries: Audit.LogEntry[] }` alongside business results
- GAS wrappers persist audit entries to `Audit` sheet via Fiddler

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

---

## Current Migration: SPA + Verification Code Auth

**Status**: Tracked in Issue #291

**Completed Phases**:
- ✅ Phase 0-9: All 5 services migrated to SPA + verification code auth with production rollout complete
  - GroupManagementService
  - ProfileManagementService  
  - DirectoryService
  - EmailChangeService
  - VotingService

**Key Patterns**:
1. **Verification Codes**: 6-digit codes, 10-minute expiry, rate limiting (5 attempts)
2. **SPA Pattern**: Single doGet for bootstrap, then `google.script.run` APIs
3. **Session Management**: Tokens in memory only (not in HTML/URL)
4. **Feature Flags**: `Common.Config.FeatureFlags.isNewAuthEnabled()` for future rollouts

**Complete Migration Plan**: `docs/issues/ISSUE-SPA-AND-AUTH-COMBINED.md`

---

## Key Files Reference

**Core Infrastructure**:
- `src/1namespaces.js` - All service namespaces (loads first in GAS)
- `src/webapp_endpoints.js` - Global functions callable from web UIs via `google.script.run`
- `src/webApp.js` - doGet router dispatching to service handlers
- `src/common/data/data_access.js` - `Common.Data.Access` namespace for data retrieval
- `src/common/html/_Header.html` - Shared responsive CSS framework
- `src/common/html/_Layout.html` - Master HTML template

**Services** (examples):
- `src/services/MembershipManagement/Manager.js` - Pure membership logic (testable)
- `src/services/MembershipManagement/MembershipManagement.js` - GAS orchestration
- `src/services/GroupManagementService/Manager.js` - SPA service Manager example
- `src/services/GroupManagementService/Api.js` - SPA API layer example
- `src/services/GroupManagementService/GroupManagementApp.html` - SPA HTML

**Testing**:
- `__tests__/Manager.test.js` - Comprehensive test suite with table of contents
- `__tests__/FIFOBatchProcessing.test.js` - Example of comprehensive pure function tests
- `__mocks__/google-apps-script.ts` - GAS globals mocking
- `jest.setup.ts` - Global test configuration

**Types**:
- `src/types/global.d.ts` - Global TypeScript types
- `src/types/membership.d.ts` - Membership-specific types

**Documentation**:
- `docs/NAMESPACE_DECLARATION_PATTERN.md` - Namespace extension pattern (CRITICAL)
- `docs/LOGGER_ARCHITECTURE.md` - Logger layering and initialization
- `docs/BOOTSTRAP_CONFIGURATION.md` - Sheet configuration reference
- `docs/ExpirationFIFO_SCHEMA.md` - FIFO queue schema and contract
- `docs/SPA_ARCHITECTURE.md` - Complete SPA implementation guide
- `docs/GAS-PR-TESTING.md` - How to test PRs in GAS environment
- `docs/issues/ISSUE-SPA-AND-AUTH-COMBINED.md` - SPA + Auth Phase 9 (current production rollout)

**Archived Documentation** (completed work):
- `docs/archive/` - Historical migration documentation for completed phases
- `docs/archive/ISSUE-SPA-PHASES-0-8.md` - SPA migration phases 0-8 (archived for reference)
- `docs/archive/ISSUE-346-NAMESPACE-FLATTENING.md` - Namespace flattening migration (completed)

---

## Common Gotchas

**MembershipManagement-Specific**:
- **Sheet access**: Never use `SpreadsheetApp.getActiveSpreadsheet()` - always use Fiddler
- **Formula handling**: Use `convertLinks()` before `getDataWithFormulas()` for cells with rich text hyperlinks
- **Environment switching**: Wrong clasp command deploys to wrong environment - always use `npm run {env}:*` scripts
- **Circular dependencies**: Tests fail if Layer 0 modules use `AppLogger`
- **Date serialization**: `google.script.run` cannot serialize Date objects - convert to strings first

**For universal GAS gotchas** (module exports, namespace declarations, type annotations), 
see [`gas-best-practices.md`](./gas-best-practices.md).

---

## Development Workflows

### Testing

**Test Structure**: 
- Factory functions in `TestData` namespace provide default test objects with overrides
- Mock GAS globals in `__mocks__/google-apps-script.ts`
- Each test file has table of contents comment
- Tests organized by member lifecycle (onboarding, expiration, supporting functions)

**Running Tests**:
```bash
npm test                    # All tests
npm test Manager.test.js    # Specific file
npm test -- --watch         # Watch mode
```

### Deployment

**Version Tracking**: `clasp:create-version` embeds git tag/commit in GAS version description. Always commit before production deployment (`git:enforce-clean` enforces clean working directory).

**Testing Deployed Services**:
```bash
npm run dev:profile-test    # Opens ProfileManagementService in dev
npm run stage:group-test    # Opens GroupManagementService in staging
```

### Triggers

**Time-Based Triggers**: Call functions like `checkPaymentStatus()` and `processExpirationFIFOTrigger()` (see `src/services/MembershipManagement/Trigger.js`).

**Form Submission Triggers**: VotingService (`onFormSubmit_`) validates votes and records to results sheets.

---

## Git Workflow

- **Branching**: Create feature branches for new features
- **Commits**: Commit frequently with descriptive messages
- **Testing**: ALL tests MUST pass before every commit (`npm test`)
- **PR Requirement**: Run `npm test` and verify 100% pass before opening PR
- **Multi-phase work**: Use "References #issue" in PR description (NOT "Fixes #issue") to keep issue open
- **Clean working directory**: Production deployments require clean git state
- **Version tracking**: Use `clasp:create-version` for git tag/commit embedding

---

## Related Resources

- **Universal GAS Best Practices**: [`gas-best-practices.md`](./gas-best-practices.md) (~1,800 lines)
- **Setup Instructions**: [`SETUP_SHARED_PRACTICES.md`](./SETUP_SHARED_PRACTICES.md) - How to create symlink
- **RideManager Shared Patterns**: [RideManager Issue #206](https://github.com/TobyHFerguson/RideManager/issues/206)
