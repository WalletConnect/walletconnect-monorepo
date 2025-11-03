# Test Configuration Notes

## Test Framework

WalletConnect monorepo uses [Vitest](https://vitest.dev) for testing.

## Configuration

The root `vitest.config.ts` provides base configuration shared across packages.

## Running Tests

### All Tests
```sh
npm run test
```

### Single Package
```sh
cd packages/core
npm run test
```

### Watch Mode
```sh
npm run test -- --watch
```

### Coverage
```sh
npm run test -- --coverage
```

## Test Environment

Tests require `TEST_PROJECT_ID` environment variable:
```sh
export TEST_PROJECT_ID=your_project_id
npm run test
```

## Package-Specific Tests

Each package has its own `vitest.config.ts` that extends the root configuration:
- `packages/core/vitest.config.ts`
- `packages/sign-client/vitest.config.ts`
- `packages/utils/vitest.config.ts`
- `providers/*/vitest.config.ts`

## Test Structure

Tests are located in `test/` directories within each package:
- Unit tests: `test/*.spec.ts`
- Integration tests: `test/integration/`
- Shared utilities: `test/shared/`

## Best Practices

1. **Isolate tests**: Each test should be independent
2. **Clean up**: Clean up after tests (mocks, connections, etc.)
3. **Use helpers**: Leverage shared test utilities
4. **Mock external services**: Mock WalletConnect Cloud when possible
5. **Test edge cases**: Cover error scenarios

## Common Issues

### Test Timeouts

If tests timeout:
- Increase timeout in vitest.config.ts
- Check network connectivity
- Verify TEST_PROJECT_ID is set correctly

### Flaky Tests

If tests are flaky:
- Check for race conditions
- Ensure proper cleanup
- Use proper async/await patterns
- Check for shared state

### Authentication Errors

If tests fail with auth errors:
- Verify TEST_PROJECT_ID is correct
- Check WalletConnect Cloud connection
- Review rate limiting

