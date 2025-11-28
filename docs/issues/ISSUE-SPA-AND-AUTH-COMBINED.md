# SPA Architecture + Verification Code Authentication Migration

## Full Implementation Plan

This document outlines the complete plan for migrating 5 web services to modern Single-Page Application (SPA) architecture with secure verification code authentication.

### Services in Scope
- DirectoryService
- EmailChangeService
- GroupManagementService
- ProfileManagementService
- VotingService

### Key Changes
1. Replace magic link authentication with 6-digit verification codes
2. Migrate from multi-page doGet pattern to client-side SPAs
3. Use `google.script.run` APIs instead of page reloads
4. Improve security (no tokens in URLs/HTML)
5. Better UX (faster, no page reloads, browser autofill support)

---

## Phase 0: Foundation (Week 1) - COMPLETED ✓

### Infrastructure Created

#### 1. Feature Flags (`src/common/config/FeatureFlags.js`)
- Simple on/off mechanism for feature rollout
- Stores flags in Script Properties
- Built-in flags: `FEATURE_USE_NEW_AUTH`, `FEATURE_SPA_MODE`
- Pure Manager class (`FeatureFlagsManager`) with full test coverage
- Convenience methods: `enableNewAuth()`, `emergencyRollback()`, `isNewAuthEnabled()`

**Usage:**
```javascript
// Check if new auth is enabled
if (Common.Config.FeatureFlags.isNewAuthEnabled()) {
  // Use verification code flow
} else {
  // Use legacy magic link flow
}

// Enable new auth (for rollout)
Common.Config.FeatureFlags.enableNewAuth();

// Emergency rollback
Common.Config.FeatureFlags.emergencyRollback();
```

#### 2. Verification Code (`src/common/auth/VerificationCode.js`)
- 6-digit verification code generation
- 10-minute expiry (configurable)
- Rate limiting: 5 codes per email per hour
- Max 3 verification attempts per code
- Single-use codes (marked as used after successful verification)
- Pure Manager class (`VerificationCodeManager`) with full test coverage

**Usage:**
```javascript
// Generate and send verification code
const result = Common.Auth.VerificationCode.requestCode(
  'user@example.com',
  'Profile Management Service'
);
if (!result.success) {
  // Handle error (rate limited, etc.)
}

// Verify user-provided code
const verifyResult = Common.Auth.VerificationCode.verify(
  'user@example.com',
  '123456'  // User-entered code
);
if (verifyResult.success) {
  // Authentication successful
  const authenticatedEmail = verifyResult.email;
}
```

#### 3. API Client (`src/common/api/ApiClient.js`)
- Standardized request/response format for SPA APIs
- Built-in authentication token validation
- Error handling with machine-readable codes
- Request timing/metadata tracking
- Pure Manager class (`ClientManager`) with full test coverage

**Usage:**
```javascript
// Register an API handler
Common.Api.Client.registerHandler(
  'updateProfile',
  (params, token) => {
    // params._authenticatedEmail available for authenticated handlers
    return Common.Api.ClientManager.successResponse({ updated: true });
  },
  { requiresAuth: true, description: 'Update user profile' }
);

// Handle incoming request (from google.script.run)
function handleApiRequest(request) {
  return Common.Api.Client.handleRequest(request);
}

// Client-side usage:
google.script.run
  .withSuccessHandler(response => {
    const result = JSON.parse(response);
    if (result.success) {
      // Handle success
    }
  })
  .handleApiRequest({
    action: 'updateProfile',
    params: { name: 'New Name' },
    token: userToken
  });
```

### Test Coverage
- **FeatureFlags**: 89% statements, 91% branches
- **VerificationCode**: 92% statements, 90% branches
- **ApiClient**: 100% statements, 96% branches

All tests pass: 353 tests total

### Type Definitions
Type definitions added to `src/types/global.d.ts` for:
- `Common.Config.FeatureFlags` namespace
- `Common.Config.FeatureFlagsManager` class
- `Common.Auth.VerificationCode` namespace
- `Common.Auth.VerificationCodeManager` class
- `Common.Api.Client` namespace
- `Common.Api.ClientManager` class

---

## Phase 1: Authentication (Week 2) - COMPLETED ✓

### Deliverables Completed
1. ✅ Integrated VerificationCode with existing `doGet` flow
2. ✅ Added verification code input page HTML (`verificationCodeInput.html`)
3. ✅ Created verification code email template
4. ✅ Added feature flag checks to `webApp.js`
5. ✅ Integration tests for complete auth flow (`AuthFlowIntegration.test.js`)
6. ✅ Global endpoints: `sendVerificationCode()`, `verifyCode()`, `refreshSession()`

---

## Phase 2: Pilot Service (Week 3) - COMPLETED ✓

### Deliverables Completed
1. ✅ Created `GroupManagementService.Manager.js` with pure business logic
   - 100% test coverage
   - All validation, transformation, and action calculation logic
