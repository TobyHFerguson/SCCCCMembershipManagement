# Fiddler Library Removal Migration Guide

## Overview

This document provides step-by-step instructions for migrating production data from HYPERLINK formulas to native RichText after the removal of the bmPreFiddler library.

## Summary of Changes

### Code Changes
- **Removed**: `bmPreFiddler` library from `src/appsscript.json`
- **Removed**: All `SpreadsheetManager.getFiddler()` calls
- **Removed**: `SheetAccess.getDataWithFormulas()` and `SheetAccess.convertLinks()` methods
- **Added**: `SheetAccess.getDataWithRichText()` method for reading native RichText links
- **Added**: `RichTextMigration` utility for converting existing formulas to RichText

### Architecture Changes
- All spreadsheet operations now use native `SpreadsheetApp` API
- Link columns now store native RichText instead of `=HYPERLINK()` formulas
- Removed per-execution caching (Fiddler feature) - native API is sufficiently fast
- Simplified data access patterns (no more `.dumpValues()` chaining)

## Pre-Migration Verification

Before migrating, verify current references:

```bash
# Should show 0 Fiddler references (except comments)
grep -rn "getFiddler\|Fiddler\|bmPreFiddler" src/ | grep -v "\.d\.ts"

# Should show 0 formula conversion calls
grep -rn "convertLinks\|getDataWithFormulas\|needFormulas" src/ | grep -v "\.d\.ts"

# Should show 0 manifest entries
grep -n "bmPreFiddler" src/appsscript.json
```

## Migration Steps

### Step 1: Deploy to Development Environment

1. **Deploy the updated code:**
   ```bash
   npm run dev:push
   npm run dev:deploy
   ```

2. **Verify deployment:**
   - Check that the app loads without errors
   - Verify Bootstrap sheet is still readable
   - Test basic spreadsheet operations

### Step 2: Run RichText Migration on Development

**IMPORTANT**: This migration converts `=HYPERLINK()` formulas to native RichText. Run ONCE per environment.

1. **Open the GAS Script Editor**

2. **Run the migration function:**
   ```javascript
   function runDevMigration() {
     AppLogger.configure();
     const results = RichTextMigration.runFullMigration();
     console.log('Migration results:', JSON.stringify(results, null, 2));
     
     // Check results
     for (const [sheet, result] of Object.entries(results)) {
       if (!result.success) {
         console.error(`${sheet} migration failed:`, result.errors);
       } else {
         console.log(`${sheet}: ${result.migratedCount} cells migrated`);
       }
     }
   }
   ```

3. **Verify migration:**
   - Open the migrated sheets in Google Sheets
   - Check that links are still clickable
   - Verify link text and URLs are preserved
   - Test that data reads correctly in the app

### Step 3: Test Application Functionality

Test all major features that read link data:

1. **ActionSpecs (Email Templates)**:
   - Navigate to membership management
   - Trigger an action that sends email
   - Verify email body contains correct links

2. **Transactions**:
   - View transaction history
   - Check that "Payable Order ID" links are clickable
   - Verify links open correct payment pages

3. **MigratingMembers** (if applicable):
   - Check if sheet exists and has link columns
   - Verify any links are preserved

### Step 4: Deploy to Staging

Once development testing is complete:

1. **Deploy to staging:**
   ```bash
   npm run stage:deploy
   ```

2. **Run migration on staging:**
   - Use same `runDevMigration()` function
   - Verify results
   - Test app functionality

3. **Conduct user acceptance testing**

### Step 5: Production Deployment

After successful staging validation:

1. **Create backup of production data:**
   - Make copies of `Transactions`, `ActionSpecs`, and any other sheets with links
   - Document current state for rollback if needed

2. **Deploy to production:**
   ```bash
   npm run prod:deploy-live
   ```

3. **Run migration on production:**
   ```javascript
   function runProdMigration() {
     // Same as runDevMigration, but on production data
     AppLogger.configure();
     const results = RichTextMigration.runFullMigration();
     
     // Log to system logs for audit trail
     AppLogger.info('RichTextMigration', 'Production migration completed', results);
     
     console.log('Migration results:', JSON.stringify(results, null, 2));
     return results;
   }
   ```

4. **Verify production:**
   - Check that all links are working
   - Monitor system logs for errors
   - Test key workflows end-to-end

## Rollback Procedure

If issues arise after migration:

### Code Rollback

1. **Revert to previous GAS version:**
   ```bash
   npm run prod:versions  # Find previous version number
   npm run prod:redeploy-live  # Deploy previous version
   ```

2. **The formula-based links will still work** with the old code

### Data Rollback (if formulas were lost)

If RichText migration failed and formulas were lost:

1. **Restore from backup:**
   - Copy data from backup sheets
   - Paste into original sheets
   - Verify formulas are preserved

2. **Re-run migration:**
   - Fix any issues identified
   - Re-run `runProdMigration()`

## Post-Migration Verification

### Automated Checks

Run these commands to verify:

```bash
# All tests should pass
npm test

# Type check (minor test file errors are acceptable)
npm run typecheck

# Verify code references
grep -rn "getFiddler" src/ | grep -v "\.d\.ts" | grep -v "^src/common/utils/RichTextMigration.js"
```

### Manual Checks

1. **Email Templates**:
   - Send test emails
   - Verify links in email body
   - Check link formatting

2. **Transaction Links**:
   - View transaction history
   - Click payment links
   - Verify correct payment pages open

3. **System Logs**:
   - Check for any new errors
   - Verify logging still works
   - Check log rotation

## Troubleshooting

### Migration Errors

**Error: "Column not found"**
- Check that column names match exactly (case-sensitive)
- Verify sheet exists in Bootstrap configuration

**Error: "Failed to parse formula"**
- Some formulas may have non-standard formatting
- Manually inspect and fix these cells
- Re-run migration for that sheet only

### Runtime Errors

**Error: "getDataWithRichText is not defined"**
- Verify latest code is deployed
- Check that SheetAccess.js was updated
- Clear any caching issues by redeploying

**Error: "Cannot read property 'text' of undefined"**
- Some cells may not have RichText
- Check that migration completed successfully
- Verify null handling in calling code

### Performance Issues

If native API is slower than expected:

1. **Check data volume:**
   - Large sheets may take longer
   - Consider batch processing for huge datasets

2. **Optimize read patterns:**
   - Use `getDataAsArrays()` for bulk reads
   - Cache results in memory for repeated access
   - Avoid redundant sheet reads

## Support

If you encounter issues during migration:

1. Check system logs for detailed error messages
2. Review the RichText migration results
3. Contact the development team with specific error details
4. Include environment (dev/staging/prod) and timestamp

## Additional Resources

- **RichText API Documentation**: https://developers.google.com/apps-script/reference/spreadsheet/rich-text-value
- **SpreadsheetApp API**: https://developers.google.com/apps-script/reference/spreadsheet/spreadsheet-app
- **Project Documentation**: `/docs/` directory in repository
