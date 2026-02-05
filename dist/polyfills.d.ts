/**
 * Polyfills for ESNext features
 *
 * This module imports the disposablestack polyfill which enables the 'using'
 * syntax for automatic resource disposal. This is required for the Mutex
 * guard pattern with the W4G1/multithreading library.
 *
 * The 'using' keyword automatically disposes resources at the end of scope,
 * ensuring locks are always released even if an error occurs.
 *
 * @example
 * ```typescript
 * using guard = await mutex.lock();
 * guard.value.counter++;
 * // Lock automatically released here
 * ```
 */
import 'disposablestack/auto';
//# sourceMappingURL=polyfills.d.ts.map