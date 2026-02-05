# Multithreading Benchmark

A high-concurrency benchmarking project comparing the W4G1/multithreading library against standard single-threaded execution.

## Architecture Overview

This project demonstrates advanced multithreading patterns in Node.js using the W4G1/multithreading library:

- **Spawn/Move Pattern**: Zero-copy data transfer to worker threads
- **SharedJsonBuffer**: Mutex-protected shared state with partial update optimization
- **Barrier Leader Election**: Exactly one thread per cycle designated as "leader"
- **Async Synchronization**: Non-blocking lock acquisition with `using` syntax

## Project Structure

```
multithreading-benchmark/
├── src/
│   ├── server.ts          # Express server with endpoints
│   ├── worker.ts          # Self-contained worker functions
│   ├── shared-state.ts    # SharedJsonBuffer + Mutex + Barrier
│   ├── metrics.ts         # Prometheus metrics (event loop lag, etc.)
│   └── polyfills.ts       # Disposable stack polyfill
├── config/
│   ├── prometheus.yml     # Prometheus scrape config
│   ├── grafana-dashboard.json  # Embedded dashboard
│   └── grafana-provisioning/   # Auto-provisioning configs
├── docker/
│   └── Dockerfile         # Multi-stage pnpm build
├── docker-compose.yml     # App + Prometheus + Grafana
├── setup.sh               # Ubuntu cloud instance bootstrap
├── package.json
├── tsconfig.json
└── pnpm-lock.yaml
```

## Quick Start

### Local Development

```bash
# Install dependencies
pnpm install

# Build TypeScript
pnpm run build

# Start server
pnpm start
```

### Docker Deployment

```bash
# Build and start all services
docker-compose up -d

# View logs
docker-compose logs -f app
```

### Cloud Instance Setup

```bash
# On a fresh Ubuntu instance
git clone <repo-url>
cd multithreading-benchmark
chmod +x setup.sh
./setup.sh
```

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /single?complexity=42` | Blocking Fibonacci on main thread |
| `GET /multi?complexity=42` | Non-blocking via worker threads |
| `GET /metrics` | Prometheus metrics |
| `GET /health` | Health check with memory baselines |

## Monitoring

- **Prometheus**: http://localhost:9090
- **Grafana**: http://localhost:3001 (admin/admin)

## Key Metrics

- `event_loop_lag_seconds`: High-resolution event loop delay
- `request_duration_seconds{mode,is_leader}`: Request latency by mode
- `worker_task_count{is_leader}`: Tasks processed (with leader visibility)
- `process_memory_bytes{type,phase}`: Memory baselines (cold/warmed/active)
- `shared_buffer_bytes`: Shared memory footprint

## License

MIT