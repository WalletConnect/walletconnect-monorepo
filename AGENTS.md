# AGENTS.md

This file provides guidance to AI agents when working with code in this repository.

## Project Overview

WalletConnect is an open protocol for connecting cryptocurrency wallets to decentralized applications (dApps). This monorepo contains the official JavaScript/TypeScript SDK implementation used by thousands of applications in the Web3 ecosystem.

**Core purpose**: Enable secure communication between wallets and dApps across multiple blockchain networks using end-to-end encrypted relay messaging.

**Key concepts**:
- **Sessions**: Persistent connections between a wallet and dApp with defined permissions
- **Pairings**: Initial handshake mechanism using QR codes or deep links
- **Namespaces**: Chain-agnostic way to define supported networks and methods (CAIP-25)
- **Relay**: WebSocket-based message transport layer

## Repository Structure

```
walletconnect-monorepo/
├── packages/
│   ├── types/              # Shared TypeScript interfaces and types
│   ├── utils/              # Utility functions (validators, formatters, URI parsing)
│   ├── core/               # Core functionality (relay, crypto, pairing, storage)
│   ├── sign-client/        # Sign Client API - main entry point for developers
│   ├── pay/                # WalletConnect Pay functionality
│   ├── pos-client/         # Point of Sale client
│   └── react-native-compat/ # React Native polyfills and compatibility
├── providers/
│   ├── universal-provider/ # Multi-chain provider supporting EVM, Solana, Cosmos, etc.
│   ├── ethereum-provider/  # EIP-1193 compliant Ethereum provider (web3/ethers compatible)
│   └── signer-connection/  # Low-level signer connection utilities
├── scripts/                # Build, versioning, and release scripts
├── .github/workflows/      # CI/CD pipelines
├── .changeset/             # Changeset configuration for versioning
└── rollup.config.js        # Shared Rollup build configuration
```

## Key Commands

```bash
# Install all dependencies
npm install

# Build all packages (required before testing)
npm run build

# Run tests (requires environment variables)
TEST_PROJECT_ID=xxx TEST_RELAY_URL=xxx npm run test

# Run tests for a specific package
npm run test --prefix=packages/sign-client
npm run test --prefix=providers/universal-provider

# Lint all packages
npm run lint

# Check code formatting
npm run prettier

# Full validation (lint + build + test)
npm run check

# Clean build artifacts
npm run clean

# Create a changeset for versioning
npm run changeset
```

## Architecture Overview

### Package Dependency Graph

```
@walletconnect/types (base layer - no internal deps)
         │
         ▼
@walletconnect/utils (validators, formatters, CAIP utilities)
         │
         ▼
@walletconnect/core (relay client, crypto, pairing, expirer, storage)
         │
         ▼
@walletconnect/sign-client (session management, proposals, requests)
         │
         ▼
@walletconnect/universal-provider (multi-chain JSON-RPC provider)
         │
         ▼
@walletconnect/ethereum-provider (EIP-1193 interface)
```

### Core Components

**Relay Client** (`packages/core/src/controllers/relayer.ts`)
- WebSocket connection to WalletConnect relay servers
- Message publishing and subscription
- Automatic reconnection and heartbeat

**Crypto** (`packages/core/src/controllers/crypto.ts`)
- X25519 key exchange
- ChaCha20-Poly1305 symmetric encryption
- Type 0 (sym key) and Type 1 (key agreement) envelopes

**Pairing** (`packages/core/src/controllers/pairing.ts`)
- URI generation and parsing (`wc:` protocol)
- QR code data encoding
- Pairing lifecycle management

**Sign Client** (`packages/sign-client/src/client.ts`)
- Session proposal/approval flow
- Request/response handling
- Event emission for dApp/wallet integration

**Universal Provider** (`providers/universal-provider/src/UniversalProvider.ts`)
- Chain-agnostic JSON-RPC provider
- Namespace-based routing to appropriate handlers
- EVM, Solana, Cosmos, Polkadot support

### Data Flow

```
dApp                           Relay                          Wallet
  │                              │                              │
  │──── session_propose ────────▶│──────────────────────────────▶│
  │                              │                              │
  │◀─── session_settle ─────────│◀──────────────────────────────│
  │                              │                              │
  │──── session_request ────────▶│──────────────────────────────▶│
  │                              │                              │
  │◀─── session_response ───────│◀──────────────────────────────│
```

## Development Notes

### Environment Variables

| Variable | Purpose |
|----------|---------|
| `TEST_PROJECT_ID` | WalletConnect Cloud project ID (required for tests) |
| `TEST_RELAY_URL` | Relay server URL (defaults to production) |
| `TEST_PROJECT_ID_MOBILE` | Mobile-specific project ID |

Get a project ID at [WalletConnect Cloud](https://cloud.walletconnect.com).

### Code Style

- **TypeScript**: Strict mode enabled
- **Quotes**: Double quotes (`"`)
- **Semicolons**: Always required
- **Imports**: Extensions required (`.js` for ESM)
- **Variables**: `const`/`let` only, never `var`
- **Trailing commas**: Required in multiline
- **Console**: No `console.log` (use `console.warn` if needed)

### Testing

- **Framework**: Vitest
- **Timeout**: 60 seconds (network operations)
- **Pattern**: `vitest run --dir test`
- Tests create real WebSocket connections to relay servers
- Some tests require two clients (dApp + wallet simulation)

### Security Considerations

This is a cryptographic wallet SDK. Critical areas:
- **Private keys**: Never log, store securely, clear from memory
- **Session validation**: Verify namespaces, methods, chains
- **Input validation**: CAIP-2 chain IDs, CAIP-10 accounts
- **Message integrity**: Verify encryption, reject malformed
- **URI handling**: Validate `wc:` protocol URIs

### Common Patterns

**Client Initialization**:
```typescript
const client = await SignClient.init({
  projectId: "xxx",
  metadata: {
    name: "My dApp",
    description: "...",
    url: "https://...",
    icons: ["https://..."]
  }
});
```

**Event Handling**:
```typescript
client.on("session_proposal", ({ id, params }) => { });
client.on("session_request", ({ topic, params }) => { });
client.on("session_delete", ({ topic }) => { });
```

**Namespace Format** (CAIP-25):
```typescript
const namespaces = {
  eip155: {
    chains: ["eip155:1", "eip155:137"],
    methods: ["eth_sendTransaction", "personal_sign"],
    events: ["chainChanged", "accountsChanged"]
  }
};
```

### PR Workflow

1. Branch from `v2.0` (main branch)
2. Make changes with tests
3. Run `npm run check` locally
4. Create changeset if user-facing: `npm run changeset`
5. Open PR targeting `v2.0`
6. CI runs lint, build, tests
7. Claude auto-review provides feedback

### Debugging Tips

- Enable debug logs: `DEBUG=walletconnect:* node ...`
- Check relay connection: Monitor WebSocket frames
- Session issues: Inspect `client.session.getAll()`
- Pairing issues: Check `client.core.pairing.getPairings()`
