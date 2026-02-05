/**
 * Shared State Module
 *
 * Provides thread-safe shared state using SharedJsonBuffer protected by Mutex,
 * and Barrier for leader election among worker threads.
 *
 * Key features:
 * - SharedJsonBuffer: Zero-copy JSON state sharing with partial update optimization
 * - Mutex: Async lock acquisition (non-blocking)
 * - Barrier: Leader election via wait() returning { isLeader: boolean }
 *
 * @module shared-state
 */
var __addDisposableResource = (this && this.__addDisposableResource) || function (env, value, async) {
    if (value !== null && value !== void 0) {
        if (typeof value !== "object" && typeof value !== "function") throw new TypeError("Object expected.");
        var dispose, inner;
        if (async) {
            if (!Symbol.asyncDispose) throw new TypeError("Symbol.asyncDispose is not defined.");
            dispose = value[Symbol.asyncDispose];
        }
        if (dispose === void 0) {
            if (!Symbol.dispose) throw new TypeError("Symbol.dispose is not defined.");
            dispose = value[Symbol.dispose];
            if (async) inner = dispose;
        }
        if (typeof dispose !== "function") throw new TypeError("Object not disposable.");
        if (inner) dispose = function() { try { inner.call(this); } catch (e) { return Promise.reject(e); } };
        env.stack.push({ value: value, dispose: dispose, async: async });
    }
    else if (async) {
        env.stack.push({ async: true });
    }
    return value;
};
var __disposeResources = (this && this.__disposeResources) || (function (SuppressedError) {
    return function (env) {
        function fail(e) {
            env.error = env.hasError ? new SuppressedError(e, env.error, "An error was suppressed during disposal.") : e;
            env.hasError = true;
        }
        var r, s = 0;
        function next() {
            while (r = env.stack.pop()) {
                try {
                    if (!r.async && s === 1) return s = 0, env.stack.push(r), Promise.resolve().then(next);
                    if (r.dispose) {
                        var result = r.dispose.call(r.value);
                        if (r.async) return s |= 2, Promise.resolve(result).then(next, function(e) { fail(e); return next(); });
                    }
                    else s |= 1;
                }
                catch (e) {
                    fail(e);
                }
            }
            if (s === 1) return env.hasError ? Promise.reject(env.error) : Promise.resolve();
            if (env.hasError) throw env.error;
        }
        return next();
    };
})(typeof SuppressedError === "function" ? SuppressedError : function (error, suppressed, message) {
    var e = new Error(message);
    return e.name = "SuppressedError", e.error = error, e.suppressed = suppressed, e;
});
import { Mutex, SharedJsonBuffer, Barrier } from 'multithreading';
import os from 'os';
// ============================================================================
// Initial State
// ============================================================================
/**
 * Initial state for the shared statistics buffer.
 */
const initialStats = {
    totalRequests: 0,
    totalComputeTime: 0,
    workerTaskCount: {},
    lastUpdated: null,
    activeWorkers: 0,
    currentLeader: null
};
// ============================================================================
// Shared State Instances
// ============================================================================
/**
 * SharedJsonBuffer wrapped in Mutex for thread-safe access.
 *
 * The SharedJsonBuffer provides efficient JSON state sharing with Proxy-based
 * partial updates - only changed bytes are reserialized, not the entire object.
 *
 * The Mutex ensures only one thread can modify the state at a time.
 * Use 'using guard = await systemStatsMutex.lock()' for automatic unlock.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const systemStatsMutex = new Mutex(new SharedJsonBuffer(initialStats));
/**
 * Barrier for leader election among worker threads.
 *
 * Size is set to the number of CPU cores. When N threads call wait(),
 * exactly one thread receives { isLeader: true }, others get { isLeader: false }.
 *
 * This is used to designate a "primary" worker that performs cleanup tasks
 * or aggregations that should only happen once per batch.
 */
export const leaderBarrier = new Barrier(os.cpus().length);
/**
 * Secondary barrier for synchronization phases if needed.
 * Can be used for multi-phase processing where all threads must
 * complete phase 1 before any start phase 2.
 */
export const syncBarrier = new Barrier(os.cpus().length);
// ============================================================================
// Utility Functions
// ============================================================================
/**
 * Gets a snapshot of the current system statistics.
 * Uses async lock acquisition to read consistent state.
 */
export async function getSystemStatsSnapshot() {
    const env_1 = { stack: [], error: void 0, hasError: false };
    try {
        const guard = __addDisposableResource(env_1, await systemStatsMutex.lock(), false);
        // Return a clone to prevent external mutation
        return { ...guard.value };
    }
    catch (e_1) {
        env_1.error = e_1;
        env_1.hasError = true;
    }
    finally {
        __disposeResources(env_1);
    }
}
/**
 * Resets the system statistics to initial values.
 * Useful for benchmarking fresh starts.
 */
export async function resetSystemStats() {
    const env_2 = { stack: [], error: void 0, hasError: false };
    try {
        const guard = __addDisposableResource(env_2, await systemStatsMutex.lock(), false);
        guard.value.totalRequests = 0;
        guard.value.totalComputeTime = 0;
        guard.value.workerTaskCount = {};
        guard.value.lastUpdated = new Date().toISOString();
        guard.value.activeWorkers = 0;
        guard.value.currentLeader = null;
    }
    catch (e_2) {
        env_2.error = e_2;
        env_2.hasError = true;
    }
    finally {
        __disposeResources(env_2);
    }
}
//# sourceMappingURL=shared-state.js.map