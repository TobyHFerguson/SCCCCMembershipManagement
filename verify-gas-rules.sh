#!/bin/bash
# verify-gas-rules.sh - Universal GAS pattern verification
# 
# This is a minimal version for CI testing.
# Full version should be symlinked from _shared/verify-gas-rules.sh
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

echo "Running GAS rule verification..."

# Check 1: No @param {Object} without specifics
header "No @param {Object} (use specific types)"
if matches=$(grep -rn "@param {Object}" "$SRC_DIR" 2>/dev/null | grep -v "JUSTIFIED:"); then
    echo -e "${RED}❌ ERROR: Found @param {Object} without JUSTIFIED comment:${NC}"
    echo "$matches"
    ERRORS=$((ERRORS + 1))
else
    echo -e "${GREEN}✅ PASS: No @param {Object} found${NC}"
fi

# Check 2: No unjustified @param {any}
header "No unjustified @param {any}"
if matches=$(grep -rn "@param {any}" "$SRC_DIR" 2>/dev/null | grep -v "JUSTIFIED:"); then
    echo -e "${RED}❌ ERROR: Found @param {any} without JUSTIFIED comment:${NC}"
    echo "$matches"
    ERRORS=$((ERRORS + 1))
else
    echo -e "${GREEN}✅ PASS: No unjustified @param {any} found${NC}"
fi

# Check 3: Audit Record<string, any> usage
header "Audit Record<string, any> usage"
if matches=$(grep -rn "Record<string, any>" "$SRC_DIR" 2>/dev/null | grep -v "JUSTIFIED:"); then
    echo -e "${YELLOW}⚠️  WARN: Found Record<string, any> (audit for necessity):${NC}"
    echo "$matches"
    WARNINGS=$((WARNINGS + 1))
else
    echo -e "${GREEN}✅ PASS: No Record<string, any> found${NC}"
fi

# Summary
echo ""
echo "────────────────────────────────────────"
if [ $ERRORS -gt 0 ]; then
    echo -e "${RED}GAS rules: $WARNINGS warning(s), $ERRORS error(s) ❌${NC}"
    exit 1
elif [ $WARNINGS -gt 0 ]; then
    echo -e "${YELLOW}GAS rules: $WARNINGS warning(s), 0 errors ⚠️${NC}"
    exit 0
else
    echo -e "${GREEN}GAS rules: All checks passed ✅${NC}"
    exit 0
fi
