# TypeScript Configuration Notes

This document explains the TypeScript configuration for the WalletConnect monorepo.

## Root Configuration

The root `tsconfig.json` provides base configuration shared across all packages:

- **Target**: ES2020
- **Module**: ES2020
- **Strict mode**: Enabled
- **Source maps**: Enabled for debugging
- **Composite**: Enabled for project references

## Package-Specific Configuration

Each package extends the root configuration and may add package-specific settings:

- `packages/core/tsconfig.json`
- `packages/sign-client/tsconfig.json`
- `packages/types/tsconfig.json`
- `packages/utils/tsconfig.json`
- `packages/web3wallet/tsconfig.json`

## Common TypeScript Issues

### Type Errors in Tests

If you see type errors in test files:
- Ensure test files are included in `tsconfig.json`
- Check that `@types/*` packages are installed
- Verify `vitest.config.ts` is properly configured

### Module Resolution Issues

If you see "Cannot find module" errors:
- Check that `moduleResolution` is set to "Node"
- Verify package paths in `tsconfig.json`
- Ensure dependencies are installed

### Strict Mode Issues

If strict mode causes errors:
- Fix type annotations
- Add null checks where needed
- Use type assertions only when necessary

## Best Practices

1. **Always use TypeScript types**: Avoid `any` when possible
2. **Enable strict mode**: Catch errors at compile time
3. **Use project references**: Leverage composite builds for faster compilation
4. **Source maps**: Keep enabled for better debugging experience

