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
import './polyfills.js'; // Enable 'using' syntax
import express from 'express';
import { initRuntime } from 'multithreading';
import os from 'os';
import { register, requestDuration, workerTaskCount, activeWorkerThreads, memoryGauge, sharedBufferSize, workerMemoryGauge, totalRequestsCounter, totalComputeTime } from './metrics.js';
import { systemStatsMutex, leaderBarrier, getSystemStatsSnapshot } from './shared-state.js';
import { createWorkerTask } from './worker.js';
// ============================================================================
// Express App Setup
// ============================================================================
const app = express();
const PORT = process.env.PORT || 3000;
// ============================================================================
// COLD BOOT MEMORY BASELINE
// ============================================================================
// Capture memory BEFORE initializing the thread pool
// This allows measuring the exact RAM cost of pre-allocation
const coldBootMemory = process.memoryUsage();
memoryGauge.labels('heap_used', 'cold').set(coldBootMemory.heapUsed);
memoryGauge.labels('rss', 'cold').set(coldBootMemory.rss);
memoryGauge.labels('external', 'cold').set(coldBootMemory.external || 0);
console.log(`[BOOT] Cold boot memory captured: ${(coldBootMemory.heapUsed / 1024 / 1024).toFixed(2)} MB heap`);
// ============================================================================
// PRE-WARM: Initialize Thread Pool
// ============================================================================
// initRuntime() pre-allocates worker threads to eliminate cold-start latency
// during benchmark runs. This ensures consistent performance from the first request.
const POOL_SIZE = os.cpus().length;
initRuntime({ maxWorkers: POOL_SIZE });
console.log(`[BOOT] Thread pool initialized with ${POOL_SIZE} workers`);
// ============================================================================
// WARMED MEMORY BASELINE
// ============================================================================
// Capture memory AFTER thread pool initialization
// Delta shows the exact cost of worker thread pre-allocation
const warmedMemory = process.memoryUsage();
memoryGauge.labels('heap_used', 'warmed').set(warmedMemory.heapUsed);
memoryGauge.labels('rss', 'warmed').set(warmedMemory.rss);
memoryGauge.labels('external', 'warmed').set(warmedMemory.external || 0);
const memoryDeltaMB = (warmedMemory.heapUsed - coldBootMemory.heapUsed) / 1024 / 1024;
console.log(`[BOOT] Warmed memory: ${(warmedMemory.heapUsed / 1024 / 1024).toFixed(2)} MB heap`);
console.log(`[BOOT] Thread pool memory cost: ${memoryDeltaMB.toFixed(2)} MB`);
// ============================================================================
// SECURITY HEADERS MIDDLEWARE (COOP/COEP)
// ============================================================================
// SharedArrayBuffer requires cross-origin isolation headers.
// These headers must be set on ALL responses.
app.use((req, res, next) => {
    // Cross-Origin Opener Policy: isolate from cross-origin windows
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    // Cross-Origin Embedder Policy: require corp for embedded resources
    res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
    next();
});
// Enable JSON parsing
app.use(express.json());
// ============================================================================
// ENDPOINT: Single-threaded (Blocking)
// ============================================================================
/**
 * GET /single?complexity=42
 *
 * Performs CPU-intensive Fibonacci calculation on the MAIN THREAD.
 * This BLOCKS the event loop and demonstrates poor concurrency.
 *
 * Query params:
 *   - complexity: Fibonacci number to calculate (default: 42)
 */
app.get('/single', async (req, res) => {
    const end = requestDuration.startTimer();
    const complexity = parseInt(req.query.complexity) || 42;
    try {
        // This runs on the main thread - BLOCKS event loop!
        const fibonacci = (n) => {
            if (n < 2)
                return n;
            return fibonacci(n - 1) + fibonacci(n - 2);
        };
        const startTime = performance.now();
        const result = fibonacci(complexity);
        const computeTime = performance.now() - startTime;
        // Track main thread memory during active computation
        const activeMemory = process.memoryUsage();
        memoryGauge.labels('heap_used', 'active').set(activeMemory.heapUsed);
        memoryGauge.labels('rss', 'active').set(activeMemory.rss);
        // Record metrics (main thread is always "leader" in single-threaded mode)
        end({ mode: 'single', is_leader: 'true' });
        totalRequestsCounter.inc();
        totalComputeTime.set(computeTime);
        res.json({
            mode: 'single',
            result,
            complexity,
            computeTime: `${computeTime.toFixed(2)}ms`,
            memoryUsed: `${(activeMemory.heapUsed / 1024 / 1024).toFixed(2)} MB`,
            eventLoopBlocked: true,
            warning: 'This endpoint blocks the event loop!'
        });
    }
    catch (error) {
        end({ mode: 'single', is_leader: 'true' });
        res.status(500).json({ error: String(error) });
    }
});
// ============================================================================
// ENDPOINT: Multi-threaded (Non-blocking)
// ============================================================================
/**
 * GET /multi?complexity=42
 *
 * Offloads CPU-intensive task to a WORKER THREAD via spawn().
 * This does NOT block the event loop, allowing concurrent request handling.
 *
 * Features demonstrated:
 * - Zero-copy Uint8Array transfer via move()
 * - Async Mutex synchronization (non-blocking)
 * - Leader election via Barrier.wait()
 * - SharedJsonBuffer state updates
 *
 * Query params:
 *   - complexity: Fibonacci number to calculate (default: 42)
 */
