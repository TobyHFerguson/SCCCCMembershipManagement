# Issue #291: Phase 9 - Production Rollout

> **Current Status**: Phase 9 (Production Rollout) IN PROGRESS
> 
> **For historical context on Phases 0-8**, see `docs/archive/ISSUE-SPA-PHASES-0-8.md`

## Quick Reference: What is This?

This is the production rollout phase for the SPA + Verification Code Authentication migration affecting 5 web services:
- DirectoryService
- EmailChangeService  
- GroupManagementService
- ProfileManagementService
- VotingService

**Previous Status**: Phases 0-8 complete with 1113 tests passing and zero production errors.

---

## Key Infrastructure (Phases 0-8 Summary)

**For detailed phase-by-phase tracking**, see `docs/archive/ISSUE-SPA-PHASES-0-8.md`

### Completed Work (Phases 0-8)

- **Phase 0**: Feature flag system, verification codes, API client, token management  
- **Phases 1-3**: Verification code UI, GAS endpoint integration, authentication flow  
- **Phases 4-7**: Migrated all 5 services to SPA architecture  
- **Phase 8**: Home page with service list and navigation  

**Result**: 1113 tests passing, 0 production errors, ready for Phase 9 rollout

### Feature Flags System
```javascript
// Check if new auth enabled
if (FeatureFlags.isNewAuthEnabled()) {
  // Use verification code flow
} else {
  // Use legacy magic link flow
}

// Enable for rollout
FeatureFlags.enableNewAuth();

// Emergency rollback (30-second revert)
FeatureFlags.emergencyRollback();
```

**Location**: `src/common/config/FeatureFlags.js`

### Verification Code System
- 6-digit codes, 10-minute expiry
- Rate limited (5 codes per email per hour)
- Max 3 verification attempts per code
- Single-use (marked as used after verification)

**Location**: `src/common/auth/VerificationCode.js`

### Multi-Use Tokens (Session Management)
- Tokens valid for ~24 hours (configurable)
- Used in `google.script.run` API calls
- Validated in `ApiClient.handleRequest()`
- Automatically refreshed on service access

**Location**: `src/common/auth/TokenManager.js`

### SPA Home Page
- Shows all 5 available services
- Responsive design (desktop, tablet, mobile)
- "Back to Services" link on each service page
- Sign-out flow clears session

**Location**: `src/common/html/serviceHomePage.html` and `HomePageManager.js`

---

## Phase 9: Production (Week 8) - PENDING

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

## Files Modified (Phase 7)

### Source Files - Added Deprecation Notices
- `src/webapp_endpoints.js` - Added @deprecated JSDoc and console.warn for sendMagicLink
- `src/common/auth/utils.js` - Added @deprecated JSDoc to Common.Auth.Utils module
- `src/common/auth/magicLinkInput.html` - Added deprecation notice in HTML comment
- `src/webApp.js` - Added console.warn when legacy auth flow is used

### Documentation Files
- `.github/copilot-instructions.md` - Updated with Phase 7 completion and deprecated code list
- `docs/issues/ISSUE-SPA-AND-AUTH-COMBINED.md` - Updated with Phase 7 details

---

## Files Created (Phase 8)

### Source Files
- `src/common/html/HomePageManager.js` - Pure business logic for home page
- `src/common/html/serviceHomePage.html` - Home page HTML with service list

### Test Files
- `__tests__/HomePageManager.test.js` - 37 tests, 100% coverage

### Modified Files
- `src/webapp_endpoints.js` - Added `getHomePageContent()` endpoint
- `src/common/auth/verificationCodeInput.html` - Now loads home page after verification
- `src/common/html/_Header.html` - Added navigation styles and `navigateToHomePage()` function
- `src/services/GroupManagementService/GroupManagementService.html` - Added back link
- `src/services/DirectoryService/html/directory.html` - Added back link
- `src/services/ProfileManagementService/ProfileManagementForm.html` - Added back link
- `src/services/EmailChangeService/EmailChangeForm.html` - Added back link
- `src/services/VotingService/ActiveVotes.html` - Added back link
- `src/types/global.d.ts` - Added HomePage types

---

## Success Criteria

### Technical
- [x] Test coverage ≥ 95% for Manager classes
- [x] All code follows GAS Layer Separation
- [x] Zero circular dependency violations
- [x] All 919 tests pass (including 37 new HomePageManager tests)
- [ ] API response time < 2s (to be verified in Phase 9)

### Security
- [x] Zero tokens in HTML/URL (verification code approach)
- [x] Rate limiting prevents brute force
- [x] Legacy code marked with deprecation warnings
- [ ] 100% audit coverage (Phase 9)

### User Experience
- [ ] Auth success rate ≥ 95% (to be measured in Phase 9)
- [x] Works on iOS Safari with autocomplete (email input)
- [x] Responsive on all devices (verified in Phases 2-8)
- [x] Home page shows all 5 services with navigation
- [x] Back to Services link on all service pages
- [ ] No production incidents (Phase 9)

---

## Next Steps

**Phase 8 Complete**: Service home page implementation done. Awaiting approval before proceeding to Phase 9.

### Phase 9 Checklist (Production Rollout)
1. ⬜ Deploy with `FEATURE_USE_NEW_AUTH` = false
2. ⬜ Test with 1-2 users by enabling the flag
3. ⬜ Monitor deprecation warnings in logs
4. ⬜ If successful, leave flag ON
5. ⬜ If issues, use `emergencyRollback()`
6. ⬜ After stable period, remove deprecated code

### Files to Remove After Stable Production (Post-Phase 9)
- `src/common/auth/magicLinkInput.html`
- `sendMagicLink()` function in `webapp_endpoints.js`
- `Common.Auth.Utils` module in `utils.js`

To continue, the following checkpoints must be met:
1. ✅ `npm test` passes (919 tests)
2. ⬜ Deploy to dev (manual verification needed)
3. ⬜ Code review vs copilot-instructions.md
4. ⬜ Approval from maintainer
