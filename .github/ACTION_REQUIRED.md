# ⚠️ ACTION REQUIRED: Complete Symlink Setup

## What Was Done in This PR

This PR prepares the repository for using shared GAS best practices via symlink:

✅ **Streamlined `copilot-instructions.md`**:
- Reduced from 789 lines (36KB) → 387 lines (16KB) (~51% reduction)
- Kept only SCCCCMembershipManagement-specific guidance
- Added clear reference to shared `gas-best-practices.md` at the top
- All universal GAS patterns moved to reference the shared file

✅ **Created `SETUP_SHARED_PRACTICES.md`**:
- Complete instructions for creating the symlink on local machine
- Verification steps
- Troubleshooting guide

✅ **Preserved Original**:
- `copilot-instructions-original.md` - backup of original 789-line file

## What You Need to Do on Your Local Machine

### Step 1: Verify Shared File Exists

```bash
ls -la /Users/toby/Development/GAS/_shared/gas-best-practices.md
```

If this file doesn't exist, complete [RideManager Issue #206](https://github.com/TobyHFerguson/RideManager/issues/206) first.

### Step 2: Create the Symlink

```bash
# Navigate to this repository
cd /Users/toby/Development/GAS/SCCCCMembershipManagement/.github

# Create symlink
ln -s ../../_shared/gas-best-practices.md gas-best-practices.md

# Verify it works
ls -la gas-best-practices.md
# Expected output: lrwxr-xr-x ... gas-best-practices.md -> ../../_shared/gas-best-practices.md

# Read first few lines to confirm
head -20 gas-best-practices.md
```

### Step 3: Commit the Symlink

```bash
# Still in .github directory
git add gas-best-practices.md
git commit -m "feat: Add symlink to shared gas-best-practices.md"
git push
```

### Step 4: Test Copilot Integration

1. Open repository in VS Code
2. Ask Copilot: "What are the GAS API limitations?"
   - Should reference content from `gas-best-practices.md`
3. Ask Copilot: "What services exist in this project?"
   - Should reference `copilot-instructions.md`

### Step 5: Clean Up

Once symlink is committed and verified:

```bash
# Remove the original backup (optional)
rm .github/copilot-instructions-original.md
git add .github/copilot-instructions-original.md
git commit -m "chore: Remove original copilot-instructions backup"
git push
```

## Why This Can't Be Done in CI/CD

The symlink target (`/Users/toby/Development/GAS/_shared/gas-best-practices.md`) only exists on your local machine, not in the GitHub Actions sandboxed environment. 

The symlink MUST be created on your local machine where the proper directory structure exists.

## Verification Checklist

After completing the above steps:

- [ ] Symlink created: `.github/gas-best-practices.md → ../../_shared/gas-best-practices.md`
- [ ] Symlink shows arrow in `ls -la` output
- [ ] Can read content: `cat .github/gas-best-practices.md | head -20`
- [ ] Symlink committed to Git
- [ ] Symlink pushed to remote
- [ ] Copilot reads both files correctly (tested with questions)
- [ ] All tests pass: `npm test`

## Expected Results

**Before**:
- 789 lines mixing universal + project-specific patterns
- Higher AI token usage
- No cross-project knowledge sharing

**After**:
- ~387 lines of project-specific guidance (copilot-instructions.md)
- ~1,800 lines of universal patterns (gas-best-practices.md via symlink)
- Reduced token usage
- Single source of truth for GAS patterns
- Knowledge flows bidirectionally between projects

## Troubleshooting

### "Symlink shows as regular file in VS Code"

This is normal - VS Code often displays symlinks as if they were regular files. The important part is that:
1. `ls -la` shows the symlink arrow
2. You can read the content
3. Git tracks it as a symlink

### "Git shows symlink as modified after commit"

Check your Git symlink configuration:
```bash
git config --get core.symlinks  # Should return 'true'
git config core.symlinks true   # Enable if needed
```

### "Copilot doesn't seem to use the symlinked file"

This is a known limitation of some AI tools. If symlinks don't work with Copilot, see RideManager Issue #206 Task 3 for a sync script alternative.

## Related Documentation

- **Setup Guide**: `.github/SETUP_SHARED_PRACTICES.md`
- **Streamlined Instructions**: `.github/copilot-instructions.md`
- **Original Backup**: `.github/copilot-instructions-original.md`
- **Parent Issue**: [RideManager Issue #206](https://github.com/TobyHFerguson/RideManager/issues/206)

## Questions?

If you encounter issues, see `.github/SETUP_SHARED_PRACTICES.md` for detailed troubleshooting, or comment on the issue.
