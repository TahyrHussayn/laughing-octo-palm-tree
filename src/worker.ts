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

import { spawn, move, Mutex, SharedJsonBuffer, Barrier } from 'multithreading';
import type { SystemStats } from './shared-state.js';

// ============================================================================
// Types
// ============================================================================

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
export function createWorkerTask(
  complexity: number,
  payload: Uint8Array,
  statsMutex: Mutex<SharedJsonBuffer<SystemStats>>,
  barrier: Barrier
) {
  // IMPORTANT: All logic inside spawn() must be self-contained!
  // No external references - everything defined inside the function
  return spawn(
    move(complexity, payload, statsMutex, barrier),
    async (n: number, data: Uint8Array, stats: Mutex<SharedJsonBuffer<SystemStats>>, bar: Barrier) => {
      
      // =====================================================================
      // SELF-CONTAINED FIBONACCI IMPLEMENTATION
      // =====================================================================
      // Must be defined INSIDE the spawn function - external refs will fail!
      
      const fibonacci = (num: number): number => {
        if (num < 2) return num;
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
      
      using guard = await stats.lock();
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
      } as WorkerResult;
    }
  );
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
export function createWorkerBatch(
  count: number,
  complexity: number,
  payloadSize: number,
  statsMutex: Mutex<SharedJsonBuffer<SystemStats>>,
  barrier: Barrier
) {
  const handles = [];
  
  for (let i = 0; i < count; i++) {
    // Create payload with unique identifier for each worker
    const payload = new Uint8Array(payloadSize);
    payload[0] = i; // Worker index as identifier
    
    handles.push(createWorkerTask(complexity, payload, statsMutex, barrier));
  }
  
  return handles;
}