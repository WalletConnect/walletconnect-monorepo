# ESLint Configuration Notes

## Configuration Overview

The WalletConnect monorepo uses ESLint with TypeScript support for code quality enforcement.

## Extends

- `standard` - JavaScript Standard Style
- `eslint:recommended` - Recommended ESLint rules
- `plugin:@typescript-eslint/eslint-recommended` - TypeScript ESLint recommended rules
- `plugin:@typescript-eslint/recommended` - TypeScript ESLint recommended rules

## Key Rules

### Code Style
- Double quotes required (`quotes`)
- Semicolons required (`semi`)
- Object curly spacing enforced
- Comma dangle required in multiline

### TypeScript Specific
- `@typescript-eslint/no-explicit-any`: Off (for flexibility)
- `@typescript-eslint/no-unused-vars`: Off (handled by TypeScript)
- `@typescript-eslint/no-use-before-define`: Off

### Best Practices
- No console.log (console.warn allowed)
- No var (use const/let)
- Undefined variables are errors
- Require await warnings

## Running ESLint

```sh
# Lint all packages
npm run lint

# Auto-fix issues
npm run lint -- --fix
```

## Troubleshooting

If you see ESLint errors:
1. Run auto-fix: `npm run lint -- --fix`
2. Check .eslintrc configuration
3. Verify Prettier compatibility
4. Review package-specific overrides

