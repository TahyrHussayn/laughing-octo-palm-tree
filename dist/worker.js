/**
 * Worker Module
 *
 * Provides self-contained worker functions for the multithreading benchmark.
 *
 * CRITICAL: All functions passed to spawn() must be ENTIRELY SELF-CONTAINED.
 * Any external references will cause "Function not defined" errors during
 * worker serialization. All dependencies must be defined INSIDE the spawn function.
 *
 * Features:
 * - Self-contained Fibonacci calculation (no external deps)
 * - Zero-copy Uint8Array transfer via move()
 * - Async Mutex lock (non-blocking worker threads)
 * - Leader election via Barrier.wait()
 * - SharedJsonBuffer state updates
 *
 * @module worker
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
import { spawn, move } from 'multithreading';
// ============================================================================
// Worker Factory
// ============================================================================
/**
 * Creates a worker task for processing CPU-intensive Fibonacci calculations.
 *
 * This function demonstrates:
 * 1. Self-contained worker logic (ALL code inside spawn)
 * 2. Zero-copy data transfer via move()
 * 3. Async synchronization with Mutex (non-blocking)
 * 4. Leader election via Barrier.wait()
 * 5. SharedJsonBuffer state updates
 *
 * @param complexity - Fibonacci number to calculate (n)
 * @param payload - Large Uint8Array for zero-copy transfer demonstration
 * @param statsMutex - Shared statistics protected by Mutex
 * @param barrier - Barrier for leader election
 * @returns Handle to await the worker result
 */
export function createWorkerTask(complexity, payload, statsMutex, barrier) {
    // IMPORTANT: All logic inside spawn() must be self-contained!
    // No external references - everything defined inside the function
    return spawn(move(complexity, payload, statsMutex, barrier), async (n, data, stats, bar) => {
        const env_1 = { stack: [], error: void 0, hasError: false };
        try {
            // =====================================================================
            // SELF-CONTAINED FIBONACCI IMPLEMENTATION
            // =====================================================================
            // Must be defined INSIDE the spawn function - external refs will fail!
            const fibonacci = (num) => {
                if (num < 2)
                    return num;
                return fibonacci(num - 1) + fibonacci(num - 2);
            };
            // Generate unique worker ID from payload
            const workerId = `worker-${data[0]}-${Date.now() % 10000}`;
            // Record memory before computation
            const memBefore = process.memoryUsage().heapUsed;
            // =====================================================================
            // CPU-INTENSIVE CALCULATION
            // =====================================================================
            const startTime = performance.now();
            const result = fibonacci(n);
            const computeTime = performance.now() - startTime;
            // Record memory after computation
            const memAfter = process.memoryUsage().heapUsed;
            const workerMemory = memAfter;
            // =====================================================================
            // ASYNC SYNCHRONIZATION (Non-blocking)
            // =====================================================================
            // Using 'await stats.lock()' allows the worker thread to yield
            // while waiting for the lock, preventing complete thread halt.
            // The 'using' syntax ensures automatic unlock via disposablestack.
            const guard = __addDisposableResource(env_1, await stats.lock(), false);
            const state = guard.value;
            // Update shared statistics
            state.totalRequests++;
            state.totalComputeTime += computeTime;
            state.activeWorkers++;
            state.lastUpdated = new Date().toISOString();
            // Track per-worker statistics
            if (!state.workerTaskCount[workerId]) {
                state.workerTaskCount[workerId] = 0;
            }
            state.workerTaskCount[workerId]++;
            // =====================================================================
            // LEADER ELECTION VIA BARRIER
            // =====================================================================
            // Barrier.wait() returns { isLeader: boolean }
            // Exactly one thread per cycle is elected leader.
            // This is useful for single-threaded tasks like aggregation or cleanup.
            const { isLeader } = await bar.wait();
            if (isLeader) {
                // Leader performs exclusive tasks
                state.currentLeader = workerId;
                // Example leader task: reset active worker counter for next batch
                state.activeWorkers = 0;
                // Leader could perform aggregation, logging, or cleanup here
                // This only executes on ONE thread per barrier cycle
            }
            // Lock automatically released here via 'using' disposal
            // =====================================================================
            // RETURN RESULT
            // =====================================================================
            return {
                result,
                computeTime,
                isLeader,
                workerMemory,
                payloadSize: data.byteLength,
                workerId
            };
        }
        catch (e_1) {
            env_1.error = e_1;
            env_1.hasError = true;
        }
        finally {
            __disposeResources(env_1);
        }
    });
}
// ============================================================================
// Batch Worker Processing
// ============================================================================
/**
 * Creates multiple worker tasks for parallel processing.
 * Demonstrates how to spawn N workers simultaneously.
 *
 * @param count - Number of workers to spawn
 * @param complexity - Fibonacci complexity for each worker
 * @param payloadSize - Size of payload array for each worker (bytes)
 * @param statsMutex - Shared statistics mutex
 * @param barrier - Leader election barrier
 * @returns Array of worker handles
 */
export function createWorkerBatch(count, complexity, payloadSize, statsMutex, barrier) {
    const handles = [];
    for (let i = 0; i < count; i++) {
        // Create payload with unique identifier for each worker
        const payload = new Uint8Array(payloadSize);
        payload[0] = i; // Worker index as identifier
        handles.push(createWorkerTask(complexity, payload, statsMutex, barrier));
    }
    return handles;
}
//# sourceMappingURL=worker.js.map