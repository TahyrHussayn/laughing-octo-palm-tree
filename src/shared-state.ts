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

import { Mutex, SharedJsonBuffer, Barrier } from 'multithreading';
import os from 'os';

// ============================================================================
// Type Definitions
// ============================================================================

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

// ============================================================================
// Initial State
// ============================================================================

/**
 * Initial state for the shared statistics buffer.
 */
const initialStats: SystemStats = {
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
export const systemStatsMutex: any = new Mutex(new SharedJsonBuffer(initialStats));

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
export async function getSystemStatsSnapshot(): Promise<SystemStats> {
  using guard = await systemStatsMutex.lock();
  // Return a clone to prevent external mutation
  return { ...guard.value };
}

/**
 * Resets the system statistics to initial values.
 * Useful for benchmarking fresh starts.
 */
export async function resetSystemStats(): Promise<void> {
  using guard = await systemStatsMutex.lock();
  guard.value.totalRequests = 0;
  guard.value.totalComputeTime = 0;
  guard.value.workerTaskCount = {};
  guard.value.lastUpdated = new Date().toISOString();
  guard.value.activeWorkers = 0;
  guard.value.currentLeader = null;
}