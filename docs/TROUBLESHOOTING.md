# Troubleshooting Guide

This guide covers common issues when developing with WalletConnect monorepo.

## Installation Issues

### node-gyp Errors

**Error**: `gyp ERR! stack Error: Can't find Python executable`

**Solution**:
1. Install node-gyp globally: `npm i -g node-gyp`
2. Install Python 3.x
3. Install build tools:
   - Windows: `npm install --global windows-build-tools`
   - macOS: Install Xcode Command Line Tools
   - Linux: Install build-essential

### Xcode Command Line Tools Issues

**Error**: Various Xcode-related errors on macOS

**Solution**:
```sh
sudo xcode-select --switch /Library/Developer/CommandLineTools
sudo xcode-select --reset
```

### Permission Errors

**Error**: `EACCES: permission denied`

**Solution**:
1. Fix npm permissions: `npm config set prefix ~/.npm-global`
2. Add to PATH: `export PATH=~/.npm-global/bin:$PATH`
3. Or use a version manager: nvm or fnm

## Build Issues

### TypeScript Compilation Errors

**Error**: Type errors during build

**Solution**:
1. Clean build folders: `npm run clean`
2. Rebuild: `npm run build`
3. Check tsconfig.json for issues
4. Verify all dependencies are installed

### Module Resolution Errors

**Error**: `Cannot find module`

**Solution**:
1. Reinstall dependencies: `rm -rf node_modules && npm install`
2. Check workspace configuration in package.json
3. Verify package.json paths

### Build Fails on Specific Package

**Error**: One package fails to build

**Solution**:
1. Navigate to package directory
2. Run build locally: `npm run build`
3. Check package-specific dependencies
4. Verify rollup.config.js

## Test Issues

### TEST_PROJECT_ID Not Set

**Error**: Tests fail with authentication errors

**Solution**:
1. Get project ID from https://cloud.walletconnect.com
2. Export: `export TEST_PROJECT_ID=your_project_id`
3. Or create `.env` file with `TEST_PROJECT_ID=your_project_id`

### Test Timeouts

**Error**: Tests timeout

**Solution**:
1. Increase timeout in vitest.config.ts
2. Check network connectivity
3. Verify WalletConnect Cloud connection
4. Check for rate limiting

### Flaky Tests

**Error**: Tests pass inconsistently

**Solution**:
1. Check for race conditions
2. Verify test isolation
3. Check async operations
4. Review test cleanup

## Linting Issues

### ESLint Errors

**Error**: Various ESLint rule violations

**Solution**:
1. Run auto-fix: `npm run lint -- --fix`
2. Check .eslintrc configuration
3. Review ESLint plugin versions
4. Fix formatting: `npm run prettier`

### Prettier Conflicts

**Error**: Prettier and ESLint conflicts

**Solution**:
1. Ensure eslint-config-prettier is installed
2. Run prettier: `npm run prettier`
3. Check .prettierrc configuration
4. Verify prettier is last in ESLint config

## Runtime Issues

### WalletConnect Connection Fails

**Error**: Cannot connect to WalletConnect

**Solution**:
1. Verify TEST_PROJECT_ID is correct
2. Check network connectivity
3. Verify WalletConnect Cloud status
4. Check relay endpoint configuration

### Package Import Errors

**Error**: Cannot import package

**Solution**:
1. Rebuild packages: `npm run build`
2. Check package exports in package.json
3. Verify workspace configuration
4. Clear node_modules and reinstall

## Getting Help

1. Check package-specific README files
2. Review test files for usage examples
3. Check GitHub issues
4. Ask on WalletConnect Discord
5. Review WalletConnect documentation

