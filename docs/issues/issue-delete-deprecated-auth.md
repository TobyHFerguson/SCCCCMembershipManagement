# Delete Deprecated Magic Link Authentication Code

## Objective

Remove all deprecated magic link authentication code after Phase 9 production validation confirms the new verification code authentication works correctly.

## Context

Per `docs/issues/ISSUE-SPA-AND-AUTH-COMBINED.md` Phase 9, the new verification code authentication system is now in production. The old magic link system is deprecated but still present in the codebase, creating:

- **Maintenance burden**: Two authentication code paths to maintain
- **Confusion**: Future developers unsure which code is active
- **Dead code**: ~500 lines serving no purpose

## Pre-requisites

**CRITICAL**: Do NOT proceed until Phase 9 production validation is complete and confirmed working:

```bash
# Verify feature flag is enabled in production
# Check Properties sheet: FEATURE_USE_NEW_AUTH = true

# Verify verification codes working in production
# Test all 5 services: GroupManagement, ProfileManagement, Directory, EmailChange, Voting
```

## Implementation Plan

### Step 1: Identify All Deprecated Code (5 mins)

Search for deprecated references:

```bash
grep -r "magic.*link\|sendMagicLink\|magicLinkInput" src/ --include="*.js" --include="*.html"
```

**Expected Findings**:
- `src/common/auth/magicLinkInput.html` - Old auth UI
- `src/webapp_endpoints.js` - `sendMagicLink()` function
- `src/common/auth/AuthUtils.js` - Magic link utilities
- Comments referencing "deprecated" or "old auth"

### Step 2: Remove Magic Link HTML (Haiku, 2 mins)

```bash
rm src/common/auth/magicLinkInput.html
```

### Step 3: Remove sendMagicLink() Function (Haiku, 5 mins)

**File**: `src/webapp_endpoints.js`

Search for:
```javascript
function sendMagicLink(email, serviceId) {
    // ... deprecated implementation
}
```

**Action**: Delete entire function and any helper functions it uses exclusively.

### Step 4: Clean Up AuthUtils (Haiku, 10 mins)

**File**: `src/common/auth/AuthUtils.js`

**Search for**:
- `sendMagicLink()` method
- `generateMagicLink()` method
- Any other magic-link-specific utilities

**Action**: Delete methods. If the entire class is deprecated, delete the file.

**Verify no remaining usages**:
```bash
grep -r "AuthUtils\.sendMagicLink\|AuthUtils\.generateMagicLink" src/
# Should return 0 results
```

### Step 5: Remove Deprecation Comments (Haiku, 5 mins)

Search for comments mentioning old auth:
```bash
grep -r "deprecated.*magic\|old auth\|magic.*link.*deprecated" src/ --include="*.js"
```

Remove or update comments to reflect current state.

### Step 6: Update Documentation (Haiku, 5 mins)

**Files to Update**:
- `docs/SPA_ARCHITECTURE.md` - Remove magic link references
- `docs/issues/ISSUE-SPA-AND-AUTH-COMBINED.md` - Mark Phase 9 complete
- `.github/copilot-instructions.md` - Remove "Deprecated Code" section

### Step 7: Verification (5 mins)

```bash
# No type errors
npm run typecheck  # Must be 0 production errors

# All tests pass
npm test  # Must be 1113+ passing

# No references to deleted code
grep -r "magicLinkInput\|sendMagicLink" src/ --include="*.js"
# Should return 0 results (or only in comments explaining removal)

# Deploy to dev
npm run dev:push

# Test authentication in dev (all 5 services)
```

## Success Criteria

- ✅ `magicLinkInput.html` deleted
- ✅ `sendMagicLink()` function removed from `webapp_endpoints.js`
- ✅ Magic link methods removed from `AuthUtils.js` (or entire file deleted if empty)
- ✅ No grep results for `sendMagicLink` or `magicLinkInput` in production code
- ✅ Documentation updated to remove magic link references
- ✅ 0 production type errors maintained
- ✅ 1113+ tests still passing
- ✅ All 5 services authenticate successfully in dev environment

## Model Recommendation

**Haiku** - This is a straightforward deletion task with clear search patterns and minimal decision-making.

**Rationale**:
- Simple file deletion and search-replace operations
- No architectural decisions required
- Clear success criteria (grep returns zero)
- Fast execution with lowest cost
- Estimated total: ~30 minutes

**When to use Sonnet instead**: If `AuthUtils.js` has complex interdependencies with other modules requiring refactoring (unlikely based on code review).

## Estimated Effort

**30 minutes** (Haiku model)

## Priority

**HIGH** - Reduces maintenance burden immediately, low risk since code is already unused

## Testing Requirements

1. Run full test suite before and after deletion
2. Deploy to dev and manually test authentication in all 5 services
3. Verify no console errors in browser during auth flow
4. Monitor production for 24 hours after deployment (should have no impact)

## Rollback Plan

If authentication breaks unexpectedly:
```bash
git revert HEAD  # Restore deleted code
npm run prod:push  # Redeploy
```

(Unlikely since code is already unused - feature flag controls behavior)

## Related Issues

- Completes Phase 9 of Issue #291 (SPA + Auth Migration)
- Addresses "Deprecated Code Still Present" from code quality review
