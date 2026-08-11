/**
 * A byte array backed by a plain ArrayBuffer.
 *
 * Since TypeScript 5.7, Uint8Array is generic over its backing buffer, and the
 * default (`ArrayBufferLike`) includes SharedArrayBuffer. WebCrypto's
 * BufferSource does not accept that, so anything destined for crypto.subtle
 * has to say ArrayBuffer explicitly.
 */
export type Bytes = Uint8Array<ArrayBuffer>;
