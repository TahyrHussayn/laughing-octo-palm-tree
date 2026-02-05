#!/bin/bash
# =============================================================================
# Multithreading Benchmark Setup Script for Ubuntu Cloud Instance
# =============================================================================
#
# This script automates the setup of a fresh Ubuntu instance to run the
# multithreading benchmark stack. It installs:
#   - Docker & Docker Compose
#   - pnpm (via npm)
#   - Clones and starts the benchmark stack
#
# Usage:
#   chmod +x setup.sh
#   ./setup.sh
#
# =============================================================================

set -e  # Exit on any error

echo "========================================"
echo "🚀 Multithreading Benchmark Setup"
echo "========================================"

# =============================================================================
# Step 1: System Update
# =============================================================================
echo ""
echo "[1/7] Updating system packages..."
sudo apt-get update -y
sudo apt-get upgrade -y

# =============================================================================
# Step 2: Install Docker
# =============================================================================
echo ""
echo "[2/7] Installing Docker..."

# Remove old versions if present
sudo apt-get remove -y docker docker-engine docker.io containerd runc 2>/dev/null || true

# Install prerequisites
sudo apt-get install -y \
    ca-certificates \
    curl \
    gnupg \
    lsb-release \
    git

# Add Docker's official GPG key
sudo mkdir -p /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg

# Set up Docker repository
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Install Docker Engine
sudo apt-get update -y
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# Start and enable Docker
sudo systemctl start docker
sudo systemctl enable docker

# Add current user to docker group
sudo usermod -aG docker $USER

echo "✅ Docker installed successfully"

# =============================================================================
# Step 3: Install Docker Compose
# =============================================================================
echo ""
echo "[3/7] Installing Docker Compose..."

# Install docker-compose (v2 is included with docker-ce, but let's ensure standalone)
DOCKER_COMPOSE_VERSION=$(curl -s https://api.github.com/repos/docker/compose/releases/latest | grep -Po '"tag_name": "\K.*?(?=")')
sudo curl -L "https://github.com/docker/compose/releases/download/${DOCKER_COMPOSE_VERSION}/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Create symlink for compatibility
sudo ln -sf /usr/local/bin/docker-compose /usr/bin/docker-compose

echo "✅ Docker Compose installed: $(docker-compose --version)"

# =============================================================================
# Step 4: Install Node.js and pnpm
# =============================================================================
echo ""
echo "[4/7] Installing Node.js and pnpm..."

# Install Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install pnpm globally
sudo npm install -g pnpm

echo "✅ Node.js version: $(node --version)"
echo "✅ pnpm version: $(pnpm --version)"

# =============================================================================
# Step 5: Setup Project Directory
# =============================================================================
echo ""
echo "[5/7] Setting up project directory..."

PROJECT_DIR="$HOME/multithreading-benchmark"

if [ -d "$PROJECT_DIR" ]; then
    echo "Project directory exists. Updating..."
    cd "$PROJECT_DIR"
    git pull 2>/dev/null || echo "Not a git repo, skipping pull"
else
    echo "Creating project directory at $PROJECT_DIR"
    mkdir -p "$PROJECT_DIR"
    cd "$PROJECT_DIR"
fi

echo "✅ Project directory ready: $PROJECT_DIR"

# =============================================================================
# Step 6: Build and Start Stack
# =============================================================================
echo ""
echo "[6/7] Building and starting the benchmark stack..."

# If we're in the project directory with docker-compose.yml
if [ -f "docker-compose.yml" ]; then
    echo "Building Docker images (this may take a few minutes)..."
    docker-compose build --no-cache
    
    echo "Starting services..."
    docker-compose up -d
else
    echo "⚠️  docker-compose.yml not found in current directory"
    echo "Please ensure all project files are in: $PROJECT_DIR"
    exit 1
fi

echo "✅ Stack started successfully"

# =============================================================================
# Step 7: Verification
# =============================================================================
echo ""
echo "[7/7] Verifying deployment..."

# Wait for services to start
sleep 5

echo ""
echo "Checking service status..."
docker-compose ps

echo ""
echo "========================================"
echo "✅ Setup Complete!"
echo "========================================"
echo ""
echo "🌐 Access Points:"
echo "   • Benchmark App: http://$(curl -s ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}'):3000"
echo "   • Prometheus:    http://$(curl -s ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}'):9090"
echo "   • Grafana:       http://$(curl -s ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}'):3001"
echo ""
echo "📊 Quick Test Commands:"
echo "   # Single-threaded (blocking):"
echo "   curl 'http://localhost:3000/single?complexity=40'"
echo ""
echo "   # Multi-threaded (non-blocking):"
echo "   curl 'http://localhost:3000/multi?complexity=40'"
echo ""
echo "   # Load test (requires 'autocannon' or 'ab'):"
echo "   # npm install -g autocannon"
echo "   # autocannon -c 50 -d 30 http://localhost:3000/multi?complexity=40"
echo ""
echo "🔧 Management Commands:"
echo "   cd $PROJECT_DIR"
echo "   docker-compose logs -f app      # View app logs"
echo "   docker-compose logs -f prometheus  # View Prometheus logs"
echo "   docker-compose logs -f grafana  # View Grafana logs"
echo "   docker-compose down             # Stop all services"
echo "   docker-compose restart          # Restart services"
echo ""
echo "⚠️  Note: You may need to log out and back in for Docker group changes to take effect."
echo ""
echo "========================================"

# Test endpoints
echo ""
echo "Testing endpoints..."
sleep 2

echo ""
echo "Health check:"
curl -s http://localhost:3000/health | jq . 2>/dev/null || curl -s http://localhost:3000/health

echo ""
echo ""
echo "Metrics endpoint:"
curl -s http://localhost:3000/metrics | head -20