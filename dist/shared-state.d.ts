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
import { Barrier } from 'multithreading';
/**
 * System-wide statistics tracked in shared memory.
 * This state is accessible and modifiable by all worker threads.
 */
export interface SystemStats {
    /** Total number of requests processed across all workers */
    totalRequests: number;
    /** Total compute time accumulated (milliseconds) */
    totalComputeTime: number;
    /** Per-worker task count tracking */
    workerTaskCount: Record<string, number>;
    /** ISO timestamp of last update */
    lastUpdated: string | null;
    /** Currently active worker count */
    activeWorkers: number;
    /** Leader worker ID for current cycle */
    currentLeader: string | null;
}
/**
 * SharedJsonBuffer wrapped in Mutex for thread-safe access.
 *
 * The SharedJsonBuffer provides efficient JSON state sharing with Proxy-based
 * partial updates - only changed bytes are reserialized, not the entire object.
 *
 * The Mutex ensures only one thread can modify the state at a time.
 * Use 'using guard = await systemStatsMutex.lock()' for automatic unlock.
 */
export declare const systemStatsMutex: any;
/**
 * Barrier for leader election among worker threads.
 *
 * Size is set to the number of CPU cores. When N threads call wait(),
 * exactly one thread receives { isLeader: true }, others get { isLeader: false }.
 *
 * This is used to designate a "primary" worker that performs cleanup tasks
 * or aggregations that should only happen once per batch.
 */
export declare const leaderBarrier: Barrier;
/**
 * Secondary barrier for synchronization phases if needed.
 * Can be used for multi-phase processing where all threads must
 * complete phase 1 before any start phase 2.
 */
export declare const syncBarrier: Barrier;
/**
 * Gets a snapshot of the current system statistics.
 * Uses async lock acquisition to read consistent state.
 */
export declare function getSystemStatsSnapshot(): Promise<SystemStats>;
/**
 * Resets the system statistics to initial values.
 * Useful for benchmarking fresh starts.
 */
export declare function resetSystemStats(): Promise<void>;
//# sourceMappingURL=shared-state.d.ts.map