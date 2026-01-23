# Create SheetAccess Abstraction Layer

## Objective

Create a thin abstraction layer over spreadsheet access to prepare for future Fiddler removal while improving code clarity and maintainability.

## Context

The entire codebase depends on `bmPreFiddler` external library via `SpreadsheetManager.getFiddler()`. While Fiddler works correctly, it creates:

- **External dependency risk**: Library could change/break
- **Opaque behavior**: Harder to debug (goes through external code)
- **Testing complexity**: Mocking Fiddler is more complex than native APIs

Creating an abstraction NOW provides:
- **Flexibility**: Can swap Fiddler for native SpreadsheetApp without touching services
- **Clarity**: Explicit API for spreadsheet operations
- **Future-proofing**: Decouples services from Fiddler implementation details

## Pre-requisites

None - this is a new abstraction that wraps existing functionality.

## Implementation Plan

### Step 1: Design SheetAccess API (Opus, 30 mins)

**Key Decisions**:
1. What operations should be exposed? (getData, setData, appendRow, etc.)
2. How to handle Fiddler-specific methods? (getDataWithFormulas, convertLinks)
3. Return types: Fiddler objects or plain arrays?
4. Caching: Preserve Fiddler's per-execution caching?

**Recommended API** (based on common usage patterns):

```javascript
class SheetAccess {
    // Read operations
    static getData(sheetName)  // Returns array of row objects
    static getDataAsArrays(sheetName)  // Returns 2D array
    static getDataWithFormulas(sheetName)  // For sheets with rich text links
    
    // Write operations  
    static setData(sheetName, data)  // Write array of objects
    static appendRows(sheetName, rows)  // Append to end
    static updateRows(sheetName, rows, startRow)  // Update specific rows
    
    // Utility
    static clearCache(sheetName)  // Clear cached data
    static getSheet(sheetName)  // Get raw Sheet object (for advanced use)
}
```

**Deliverable**: Design document with:
- API method signatures
- Example usage patterns
- Migration strategy for existing code
- Testing approach

### Step 2: Implement Core SheetAccess Class (Sonnet, 1 hour)

**File**: `src/common/data/SheetAccess.js`

Create IIFE-wrapped class following GAS patterns:

```javascript
/// <reference path="../../types/global.d.ts" />

/**
 * SheetAccess - Abstraction layer for spreadsheet operations
 * 
 * Purpose: Provide consistent interface for sheet access, hiding Fiddler implementation
 * 
 * Current: Uses Fiddler under the hood
 * Future: Can be swapped to native SpreadsheetApp without changing call sites
 * 
 * Layer: Layer 1 Infrastructure
 */

var SheetAccess = (function() {
    class SheetAccess {
        /**
         * Get data from a sheet as array of row objects
         * @param {string} sheetName - Name of the sheet
         * @returns {Object[]} Array of row objects with column names as keys
         */
        static getData(sheetName) {
            const fiddler = SpreadsheetManager.getFiddler(sheetName);
            return fiddler.getData();
        }
        
        /**
         * Get data as 2D array (headers + rows)
         * @param {string} sheetName
         * @returns {any[][]} 2D array with headers in first row
         */
        static getDataAsArrays(sheetName) {
            const sheet = SpreadsheetManager.getSheet(sheetName);
            return sheet.getDataRange().getValues();
        }
        
        /**
         * Get data with formulas preserved (for rich text hyperlinks)
         * @param {string} sheetName
         * @returns {Object[]} Array of row objects
         */
        static getDataWithFormulas(sheetName) {
            const fiddler = SpreadsheetManager.getFiddler(sheetName);
            return SpreadsheetManager.getDataWithFormulas(fiddler);
        }
        
        /**
         * Write data to a sheet (replaces all data)
         * @param {string} sheetName
         * @param {Object[]} data - Array of row objects
         */
        static setData(sheetName, data) {
            const fiddler = SpreadsheetManager.getFiddler(sheetName);
            fiddler.setData(data).dumpValues();
            SpreadsheetManager.clearFiddlerCache(sheetName);
        }
        
        /**
         * Append rows to end of sheet
         * @param {string} sheetName
         * @param {any[][]} rows - 2D array of values
         */
        static appendRows(sheetName, rows) {
            const sheet = SpreadsheetManager.getSheet(sheetName);
            const lastRow = sheet.getLastRow();
            const numCols = rows[0].length;
            sheet.getRange(lastRow + 1, 1, rows.length, numCols).setValues(rows);
        }
        
        /**
         * Clear cached data for a sheet
         * @param {string} sheetName
         */
        static clearCache(sheetName) {
            SpreadsheetManager.clearFiddlerCache(sheetName);
        }
        
        /**
         * Get raw Sheet object for advanced operations
         * @param {string} sheetName
         * @returns {GoogleAppsScript.Spreadsheet.Sheet}
         */
        static getSheet(sheetName) {
            return SpreadsheetManager.getSheet(sheetName);
        }
    }
    
    return SheetAccess;
})();

// Node.js module export for testing
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { SheetAccess };
}
```

### Step 3: Add Type Definitions (Sonnet, 15 mins)

**File**: `src/types/global.d.ts`

Add after `SpreadsheetManager` declaration:

