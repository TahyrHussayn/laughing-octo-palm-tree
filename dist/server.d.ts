/**
 * Express Server for Multithreading Benchmark
 *
 * Provides endpoints for comparing single-threaded vs multi-threaded execution:
 * - GET /single?complexity=42 - Blocking CPU task on main thread
 * - GET /multi?complexity=42 - Non-blocking task via worker threads
 * - GET /metrics - Prometheus metrics endpoint
 * - GET /health - Health check with memory baselines
 *
 * Security:
 * - COOP/COEP headers for SharedArrayBuffer support
 *
 * Performance:
 * - initRuntime() pre-warms thread pool
 * - Cold/warmed memory baselines
 * - Event loop lag monitoring
 *
 * @module server
 */
import './polyfills.js';
//# sourceMappingURL=server.d.ts.map