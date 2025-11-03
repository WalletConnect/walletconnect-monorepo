# Development Guide

This guide helps new contributors get started with WalletConnect monorepo development.

## Getting Started

### Prerequisites Checklist

- [ ] Node.js 18.x or higher installed
- [ ] npm 9.x or higher installed
- [ ] Git installed and configured
- [ ] Build tools installed (node-gyp, etc.)
- [ ] WalletConnect Cloud account (for TEST_PROJECT_ID)

### Initial Setup

1. **Fork and clone**:
   ```sh
   git clone https://github.com/YOUR_USERNAME/walletconnect-monorepo.git
   cd walletconnect-monorepo
   ```

2. **Install dependencies**:
   ```sh
   npm install
   ```

3. **Set up test environment**:
   ```sh
   # Get project ID from https://cloud.walletconnect.com
   export TEST_PROJECT_ID=your_project_id
   ```

4. **Verify setup**:
   ```sh
   ./scripts/health-check.sh
   ```

## Package Structure

### Understanding the Monorepo

The monorepo is organized into packages and providers:

**Packages**:
- `packages/core` - Core WalletConnect functionality
- `packages/sign-client` - Sign client implementation  
- `packages/types` - TypeScript type definitions
- `packages/utils` - Utility functions
- `packages/web3wallet` - Web3Wallet implementation
- `packages/react-native-compat` - React Native compatibility

**Providers**:
- `providers/ethereum-provider` - Ethereum provider
- `providers/universal-provider` - Universal provider
- `providers/signer-connection` - Signer connection

## Development Workflow

### 1. Choosing a Package

Decide which package to work on based on your changes:
- Core functionality → `packages/core`
- Client features → `packages/sign-client`
- Provider logic → `providers/*`
- Utilities → `packages/utils`

### 2. Making Changes

1. Create a branch: `git checkout -b feature/your-feature`
2. Navigate to package: `cd packages/your-package`
3. Make changes
4. Test locally: `npm run test`
5. Build: `npm run build`
6. Check linting: `npm run lint`

### 3. Testing Your Changes

```sh
# Run tests for specific package
cd packages/core
npm run test

# Run all tests
cd ../..
npm run test

# Run validation script
./scripts/validate.sh
```

### 4. Submitting Changes

1. Commit your changes: `git commit -m "feat: add your feature"`
2. Push to your fork: `git push origin feature/your-feature`
3. Open a pull request
4. Ensure all CI checks pass

## Code Quality

### TypeScript

- Use explicit types when beneficial
- Avoid `any` when possible
- Leverage TypeScript's type inference
- Document complex types

### ESLint and Prettier

- Run `npm run lint` before committing
- Run `npm run prettier` to format code
- Fix all linting errors

### Testing

- Write tests for new features
- Maintain or improve test coverage
- Test edge cases and error scenarios
- Keep tests fast and isolated

## Common Development Tasks

### Adding a New Feature

1. Identify the correct package
2. Create a feature branch
3. Implement the feature
4. Add tests
5. Update documentation
6. Run all checks
7. Submit PR

### Fixing a Bug

1. Reproduce the bug
2. Write a failing test
3. Fix the bug
4. Verify test passes
5. Run all checks
6. Submit PR

### Refactoring

1. Ensure test coverage exists
2. Make refactoring changes
3. Run all tests
4. Verify no regressions
5. Update documentation if needed
6. Submit PR

## Debugging

### TypeScript Errors

- Check `tsconfig.json` configuration
- Verify type imports
- Check for circular dependencies

### Build Errors

- Clean and rebuild: `npm run clean && npm run build`
- Check package dependencies
- Verify TypeScript compilation

### Test Failures

- Run tests in watch mode: `npm run test -- --watch`
- Check TEST_PROJECT_ID
- Review test output for details

## Resources

- [TypeScript Configuration](./TS_CONFIG_NOTES.md)
- [ESLint Notes](./ESLINT_NOTES.md)
- [Test Configuration](./TEST_CONFIG_NOTES.md)
- [Troubleshooting](./TROUBLESHOOTING.md)
- [Contributing Guidelines](../CONTRIBUTING.md)