```typescript
/**
 * SheetAccess - Abstraction over spreadsheet operations
 */
declare class SheetAccess {
    static getData(sheetName: string): any[];
    static getDataAsArrays(sheetName: string): any[][];
    static getDataWithFormulas(sheetName: string): any[];
    static setData(sheetName: string, data: any[]): void;
    static appendRows(sheetName: string, rows: any[][]): void;
    static clearCache(sheetName: string): void;
    static getSheet(sheetName: string): GoogleAppsScript.Spreadsheet.Sheet;
}
```

### Step 4: Add to Module Exports (Haiku, 2 mins)

**File**: `src/1namespaces.js`

Add comment documenting the new class:

```javascript
// SheetAccess - Abstraction layer for spreadsheet operations (replaces direct Fiddler use)
```

No namespace assignment needed (flat class pattern).

### Step 5: Create Tests (Sonnet, 1 hour)

**File**: `__tests__/SheetAccess.test.js`

Test all public methods:

```javascript
const { SheetAccess } = require('../src/common/data/SheetAccess.js');

// Mock SpreadsheetManager
jest.mock('../src/common/data/storage/SpreadsheetManager.js', () => ({
    SpreadsheetManager: {
        getFiddler: jest.fn(),
        getSheet: jest.fn(),
        getDataWithFormulas: jest.fn(),
        clearFiddlerCache: jest.fn()
    }
}));

describe('SheetAccess', () => {
    describe('getData', () => {
        test('returns data from Fiddler', () => {
            // Test implementation
        });
    });
    
    // ... tests for all methods
});
```

**Target**: 100% coverage on SheetAccess class

### Step 6: Migrate One Service (Sonnet, 30 mins)

**Choose**: `DirectoryService` (lowest risk, simple read-only operations)

**Pattern**:
```javascript
// ❌ Before
const members = SpreadsheetManager.getFiddler('ActiveMembers').getData();

// ✅ After
const members = SheetAccess.getData('ActiveMembers');
```

**File**: `src/services/DirectoryService/Manager.js`

Replace all Fiddler calls with SheetAccess calls. Run tests to verify:

```bash
npm test -- DirectoryService.Manager.test.js
```

### Step 7: Documentation (Haiku, 10 mins)

**Files to Update**:

1. **README.md** - Add note about SheetAccess abstraction
2. **copilot-instructions.md** - Update "Data Access via Fiddler" section:
   ```markdown
   ## Data Access Pattern
   
   **ALWAYS use `SheetAccess` for spreadsheet operations** (not direct Fiddler calls):
   
   ```javascript
   const data = SheetAccess.getData('ActiveMembers');
   SheetAccess.setData('ActiveMembers', updatedData);
   ```
   
   SheetAccess provides abstraction over Fiddler library, enabling future migration to native SpreadsheetApp.
   ```

### Step 8: Verification (10 mins)

```bash
# Type check
npm run typecheck  # Must be 0 production errors

# Full test suite
npm test  # Must be 1113+ passing

# Verify DirectoryService still works
npm run dev:push
# Manually test DirectoryService in dev environment

# Search for any direct Fiddler usage in DirectoryService
grep "getFiddler" src/services/DirectoryService/
# Should return 0 results
```

## Success Criteria

- ✅ `SheetAccess` class created with 8 methods
- ✅ Type definitions added to `global.d.ts`
- ✅ 100% test coverage on `SheetAccess` class
- ✅ `DirectoryService` migrated to use `SheetAccess`
- ✅ All DirectoryService tests still passing
- ✅ Documentation updated
- ✅ 0 production type errors maintained
- ✅ 1113+ tests still passing
- ✅ DirectoryService verified working in dev environment

## Model Recommendation

**Opus** for Step 1 (API design - architectural decisions)  
**Sonnet** for Steps 2, 3, 5, 6 (implementation and testing)  
**Haiku** for Steps 4, 7, 8 (simple edits and verification)

**Rationale**:
- **Opus needed**: API design requires architectural judgment (what methods to expose, how to handle edge cases, migration strategy)
- **Sonnet for implementation**: Class creation, type definitions, tests, and service migration require careful code manipulation but follow established patterns
- **Haiku for mechanical tasks**: Adding to exports, updating docs, running verification commands

**Time Breakdown**:
- Opus: 30 mins (API design)
- Sonnet: 2.75 hours (implementation, types, tests, migration)
- Haiku: 25 mins (exports, docs, verification)
- **Total: 3.5 hours**

## Estimated Effort

**3.5 hours** (Opus + Sonnet + Haiku)

## Priority

**MEDIUM** - Important preparation for future Fiddler removal, but not urgent

## Benefits

1. **Decoupling**: Services no longer depend directly on Fiddler
2. **Future-proofing**: Can swap Fiddler implementation without touching services
3. **Clarity**: Explicit API shows all sheet operations in one place
4. **Testing**: Easier to mock SheetAccess than Fiddler
5. **Migration path**: Can gradually migrate services one at a time

## Next Steps After This Issue

1. Gradually migrate remaining services to use `SheetAccess` (one PR per service)
2. Once all services migrated, implement native SpreadsheetApp backend
3. Remove Fiddler dependency from `appsscript.json`

(See Issue #358 for full Fiddler removal plan)

## Testing Requirements

1. **Unit tests**: 100% coverage on `SheetAccess` class
2. **Integration tests**: DirectoryService tests must pass
3. **Manual testing**: DirectoryService works in dev environment
4. **Regression testing**: All 1113+ tests must still pass

## Related Issues

- Issue #358: Remove Fiddler Library Dependency (long-term goal)
- Addresses "Fiddler Library Dependency" from code quality review
