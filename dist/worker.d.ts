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
import { Mutex, SharedJsonBuffer, Barrier } from 'multithreading';
import type { SystemStats } from './shared-state.js';
/**
 * Result returned from a worker task.
 */
export interface WorkerResult {
    /** Fibonacci calculation result */
    result: number;
    /** Time spent computing (milliseconds) */
    computeTime: number;
    /** Whether this worker was elected leader */
    isLeader: boolean;
    /** Worker thread heap usage */
    workerMemory: number;
    /** Size of transferred payload */
    payloadSize: number;
    /** Worker identifier from payload */
    workerId: string;
}
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
export declare function createWorkerTask(complexity: number, payload: Uint8Array, statsMutex: Mutex<SharedJsonBuffer<SystemStats>>, barrier: Barrier): import("multithreading").JoinHandle<WorkerResult>;
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
export declare function createWorkerBatch(count: number, complexity: number, payloadSize: number, statsMutex: Mutex<SharedJsonBuffer<SystemStats>>, barrier: Barrier): import("multithreading").JoinHandle<WorkerResult>[];
//# sourceMappingURL=worker.d.ts.map