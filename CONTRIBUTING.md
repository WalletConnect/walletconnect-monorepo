# Contributing to WalletConnect

Thank you for your interest in contributing to WalletConnect! This document provides guidelines for contributing.

## Getting Started

1. Fork the repository
2. Clone your fork: `git clone https://github.com/YOUR_USERNAME/walletconnect-monorepo.git`
3. Create a branch: `git checkout -b your-feature-branch`
4. Make your changes
5. Test your changes: `npm run check`
6. Submit a pull request

## Development Workflow

### Before Starting

1. Ensure you have Node.js 18+ and npm 9+ installed
2. Install dependencies: `npm install`
3. Set up TEST_PROJECT_ID (see README.md)
4. Run health check: `./scripts/health-check.sh`

### Making Changes

1. **Work on a package**: Navigate to the specific package directory
2. **Make changes**: Edit files in the package
3. **Test locally**: Run `npm run test` in the package directory
4. **Build**: Run `npm run build` to verify compilation
5. **Lint**: Run `npm run lint` to check code style
6. **Prettier**: Run `npm run prettier` to format code

### Running Checks

Before submitting a PR, ensure all checks pass:

```sh
# Run all checks
npm run check

# Or use the validation script
./scripts/validate.sh
```

### Code Style

- Follow ESLint rules (see `.eslintrc`)
- Use Prettier for formatting
- Follow TypeScript best practices
- Write tests for new features
- Document public APIs

## Testing

### Unit Tests

Run tests for a specific package:
```sh
cd packages/core
npm run test
```

Run all tests:
```sh
npm run test
```

### Test Requirements

- All new features must include tests
- Tests should be isolated and deterministic
- Use descriptive test names
- Cover edge cases

## Pull Request Process

1. **Create a clear title**: Describe what the PR does
2. **Write a description**: Explain the changes and why
3. **Link issues**: Reference related issues
4. **Ensure checks pass**: All CI checks must pass
5. **Request review**: Tag relevant maintainers

### PR Checklist

- [ ] Code follows style guidelines
- [ ] Tests pass locally
- [ ] Documentation updated (if needed)
- [ ] No console.log statements (use console.warn if needed)
- [ ] TypeScript types are correct
- [ ] No breaking changes (or documented if intentional)

## Package-Specific Guidelines

### Core Package

- Focus on core WalletConnect functionality
- Maintain backward compatibility
- Document all public APIs

### Sign Client

- Follow existing patterns
- Handle errors gracefully
- Test connection scenarios

### Types Package

- Keep types accurate and up-to-date
- Document complex types
- Export types properly

## Questions?

- Check [TROUBLESHOOTING.md](./docs/TROUBLESHOOTING.md)
- Review package README files
- Open an issue for questions
- Ask on WalletConnect Discord

## Resources

- [WalletConnect Docs](https://docs.walletconnect.com)
- [WalletConnect Cloud](https://cloud.walletconnect.com)
- [Development Guide](./docs/DEVELOPMENT_GUIDE.md)

