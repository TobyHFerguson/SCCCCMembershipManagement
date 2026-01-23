# Implement ValidatedTransaction Class

## Overview

Create a `ValidatedTransaction` class following the same pattern as `ValidatedMember` to provide type-safe transaction handling with constructor validation and factory methods that never throw exceptions.

## Current State

Transaction data is currently handled as plain objects (`Record<string, any>`) without validation. The `MembershipManagement.Manager` class processes transactions but relies on runtime checks.

**Files Involved**:
- `src/services/MembershipManagement/Manager.js` - Uses transaction data
- `src/services/MembershipManagement/MembershipManagement.js` - Fetches transaction data

## Goals

1. Create `ValidatedTransaction.js` class with:
   - Constructor validation for required fields
   - Static factory method `fromRow()` that never throws
   - Email alerts for validation failures
   - 100% test coverage

2. Integrate into `MembershipManagement.Manager`:
   - Update `processPaidTransactions()` to use `ValidatedTransaction`
   - Add validation before processing
   - Consolidate error handling

## Recommended Approach

**Agent Models**: 
- **Opus** for design decisions (class structure, validation rules, error handling)
- **Sonnet** for implementation (following established pattern)

### Phase 1: Design (Opus, 1 hour)

**Key Decisions**:
- What fields are required? (Email, Amount, Date, Transaction ID, etc.)
- What validation rules? (email format, positive amount, valid date, etc.)
- How to handle partial failures? (continue processing valid transactions)
- Error reporting mechanism? (email alerts, audit log entries)

**Pattern to Follow**: `ValidatedMember.js`
```javascript
class ValidatedTransaction {
    constructor(email, amount, date, transactionId, ...) {
        // Validation throws on invalid data
    }
    
    static fromRow(rowArray, headers, rowNumber, errorCollector) {
        // Never throws - returns null on failure
        // Collects errors in errorCollector for batch alert
    }
    
    static validateRows(rows, headers, context) {
        // Validates batch, sends consolidated email on errors
        // Returns array of valid transactions
    }
    
    toArray() {
        // For sheet persistence
    }
}
```

**Deliverable**: Design document with:
- Field requirements
- Validation rules
- Error handling strategy
- Integration points in Manager.js

### Phase 2: Implementation (Sonnet, 3-4 hours)

1. **Create Core Class** (1 hour):
   - `src/common/data/ValidatedTransaction.js`
   - Constructor with validation
   - Factory methods (`fromRow`, `validateRows`)
   - IIFE-wrapped class per GAS pattern

2. **Add Tests** (1-2 hours):
   - `__tests__/ValidatedTransaction.test.js`
   - Test all validation rules
   - Test factory methods (success/failure)
   - Test batch validation with email alerts
   - **Target: 100% coverage**

3. **Integrate into Manager** (1 hour):
   - Update `Manager.processPaidTransactions()`
   - Use `ValidatedTransaction.validateRows()` before processing
   - Update type annotations
   - Update Manager tests

4. **Update GAS Wrapper** (30 mins):
   - Update `MembershipManagement.js` to use validated transactions
   - Add error handling for validation failures
   - Test in dev environment

### Phase 3: Verification (30 mins)

```bash
# Run tests
npm test -- ValidatedTransaction.test.js  # Must pass
npm test -- Manager.test.js              # Must pass

# Coverage check
npm test -- --coverage --collectCoverageFrom='src/common/data/ValidatedTransaction.js'
# Statements: 100%, Branches: 100%, Functions: 100%, Lines: 100%

# Type check
npm run typecheck  # Must remain 0 production errors

# Deploy and test
npm run dev:push
# Manually trigger payment processing in dev environment
```

## Success Criteria

- ✅ `ValidatedTransaction` class created following `ValidatedMember` pattern
- ✅ 100% test coverage on core class
- ✅ Integration tests in `Manager.test.js` updated and passing
- ✅ All 1113+ tests still passing
- ✅ 0 production type errors maintained
- ✅ Verified in dev environment with real transaction data
- ✅ Email alerts sent for invalid transaction data

## Effort Estimate

**4-6 hours total**:
- Opus design: 1 hour
- Sonnet implementation: 3-4 hours
- Verification: 30 mins

## Priority

**MEDIUM** - Valuable for long-term stability, not urgent (current system works correctly)

## Benefits

1. **Type Safety**: Compile-time validation instead of runtime checks
2. **Error Handling**: Graceful degradation with email alerts
3. **Maintainability**: Clear contract for transaction data structure
4. **Consistency**: Same pattern as `ValidatedMember` (established convention)

## Notes

- Transaction data currently comes from "Payments" sheet (needs verification)
- Consider if transaction validation rules differ by payment type (renewal, new member, etc.)
- This sets pattern for other validated data classes (e.g., `ValidatedElection`, `ValidatedActionSpec`)
