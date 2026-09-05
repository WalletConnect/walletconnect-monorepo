---
@walletconnect/ethereum-provider: patch
---

Added projectId validation to EthereumProvider.init(). The provider now throws a descriptive error immediately if projectId is empty, null, or contains only whitespace, preventing silent failures at runtime when the QR modal fails to appear due to missing credentials.
