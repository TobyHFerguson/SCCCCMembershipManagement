# Bootstrap Sheet Configuration

## Overview

The Bootstrap sheet is the central configuration for all spreadsheet references in the SCCCC Management system. It maps logical references (used in code) to actual sheet names, allowing sheets to be renamed without code changes.

## Bootstrap Sheet Structure

The Bootstrap sheet must contain these columns:

| Reference | iD | sheetName | createIfMissing |
|-----------|---|-----------|-----------------|
| ... | ... | ... | ... |

### Column Descriptions

- **Reference**: Logical name used in code (e.g., `'SystemLogs'`, `'Properties'`, `'ActiveMembers'`)
- **iD**: Spreadsheet ID (leave empty for sheets in the current spreadsheet)
- **sheetName**: Actual name of the sheet in the spreadsheet
- **createIfMissing**: Boolean - whether to create the sheet if it doesn't exist

## Required Entries

### SystemLogs

The SystemLogs entry configures where system logs are written:

| Reference | iD | sheetName | createIfMissing |
|-----------|---|-----------|-----------------|
| SystemLogs |  | System Logs | True |

**Purpose:** System logs for debugging deployed applications

**Sheet Columns:**
- Timestamp (Date)
- Level (String: DEBUG, INFO, WARN, ERROR)
- Service (String: namespace/service name)
- Message (String: log message)
- Data (String: JSON-serialized additional data)

**Testing Sheet Name Changes:**
1. Change `sheetName` to any value (e.g., `"FOOGLE"`)
2. The logging system will automatically use the new name
3. If `createIfMissing` is True, the sheet will be created automatically

### Properties

| Reference | iD | sheetName | createIfMissing |
|-----------|---|-----------|-----------------|
| Properties |  | Properties | False |

**Note:** Common typo - "Propertes" (missing 'i'). If you see this error:
```
Sheet name Properties not found in Bootstrap. Available: ..., Propertes
DID YOU MEAN: "Propertes" is misspelled in Bootstrap - should be "Properties"
```
Fix the typo in the Bootstrap sheet.

### Other Common Entries

| Reference | iD | sheetName | createIfMissing |
|-----------|---|-----------|-----------------|
| ActiveMembers |  | ActiveMembers | False |
| ExpirySchedule |  | ExpirySchedule | False |
| ActionSpecs |  | ActionSpecs | False |
| ExpirationFIFO |  | ExpirationFIFO | True |
| Tokens |  | Tokens | True |

## How It Works

### Code Usage

```javascript
// Get a fiddler for a sheet using its logical Reference
const fiddler = Common.Data.Storage.SpreadsheetManager.getFiddler('SystemLogs');

// The fiddler works with the actual sheet name from Bootstrap
const data = fiddler.getData();
```

### Caching

Fiddlers are cached per-execution to avoid redundant spreadsheet opens. When multiple functions run in the same execution, the first call to `getFiddler('SheetName')` opens the sheet and caches it. Subsequent calls in the same execution return the cached instance.

```javascript
// First call - opens spreadsheet and caches
const fiddler1 = getFiddler('SystemLogs');

// Second call in same execution - returns cached instance
const fiddler2 = getFiddler('SystemLogs');

// fiddler1 === fiddler2 (same object)
```

To clear the cache (e.g., after external code modifies a sheet):
```javascript
Common.Data.Storage.SpreadsheetManager.clearFiddlerCache('SystemLogs');
```

### TypeScript Support

Type definitions provide autocomplete and type checking:

```typescript
// Type-safe fiddler with SystemLogEntry type
const fiddler: Fiddler<SystemLogEntry> = getFiddler('SystemLogs');

interface SystemLogEntry {
    Timestamp: Date;
    Level: string;
    Service: string;
    Message: string;
    Data: string;
}
```

## Adding New Sheet References

1. Add a row to the Bootstrap sheet:
   ```
   Reference: MyNewSheet
   iD: (empty for local sheet, or spreadsheet ID for external)
   sheetName: My New Sheet Name
   createIfMissing: True/False
   ```

2. Add TypeScript type definition to `src/types/global.d.ts`:
   ```typescript
   interface MyDataType {
       Column1: string;
       Column2: number;
       // ...
   }
   
   // In Common.Data.Storage.SpreadsheetManager namespace:
   function getFiddler(sheetName: 'MyNewSheet'): Fiddler<MyDataType>;
   ```

3. Use in code:
   ```javascript
   const fiddler = Common.Data.Storage.SpreadsheetManager.getFiddler('MyNewSheet');
   const data = fiddler.getData();
   ```

## Troubleshooting

### "Sheet name X not found in Bootstrap"

**Cause:** The Reference you're trying to use is not configured in Bootstrap

**Fix:** Add the entry to the Bootstrap sheet with the correct Reference and sheetName

### "CONTAINER_SPREADSHEET_ID not found"

**Cause:** Script Properties don't have the container spreadsheet ID set

**Fix:** 
1. In script editor: File > Project Properties > Script Properties
2. Add property: `CONTAINER_SPREADSHEET_ID` = `<your spreadsheet ID>`
3. Or run once in editor context where `SpreadsheetApp.getActiveSpreadsheet()` works

### Sheet Created But Not Found

**Cause:** Fiddler cache contains stale reference

**Fix:**
```javascript
Common.Data.Storage.SpreadsheetManager.clearFiddlerCache('SheetName');
```

## Best Practices

1. **Use Logical References**: Always use Bootstrap references in code, never hardcode sheet names
2. **Document New Sheets**: Add entries to this document when adding new Bootstrap references
3. **Test Sheet Renaming**: Verify that renaming sheets in Bootstrap doesn't break functionality
4. **Use createIfMissing Wisely**: Set to True only for sheets that can be safely auto-created
5. **Keep Bootstrap Clean**: Remove unused references to avoid confusion
