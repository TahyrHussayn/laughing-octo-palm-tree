/**
 * Prometheus Metrics Module
 * 
 * Provides comprehensive observability for the multithreading benchmark:
 * - Event loop lag monitoring (high-resolution via perf_hooks)
 * - Request duration tracking (labeled by mode and leader status)
 * - Worker task counting with leader election visibility
 * - Memory usage metrics (cold boot, warmed, active phases)
 * 
 * @module metrics
 */

import { Gauge, Histogram, register } from 'prom-client';
import { monitorEventLoopDelay } from 'node:perf_hooks';

// ============================================================================
// Event Loop Lag Monitoring (High Resolution)
// ============================================================================

/**
 * High-resolution event loop delay histogram from Node.js perf_hooks.
 * Resolution of 10ms provides fine-grained lag detection.
 */
const eventLoopDelay = monitorEventLoopDelay({ resolution: 10 });
eventLoopDelay.enable();

/**
 * Prometheus gauge for event loop lag in seconds.
 * Updated every second from the perf_hooks histogram.
 */
export const eventLoopLagGauge = new Gauge({
  name: 'event_loop_lag_seconds',
  help: 'Event loop lag in seconds (high-resolution)',
});

// Update event loop lag gauge every second
setInterval(() => {
  // Convert nanoseconds to seconds
  eventLoopLagGauge.set(eventLoopDelay.mean / 1e9);
}, 1000);

// ============================================================================
// Request Duration Metrics
// ============================================================================

/**
 * Histogram tracking request duration by execution mode.
 * Labels:
 *   - mode: 'single' (blocking) or 'multi' (worker thread)
 *   - is_leader: 'true' or 'false' (leader election status)
 */
export const requestDuration = new Histogram({
  name: 'request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['mode', 'is_leader'],
  buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10]
});

// ============================================================================
// Worker Task Metrics
// ============================================================================

/**
 * Counter for tasks processed by workers.
 * Label 'is_leader' shows which thread was elected leader via Barrier.
 */
export const workerTaskCount = new Gauge({
  name: 'worker_task_count',
  help: 'Number of tasks processed by worker threads',
  labelNames: ['is_leader']
});

/**
 * Gauge tracking currently active worker threads.
 */
export const activeWorkerThreads = new Gauge({
  name: 'active_worker_threads',
  help: 'Number of currently active worker threads'
});

// ============================================================================
// Memory Metrics
// ============================================================================

/**
 * Memory usage gauge tracking different phases:
 * - type: 'heap_used', 'rss', 'external'
 * - phase: 'cold' (before initRuntime), 'warmed' (after initRuntime), 'active' (during requests)
 */
export const memoryGauge = new Gauge({
  name: 'process_memory_bytes',
  help: 'Process memory usage in bytes',
  labelNames: ['type', 'phase']
});

/**
 * Shared buffer size metric to demonstrate flat memory footprint
 * compared to cloned object overhead.
 */
export const sharedBufferSize = new Gauge({
  name: 'shared_buffer_bytes',
  help: 'Size of shared memory buffers in bytes'
});

/**
 * Worker-specific memory gauge for comparing heap usage.
 */
export const workerMemoryGauge = new Gauge({
  name: 'worker_memory_bytes',
  help: 'Memory usage from worker thread perspective',
  labelNames: ['thread_id', 'type']
});

// ============================================================================
// System Statistics Metrics
// ============================================================================

/**
 * Total number of requests processed across all workers.
 */
export const totalRequestsCounter = new Gauge({
  name: 'total_requests',
  help: 'Total number of requests processed'
});

/**
 * Total compute time accumulated across all workers.
 */
export const totalComputeTime = new Gauge({
  name: 'total_compute_time_ms',
  help: 'Total compute time in milliseconds'
});

// ============================================================================
// Exports
// ============================================================================

export { register };