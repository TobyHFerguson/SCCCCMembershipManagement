# Setup: Shared GAS Best Practices

## Overview

This repository references universal Google Apps Script best practices from a shared file that is maintained across multiple GAS projects.

## Directory Structure

```
/Users/toby/Development/GAS/
├── _shared/
│   └── gas-best-practices.md            (~1,800 lines) - Master copy
│
├── RideManager/
│   └── .github/
│       ├── copilot-instructions.md      (RideManager-specific)
│       └── gas-best-practices.md        (Symlink → ../../_shared/gas-best-practices.md)
│
└── SCCCCMembershipManagement/
    └── .github/
        ├── copilot-instructions.md      (MembershipManagement-specific)
        └── gas-best-practices.md        (Symlink → ../../_shared/gas-best-practices.md)
```

## Setup Instructions

### Prerequisites

1. The shared best practices file must exist:
   ```bash
   ls -la /Users/toby/Development/GAS/_shared/gas-best-practices.md
   ```

2. This repository must be cloned in the expected location:
   ```bash
   cd /Users/toby/Development/GAS/SCCCCMembershipManagement
   ```

### Create Symlink

**Step 1**: Navigate to .github directory
```bash
cd /Users/toby/Development/GAS/SCCCCMembershipManagement/.github
```

**Step 2**: Create the symlink
```bash
ln -s ../../_shared/gas-best-practices.md gas-best-practices.md
```

**Step 3**: Verify symlink works
```bash
# Should show symlink arrow
ls -la gas-best-practices.md

# Should display file content (first 10 lines)
head -10 gas-best-practices.md
```

Expected output:
```
lrwxr-xr-x  1 toby  staff  42 Jan 21 14:30 gas-best-practices.md -> ../../_shared/gas-best-practices.md
```

**Step 4**: Commit symlink to Git
```bash
git add .github/gas-best-practices.md
git commit -m "feat: Add symlink to shared gas-best-practices.md"
git push
```

## Verification

### Test Symlink
```bash
# From repository root
cat .github/gas-best-practices.md | head -20
```

### Test Copilot Integration

1. Open repository in VS Code
2. Test universal patterns:
   - Ask: "What are the GAS API limitations?"
   - Expected: Response references gas-best-practices.md content
3. Test project-specific:
   - Ask: "What services exist in this project?"
   - Expected: Response references copilot-instructions.md content

## Troubleshooting

### Symlink Not Working

If Copilot doesn't recognize the symlink, you can use a sync script instead (see RideManager Issue #206 Task 3).

### Path Issues

Ensure your repository is cloned in the expected location:
- **Expected**: `/Users/toby/Development/GAS/SCCCCMembershipManagement`
- **Shared file at**: `/Users/toby/Development/GAS/_shared/gas-best-practices.md`

### Git Doesn't Track Symlink

Git should track symlinks by default on macOS/Linux. If issues occur:
```bash
git config --get core.symlinks  # Should return 'true'
git config core.symlinks true   # Enable if needed
```

## What This Achieves

**Before**:
- 789 lines mixing universal patterns with project-specific guidance
- Higher token usage for AI conversations
- Insights from RideManager not available

**After**:
- ~1,800 lines of universal GAS patterns available via symlink
- ~200-300 lines of project-specific guidance in copilot-instructions.md
- Reduced token usage (focused context)
- Single source of truth for GAS patterns
- Bidirectional insight sharing between projects

## Related Documentation

- **Parent Issue**: [RideManager Issue #206](https://github.com/TobyHFerguson/RideManager/issues/206) - Extraction of universal guidelines
- **This Issue**: Tracks adoption in SCCCCMembershipManagement
