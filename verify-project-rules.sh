#!/bin/bash
# verify-project-rules.sh - SCCCCManagement-specific pattern verification
#
# These rules are specific to this project's architecture.
# Universal GAS rules are checked by verify-gas-rules.sh (shared).
#
# Exit codes:
#   0 = All checks passed
#   1 = One or more violations found

set -euo pipefail

SRC_DIR="${1:-src/}"
ERRORS=0
WARNINGS=0

# Colors (disable if not a terminal)
if [ -t 1 ]; then
    RED='\033[0;31m'
    YELLOW='\033[0;33m'
    GREEN='\033[0;32m'
    BOLD='\033[1m'
    NC='\033[0m'
else
    RED='' YELLOW='' GREEN='' BOLD='' NC=''
fi

header() {
    echo ""
    echo -e "${BOLD}=== $1 ===${NC}"
}

pass() {
    echo -e "  ${GREEN}✅ PASS${NC}: $1"
}

fail() {
    echo -e "  ${RED}❌ FAIL${NC}: $1"
    ERRORS=$((ERRORS + 1))
}

warn() {
    echo -e "  ${YELLOW}⚠️  WARN${NC}: $1"
    WARNINGS=$((WARNINGS + 1))
}

show_matches() {
    while IFS= read -r line; do
        echo "       $line"
    done
}

# ──────────────────────────────────────────────────────────────
# DATA ACCESS RULES
# ──────────────────────────────────────────────────────────────

header "No direct SpreadsheetManager use in services (use SheetAccess)"
matches=$(grep -rn "SpreadsheetManager\.\(getFiddler\|getSheet\|getData\)" "${SRC_DIR}services/" --include="*.js" 2>/dev/null || true)
if [ -z "$matches" ]; then
    pass "Services use SheetAccess abstraction"
else
    fail "Direct SpreadsheetManager calls in services (use SheetAccess):"
    echo "$matches" | show_matches
fi

header "No getActiveSpreadsheet() in services (use SheetAccess)"
# Allowed in Layer 0 (SpreadsheetManager, Logger, triggers) but NOT in services
matches=$(grep -rn "getActiveSpreadsheet" "${SRC_DIR}services/" --include="*.js" 2>/dev/null || true)
if [ -z "$matches" ]; then
    pass "No getActiveSpreadsheet() in services"
else
    warn "getActiveSpreadsheet() found in services (migrate to SheetAccess):"
    echo "$matches" | show_matches
fi

# ──────────────────────────────────────────────────────────────
# CIRCULAR DEPENDENCY PREVENTION
# ──────────────────────────────────────────────────────────────

header "No AppLogger usage in Layer 0 modules"
# Layer 0: SpreadsheetManager.js, Properties.js, Logger.js
# These must use console.log/Logger.log only — AppLogger creates circular dependency
LAYER0_FILES=(
    "${SRC_DIR}common/data/storage/SpreadsheetManager.js"
    "${SRC_DIR}common/config/Properties.js"
)
layer0_violations=""
for f in "${LAYER0_FILES[@]}"; do
    if [ -f "$f" ]; then
        # Search for AppLogger.xxx calls, excluding ALL comment lines
        # Comment patterns: lines starting with //, *, /*, or containing // before AppLogger
        file_matches=$(grep -n "AppLogger\.\(info\|warn\|error\|debug\|log\|configure\)" "$f" 2>/dev/null \
            | grep -v "^[0-9]*:[[:space:]]*//" \
            | grep -v "^[0-9]*:[[:space:]]*/\*" \
            | grep -v "^[0-9]*:[[:space:]]*\*" \
            | grep -v "//.*AppLogger\." \
            || true)
        if [ -n "$file_matches" ]; then
            layer0_violations="${layer0_violations}${f}:${file_matches}\n"
        fi
    fi
done
if [ -z "$layer0_violations" ]; then
    pass "Layer 0 modules don't use AppLogger"
else
    fail "AppLogger calls in Layer 0 modules (use console.log instead):"
    echo -e "$layer0_violations" | show_matches
fi

# ──────────────────────────────────────────────────────────────
# SPA ARCHITECTURE RULES
# ──────────────────────────────────────────────────────────────

header "No Date objects in SPA API return paths"
# Check for 'new Date()' in Api.js files that might be returned to client
matches=$(grep -rn "new Date()" "${SRC_DIR}services/"*/Api.js 2>/dev/null | grep -v "//.*new Date\|JUSTIFIED" || true)
if [ -z "$matches" ]; then
    pass "No obvious Date construction in API files"
else
    warn "Date construction in API files (ensure dates are serialized to strings before returning):"
    echo "$matches" | show_matches
fi

# ──────────────────────────────────────────────────────────────
# SUMMARY
# ──────────────────────────────────────────────────────────────

echo ""
echo -e "${BOLD}────────────────────────────────────────${NC}"
if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
    echo -e "${GREEN}${BOLD}All project-specific rules passed ✅${NC}"
elif [ $ERRORS -eq 0 ]; then
    echo -e "${YELLOW}${BOLD}Project rules: $WARNINGS warning(s), 0 errors ⚠️${NC}"
else
    echo -e "${RED}${BOLD}Project rules: $ERRORS error(s), $WARNINGS warning(s) ❌${NC}"
fi
echo -e "${BOLD}────────────────────────────────────────${NC}"

exit $ERRORS
