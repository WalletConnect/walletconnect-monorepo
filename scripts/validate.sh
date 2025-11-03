#!/bin/bash
# Validation script for WalletConnect monorepo
# Runs lint, build, and test checks with better error handling

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

echo -e "${BLUE}WalletConnect Monorepo Validation${NC}"
echo "=================================="

# Check for TEST_PROJECT_ID
if [ -z "$TEST_PROJECT_ID" ]; then
    echo -e "${YELLOW}Warning: TEST_PROJECT_ID not set${NC}"
    echo "Tests may fail. Get your project ID from https://cloud.walletconnect.com"
    echo "Export it with: export TEST_PROJECT_ID=your_project_id"
    read -p "Continue anyway? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Function to run command with error handling
run_check() {
    local name="$1"
    local cmd="$2"
    
    echo -e "\n${YELLOW}Running: $name${NC}"
    echo "Command: $cmd"
    
    if eval "$cmd"; then
        echo -e "${GREEN}✓ $name passed${NC}"
        return 0
    else
        echo -e "${RED}✗ $name failed${NC}"
        return 1
    fi
}

# Track failures
failed=0

# Run lint
if ! run_check "Lint" "npm run lint"; then
    failed=1
fi

# Run prettier
if ! run_check "Prettier" "npm run prettier"; then
    failed=1
fi

# Run build
if ! run_check "Build" "npm run build"; then
    failed=1
fi

# Run tests if TEST_PROJECT_ID is set
if [ -n "$TEST_PROJECT_ID" ]; then
    if ! run_check "Tests" "npm run test"; then
        failed=1
    fi
else
    echo -e "${YELLOW}Skipping tests (TEST_PROJECT_ID not set)${NC}"
fi

# Summary
echo ""
echo "=================================="
if [ $failed -eq 0 ]; then
    echo -e "${GREEN}All checks passed!${NC}"
    exit 0
else
    echo -e "${RED}Some checks failed${NC}"
    exit 1
fi

