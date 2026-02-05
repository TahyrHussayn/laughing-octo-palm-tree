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
/**
 * Prometheus gauge for event loop lag in seconds.
 * Updated every second from the perf_hooks histogram.
 */
export declare const eventLoopLagGauge: Gauge<string>;
/**
 * Histogram tracking request duration by execution mode.
 * Labels:
 *   - mode: 'single' (blocking) or 'multi' (worker thread)
 *   - is_leader: 'true' or 'false' (leader election status)
 */
export declare const requestDuration: Histogram<"mode" | "is_leader">;
/**
 * Counter for tasks processed by workers.
 * Label 'is_leader' shows which thread was elected leader via Barrier.
 */
export declare const workerTaskCount: Gauge<"is_leader">;
/**
 * Gauge tracking currently active worker threads.
 */
export declare const activeWorkerThreads: Gauge<string>;
/**
 * Memory usage gauge tracking different phases:
 * - type: 'heap_used', 'rss', 'external'
 * - phase: 'cold' (before initRuntime), 'warmed' (after initRuntime), 'active' (during requests)
 */
export declare const memoryGauge: Gauge<"type" | "phase">;
/**
 * Shared buffer size metric to demonstrate flat memory footprint
 * compared to cloned object overhead.
 */
export declare const sharedBufferSize: Gauge<string>;
/**
 * Worker-specific memory gauge for comparing heap usage.
 */
export declare const workerMemoryGauge: Gauge<"type" | "thread_id">;
/**
 * Total number of requests processed across all workers.
 */
export declare const totalRequestsCounter: Gauge<string>;
/**
 * Total compute time accumulated across all workers.
 */
export declare const totalComputeTime: Gauge<string>;
export { register };
//# sourceMappingURL=metrics.d.ts.map