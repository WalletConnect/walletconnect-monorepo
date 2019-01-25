# WalletConnect Utils

Utility Library for WalletConnect

## API

```javascript

// ArrayBuffer
function convertArrayBufferToBuffer (arrayBuffer: ArrayBuffer): Buffer
function convertArrayBufferToUtf8 (arrayBuffer: ArrayBuffer): string
function convertArrayBufferToHex (arrayBuffer: ArrayBuffer): string
function concatArrayBuffers (...args: ArrayBuffer[]): ArrayBuffer

// Buffer
function convertBufferToArrayBuffer (buffer: Buffer): ArrayBuffer
function convertBufferToUtf8 (buffer: Buffer): string
function convertBufferToHex (buffer: Buffer): string
function concatBuffers (...args: Buffer[]): Buffer

// Utf-8
function convertUtf8ToArrayBuffer (utf8: string): ArrayBuffer
function convertUtf8ToBuffer (utf8: string): Buffer

// Hex
function convertHexToBuffer (hex: string): Buffer
function convertHexToArrayBuffer (hex: string): ArrayBuffer

// Misc
function payloadId (): number
function uuid (): string
function getMeta (): IClientMeta | null
function parseWalletConnectUri (str: string): IParseURIResult

```
