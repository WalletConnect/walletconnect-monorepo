#!/bin/bash
# Health check script for WalletConnect monorepo
# Checks the health of all packages and dependencies

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

echo -e "${BLUE}WalletConnect Monorepo Health Check${NC}"
echo "======================================"

failed=0

# Check Node.js version
echo -e "\n${YELLOW}Checking Node.js version...${NC}"
node_version=$(node --version)
echo "Node.js: $node_version"

# Check npm version
echo -e "\n${YELLOW}Checking npm version...${NC}"
npm_version=$(npm --version)
echo "npm: $npm_version"

# Check if node_modules exists
echo -e "\n${YELLOW}Checking dependencies...${NC}"
if [ ! -d "$REPO_ROOT/node_modules" ]; then
    echo -e "${RED}✗ node_modules not found. Run 'npm install'${NC}"
    failed=1
else
    echo -e "${GREEN}✓ node_modules exists${NC}"
fi

# Check TEST_PROJECT_ID
echo -e "\n${YELLOW}Checking TEST_PROJECT_ID...${NC}"
if [ -z "$TEST_PROJECT_ID" ]; then
    echo -e "${YELLOW}⚠ TEST_PROJECT_ID not set${NC}"
    echo "Get your project ID from https://cloud.walletconnect.com"
else
    echo -e "${GREEN}✓ TEST_PROJECT_ID is set${NC}"
fi

# Check package.json files
echo -e "\n${YELLOW}Checking package.json files...${NC}"
for package_dir in packages/* providers/*; do
    if [ -d "$package_dir" ] && [ -f "$package_dir/package.json" ]; then
        package_name=$(basename "$package_dir")
        echo "  Checking $package_name..."
        if [ ! -f "$package_dir/package.json" ]; then
            echo -e "    ${RED}✗ package.json missing${NC}"
            failed=1
        else
            echo -e "    ${GREEN}✓ package.json exists${NC}"
        fi
    fi
done

# Check TypeScript configuration
echo -e "\n${YELLOW}Checking TypeScript configuration...${NC}"
if [ -f "$REPO_ROOT/tsconfig.json" ]; then
    echo -e "${GREEN}✓ Root tsconfig.json exists${NC}"
else
    echo -e "${RED}✗ Root tsconfig.json missing${NC}"
    failed=1
fi

# Check build folders
echo -e "\n${YELLOW}Checking build folders...${NC}"
for package_dir in packages/* providers/*; do
    if [ -d "$package_dir" ]; then
        package_name=$(basename "$package_dir")
        if [ -d "$package_dir/dist" ]; then
            echo "  $package_name: dist folder exists"
        fi
    fi
done

# Summary
echo ""
echo "======================================"
if [ $failed -eq 0 ]; then
    echo -e "${GREEN}Health check passed!${NC}"
    exit 0
else
    echo -e "${RED}Health check failed${NC}"
    exit 1
fi