app.get('/multi', async (req, res) => {
    const end = requestDuration.startTimer();
    const complexity = parseInt(req.query.complexity) || 42;
    try {
        // Create a 10MB Uint8Array payload for zero-copy transfer demonstration
        const payloadSize = 10 * 1024 * 1024; // 10 MB
        const payload = new Uint8Array(payloadSize);
        // Set unique identifier for this worker in the first byte
        payload[0] = Math.floor(Math.random() * 256);
        // Track shared buffer size metric
        sharedBufferSize.set(payloadSize);
        // Increment active worker gauge
        activeWorkerThreads.inc();
        // Spawn worker with move() for zero-copy payload transfer
        // The payload is TRANSFERRED (not cloned) to the worker thread
        const handle = createWorkerTask(complexity, payload, systemStatsMutex, leaderBarrier);
        // Wait for worker completion (non-blocking - event loop continues)
        const workerResult = await handle.join();
        // Decrement active worker gauge
        activeWorkerThreads.dec();
        if (!workerResult.ok) {
            throw new Error(`Worker error: ${workerResult.error}`);
        }
        const { result, computeTime, isLeader, workerMemory, payloadSize: transferred, workerId } = workerResult.value;
        // Update Prometheus metrics with leader status
        workerTaskCount.labels(isLeader ? 'true' : 'false').inc();
        workerMemoryGauge.labels(workerId, 'heap_used').set(workerMemory);
        end({ mode: 'multi', is_leader: isLeader ? 'true' : 'false' });
        res.json({
            mode: 'multi',
            result,
            complexity,
            computeTime: `${computeTime.toFixed(2)}ms`,
            isLeader,
            workerId,
            payloadTransferred: `${(transferred / 1024 / 1024).toFixed(2)} MB (zero-copy via move())`,
            workerMemory: `${(workerMemory / 1024 / 1024).toFixed(2)} MB`,
            eventLoopBlocked: false,
            note: 'This endpoint uses worker threads - event loop remains responsive'
        });
    }
    catch (error) {
        activeWorkerThreads.dec();
        end({ mode: 'multi', is_leader: 'false' });
        res.status(500).json({ error: String(error) });
    }
});
// ============================================================================
// ENDPOINT: Prometheus Metrics
// ============================================================================
/**
 * GET /metrics
 *
 * Prometheus metrics endpoint for scraping.
 * Includes event_loop_lag, request_duration, worker_task_count, memory metrics.
 */
app.get('/metrics', async (req, res) => {
    try {
        res.set('Content-Type', register.contentType);
        res.end(await register.metrics());
    }
    catch (error) {
        res.status(500).json({ error: String(error) });
    }
});
// ============================================================================
// ENDPOINT: Health Check
// ============================================================================
/**
 * GET /health
 *
 * Health check endpoint with system information.
 * Shows memory baselines and thread pool status.
 */
app.get('/health', async (req, res) => {
    const stats = await getSystemStatsSnapshot();
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        threadPool: {
            size: POOL_SIZE,
            status: 'initialized'
        },
        memory: {
            coldBootHeapMB: (coldBootMemory.heapUsed / 1024 / 1024).toFixed(2),
            warmedHeapMB: (warmedMemory.heapUsed / 1024 / 1024).toFixed(2),
            deltaMB: memoryDeltaMB.toFixed(2),
            currentHeapMB: (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)
        },
        systemStats: stats,
        endpoints: {
            single: '/single?complexity=42',
            multi: '/multi?complexity=42',
            metrics: '/metrics',
            health: '/health'
        }
    });
});
// ============================================================================
// Server Startup
// ============================================================================
app.listen(PORT, () => {
    console.log(`\n========================================`);
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`========================================`);
    console.log(`Endpoints:`);
    console.log(`  • GET /single?complexity=42  - Blocking (main thread)`);
    console.log(`  • GET /multi?complexity=42   - Non-blocking (worker thread)`);
    console.log(`  • GET /metrics               - Prometheus metrics`);
    console.log(`  • GET /health                - Health check`);
    console.log(`========================================\n`);
});
//# sourceMappingURL=server.js.map