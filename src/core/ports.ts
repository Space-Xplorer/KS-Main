import type { Bytes } from "@/core/encoding/bytes";

/**
 * Ports: everything src/core/ needs from the outside world.
 *
 * Core never constructs these — they are passed in. That is what lets the
 * domain run in a unit test with a fake clock and a fake signer, and in a
 * browser at the venue gate with WebCrypto and IndexedDB, without the domain
 * code knowing the difference.
 */

/** Wall clock, injected so "earliest timestamp wins" is testable without sleeping. */
export interface Clock {
  /** Milliseconds since the Unix epoch. */
  now(): number;
}

/** Source of client-generated UUIDs, injected so tests get deterministic ids. */
export interface IdGenerator {
  /** A fresh UUID (v4 in production, sequential in tests). */
  newId(): string;
}

/** Produces a detached signature over arbitrary bytes. */
export interface TokenSigner {
  sign(bytes: Bytes): Promise<Bytes>;
}

/**
 * Checks a detached signature.
 *
 * Implementations MUST compare in constant time. The WebCrypto adapter gets
 * this for free via crypto.subtle.verify; a hand-rolled byte loop would not.
 */
export interface TokenVerifier {
  verify(bytes: Bytes, signature: Bytes): Promise<boolean>;
}
