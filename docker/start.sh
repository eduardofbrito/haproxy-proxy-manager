#!/bin/bash
# Start HAProxy Proxy Manager
# Requires: Docker, Docker Compose
# Usage: ./start.sh

set -e

# Configuration
IMAGE="eduardofbrito/haproxy-proxy-manager:latest"
CONTAINER_NAME="haproxy-proxy-manager"
DATA_DIR="/opt/npm-data"
LETS_ENCRYPT_DIR="/opt/npm-letsencrypt"
TZ="${TZ:-America/Sao_Paulo}"

echo "================================"
echo "HAProxy Proxy Manager"
echo "================================"

# Create data directories if they don't exist
echo "Creating data directories..."
mkdir -p "$DATA_DIR"
mkdir -p "$LETS_ENCRYPT_DIR"

# Pull latest image
echo "Pulling latest image..."
docker pull "$IMAGE"

# Start container
echo "Starting container..."
docker run -d \
    --name "$CONTAINER_NAME" \
    --restart always \
    --network host \
    -e "TZ=$TZ" \
    -v "$DATA_DIR:/data" \
    -v "$LETS_ENCRYPT_DIR:/etc/letsencrypt" \
    "$IMAGE"

echo "================================"
echo "Container started!"
echo "Admin UI: http://localhost:81"
echo "================================"
echo "To stop: docker stop $CONTAINER_NAME"
echo "To restart: docker restart $CONTAINER_NAME"
echo "To view logs: docker logs -f $CONTAINER_NAME"