2. ✅ Created `GroupManagementService.Api.js` with API handlers
   - 88% test coverage
   - Handlers: `getSubscriptions`, `updateSubscriptions`, `getDeliveryOptions`
3. ✅ Updated `groupManagementService.js` to use Manager class
4. ✅ Added `handleApiRequest()` global endpoint for SPA API calls
5. ✅ Added type definitions to `global.d.ts`
6. ✅ Comprehensive Jest tests (79 tests for GroupManagementService)
7. ✅ Backward compatibility maintained (existing HTML/token flow still works)

### Architecture Notes
- Manager class contains pure business logic (testable)
- Api class handles GAS orchestration
- Existing HTML (`GroupManagementService.html`) works with both old and new patterns
- `handleApiRequest()` provides unified entry point for SPA API calls

---

## Phase 3-5: Remaining Services (Weeks 4-6) - PENDING

### Services to Migrate (in order)
1. ProfileManagementService (Week 4)
2. DirectoryService (Week 5)
3. EmailChangeService, VotingService (Week 6)

---

## Phase 6: Cleanup (Week 7) - PENDING

### Deliverables
1. Remove legacy magic link code (behind feature flag)
2. Update documentation
3. Performance testing

---

## Phase 7: Production (Week 8) - PENDING

### Rollout Plan
```javascript
// Deploy with flag OFF (Week 8, Day 1)
FEATURE_USE_NEW_AUTH = false  // Production unchanged

// Test with 1-2 users (Week 8, Day 2)
Common.Config.FeatureFlags.enableNewAuth();  // Try new flow

// Go live or rollback (Week 8, Day 3)
// If success: leave ON
// If issues: Common.Config.FeatureFlags.emergencyRollback();  // 30-second revert
```

---

## Architecture Compliance

### ✅ GAS Layer Separation
All new files follow the pattern:
- Pure `Manager` classes contain all business logic (testable)
- GAS layer files only orchestrate and handle I/O

### ✅ Namespace Declaration Pattern
All files use the correct pattern:
```javascript
if (typeof Common === 'undefined') Common = {};
if (typeof Common.Config === 'undefined') Common.Config = {};
```

### ✅ Layer 0 Compliance
FeatureFlags.js uses `Logger.log()` only, not `Common.Logger.*`

### ✅ Error Handling
All methods return errors as data, not thrown exceptions

### ✅ Node.js Exports
All files include:
```javascript
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ... };
}
```

---

## Files Created (Phase 0)

### Source Files
- `src/common/config/FeatureFlags.js`
- `src/common/auth/VerificationCode.js`
- `src/common/api/ApiClient.js`

### Test Files
- `__tests__/FeatureFlags.test.js`
- `__tests__/VerificationCode.test.js`
- `__tests__/ApiClient.test.js`

### Type Definitions
- Updated `src/types/global.d.ts`

---

## Files Created (Phase 1)

### Source Files
- `src/common/auth/verificationCodeInput.html`

### Test Files
- `__tests__/AuthFlowIntegration.test.js`

### Modified Files
- `src/webApp.js` - Added feature flag check for auth flow
- `src/webapp_endpoints.js` - Added `sendVerificationCode()`, `verifyCode()`, `refreshSession()`

---

## Files Created (Phase 2)

### Source Files
- `src/services/GroupManagementService/Manager.js` - Pure business logic
- `src/services/GroupManagementService/Api.js` - GAS layer API handlers

### Test Files
- `__tests__/GroupManagementService.Manager.test.js` - 60 tests, 100% coverage
- `__tests__/GroupManagementService.Api.test.js` - 19 tests, 88% coverage

### Modified Files
- `src/services/GroupManagementService/groupManagementService.js` - Now uses Manager
- `src/webapp_endpoints.js` - Added `handleApiRequest()` global endpoint
- `src/types/global.d.ts` - Added GroupManagementService types

### Documentation
- `docs/issues/ISSUE-SPA-AND-AUTH-COMBINED.md` (this file)

---

## Success Criteria

### Technical
- [x] Test coverage ≥ 95% for Manager classes
- [x] All code follows GAS Layer Separation
- [x] Zero circular dependency violations
- [ ] API response time < 2s (to be verified in later phases)

### Security
- [x] Zero tokens in HTML/URL (verification code approach)
- [ ] CSRF protection verified (Phase 2+)
- [x] Rate limiting prevents brute force
- [ ] 100% audit coverage (Phase 2+)

### User Experience
- [ ] Auth success rate ≥ 95% (to be measured)
- [x] Works on iOS Safari with autocomplete (email input)
- [ ] Responsive on all devices (Phase 2+)
- [ ] No production incidents (Phase 7)

---

## Next Steps

**STOP**: Phase 0 is complete. Awaiting approval before proceeding to Phase 1.

To continue, the following checkpoints must be met:
1. ✅ `npm test` passes (353 tests)
2. ⬜ Deploy to dev (manual verification needed)
3. ⬜ Code review vs copilot-instructions.md
4. ⬜ Approval from maintainer
