# Archive Completed Migration Documentation

## Objective

Move completed migration documentation to `docs/archive/` to reduce cognitive load and improve focus on current architecture.

## Context

The `docs/issues/` directory contains ~2000 lines of historical migration tracking that is no longer relevant for current development:

- `ISSUE-346-NAMESPACE-FLATTENING.md` (~700 lines) - Complete
- `HANDOFF_TO_OPUS_PHASE2.md` (~300 lines) - Complete  
- Multiple `issue-346-*.md` files - Complete

**Problem**: Future developers (including you) will waste time reading through completed migration notes instead of focusing on current architecture patterns.

**Impact**: Reduces time to understand current codebase by ~50%.

## Implementation Plan

### Step 1: Create Archive Directory (Haiku, 1 min)

```bash
mkdir -p docs/archive
```

### Step 2: Identify Files to Archive (Haiku, 5 mins)

Run audit to identify completed issue docs:

```bash
cd docs/issues
ls -lh *.md

# Look for files with "ISSUE-", "HANDOFF", "PHASE" in names
# Look for files referencing closed issues (#346, etc.)
```

**Files to Archive**:
- `ISSUE-346-NAMESPACE-FLATTENING.md`
- `HANDOFF_TO_OPUS_PHASE2.md`  
- `issue-346-update.md`
- `issue-346-comment.md`
- `issue-346-closing-comment.md`
- Any other Phase -1 through Phase 3 tracking docs

**Files to Keep**:
- `ISSUE-SPA-AND-AUTH-COMBINED.md` (Phase 9 still in progress - needs trimming)
- `issue-test-cleanup.md` (Issue #356 - open)
- `issue-validated-transaction.md` (Issue #357 - open)
- `issue-fiddler-removal.md` (Issue #358 - open)
- `PHASE_REQUEST_TEMPLATE.md` (if still useful for future migrations)

### Step 3: Move Files to Archive (Haiku, 2 mins)

```bash
cd /Users/toby/Development/GAS/SCCCCManagement

# Move completed issue #346 docs
mv docs/issues/ISSUE-346-*.md docs/archive/
mv docs/issues/HANDOFF_TO_OPUS*.md docs/archive/
mv docs/issues/issue-346-*.md docs/archive/

# Verify
ls docs/issues/  # Should only show active/current docs
ls docs/archive/ # Should show historical migration docs
```

### Step 4: Update README References (Haiku, 5 mins)

**File**: `README.md`

Search for references to moved files:
```bash
grep -n "ISSUE-346\|HANDOFF_TO_OPUS" README.md
```

If any found, update to point to `docs/archive/` or remove if no longer relevant.

### Step 5: Trim ISSUE-SPA-AND-AUTH-COMBINED.md (Sonnet, 15 mins)

**File**: `docs/issues/ISSUE-SPA-AND-AUTH-COMBINED.md`

**Keep**:
- Phase 9 plan (current phase)
- Migration strategy overview (1 paragraph)
- Key architectural decisions (authentication patterns)

**Remove**:
- Completed Phase 0-8 detailed tracking (move to separate archived file)
- Historical decisions that are now resolved
- Step-by-step migration notes for completed work

**Action**:
1. Read current file
2. Extract Phase 9 content and key decisions
3. Create `docs/archive/ISSUE-SPA-PHASES-0-8.md` with completed phase details
4. Rewrite `docs/issues/ISSUE-SPA-AND-AUTH-COMBINED.md` to focus on Phase 9 only

### Step 6: Create Archive README (Haiku, 3 mins)

**File**: `docs/archive/README.md`

```markdown
# Archived Migration Documentation

This directory contains historical migration documentation for completed work.

## Completed Migrations

- **Issue #346**: Namespace flattening and type safety improvements (Jan 2026)
  - ISSUE-346-NAMESPACE-FLATTENING.md
  - HANDOFF_TO_OPUS_PHASE2.md
  - issue-346-*.md files

- **Issue #291 Phases 0-8**: SPA and authentication migration (Nov 2025 - Jan 2026)
  - ISSUE-SPA-PHASES-0-8.md

## Accessing Current Documentation

Active work tracked in:
- docs/issues/ - Open issues and current migrations
- docs/*.md - Architecture and operational guides
```

### Step 7: Update Copilot Instructions (Haiku, 5 mins)

**File**: `.github/copilot-instructions.md`

Remove references to archived files in "Key Files Reference" section. Ensure only current documentation is listed.

### Step 8: Verification (2 mins)

```bash
# Check file counts
ls -1 docs/issues/*.md | wc -l  # Should be ~6-8 (active only)
ls -1 docs/archive/*.md | wc -l # Should be ~6-8 (archived)

# Verify no broken links
grep -r "docs/issues/ISSUE-346\|docs/issues/HANDOFF" docs/ .github/
# Should only find references in archive/README.md

# Commit
git add docs/
git commit -m "docs: Archive completed migration documentation

Moved to docs/archive/:
- ISSUE-346-NAMESPACE-FLATTENING.md
- HANDOFF_TO_OPUS_PHASE2.md  
- issue-346-*.md files

Trimmed ISSUE-SPA-AND-AUTH-COMBINED.md to focus on Phase 9

Result: docs/issues/ now contains only active/current documentation"
```

## Success Criteria

- ✅ `docs/archive/` directory created
- ✅ ~6-8 completed issue docs moved to archive
- ✅ `docs/issues/` contains only active documentation (~6-8 files)
- ✅ `docs/archive/README.md` created with index of archived work
- ✅ `ISSUE-SPA-AND-AUTH-COMBINED.md` trimmed to Phase 9 focus
- ✅ No broken links in documentation
- ✅ README.md updated if needed
- ✅ Copilot instructions reference only current docs

## Model Recommendation

**Haiku** for Steps 1-4, 6-8 (file operations, simple edits)  
**Sonnet** for Step 5 only (trimming ISSUE-SPA-AND-AUTH-COMBINED.md requires content judgment)

**Rationale**:
- File moving is mechanical (Haiku)
- Simple README creation is mechanical (Haiku)
- Reference updates are search-replace (Haiku)
- Trimming SPA doc requires reading comprehension and content decisions (Sonnet)

**Total Time**:
- Haiku: 25 minutes
- Sonnet: 15 minutes
- **Total: 40 minutes**

## Estimated Effort

**40 minutes** (Haiku + Sonnet)

## Priority

**HIGH** - Immediate quality of life improvement for single developer

## Benefits

1. **Faster onboarding**: Future you can quickly understand current architecture
2. **Reduced confusion**: Clear separation of "what we did" vs "what we're doing"
3. **Better focus**: docs/issues/ shows only active work
4. **Historical record**: Archive preserves decisions without cluttering workspace

## Alternative Approach

If you want to keep archive visible:
- Create `docs/archive/` at same level as `docs/`
- Move to `/archive/issues-346/` for better organization
- Update .gitignore to exclude from searches

## Related Documentation

After completion, current docs structure will be:

```
docs/
  ├── issues/
  │   ├── ISSUE-SPA-AND-AUTH-COMBINED.md (Phase 9 only)
  │   ├── issue-test-cleanup.md (#356)
  │   ├── issue-validated-transaction.md (#357)
  │   └── issue-fiddler-removal.md (#358)
  ├── archive/
  │   ├── README.md
  │   ├── ISSUE-346-NAMESPACE-FLATTENING.md
  │   ├── HANDOFF_TO_OPUS_PHASE2.md
  │   ├── issue-346-*.md (multiple)
  │   └── ISSUE-SPA-PHASES-0-8.md
  └── *.md (architecture/operations guides)
```
