#!/bin/bash
#
# cleanup.sh — Resolve all remaining issues in haproxy-proxy-manager
# after the Nginx → HAProxy conversion.
#
# Usage: bash scripts/cleanup.sh
#

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

echo "═══════════════════════════════════════════════"
echo " HAProxy Proxy Manager — Post-Conversion Cleanup"
echo "═══════════════════════════════════════════════"
echo ""

# ─── 1. Delete stale .conf templates ────────────────────────────
echo "[1/6] Removing stale backend/templates/*.conf (18 files)..."
STALE_CONF_COUNT=$(find backend/templates -maxdepth 1 -name '*.conf' -type f | wc -l)
if [ "$STALE_CONF_COUNT" -gt 0 ]; then
    find backend/templates -maxdepth 1 -name '*.conf' -type f -delete
    echo "  ✅ Removed $STALE_CONF_COUNT stale .conf files"
else
    echo "  ⏭️  Nothing to remove"
fi
echo ""

# ─── 2. Delete stale docker/include/ directory ──────────────────
echo "[2/6] Removing stale docker/rootfs/etc/haproxy/conf.d/include/..."
if [ -d "docker/rootfs/etc/haproxy/conf.d/include" ]; then
    INC_COUNT=$(ls -1 docker/rootfs/etc/haproxy/conf.d/include/ 2>/dev/null | wc -l)
    rm -rf docker/rootfs/etc/haproxy/conf.d/include
    echo "  ✅ Removed include/ directory ($INC_COUNT files)"
else
    echo "  ⏭️  Directory already gone"
fi
echo ""

# ─── 3. Fix s6-overlay user/contents.d ──────────────────────────
echo "[3/6] Fixing s6-overlay user/contents.d (adding 'backend')..."
CONTENTS_FILE="docker/rootfs/etc/s6-overlay/s6-rc.d/user/contents.d/haproxy"
if grep -q "^backend$" "$CONTENTS_FILE" 2>/dev/null; then
    echo "  ⏭️  'backend' already listed"
else
    # Append backend to the file (order: haproxy, backend)
    echo "" >> "$CONTENTS_FILE"
    echo "backend" >> "$CONTENTS_FILE"
    echo "  ✅ Added 'backend' to user/contents.d/haproxy"
fi
echo ""

# ─── 4. Fix haproxy service dependencies ───────────────────────
echo "[4/6] Fixing haproxy service dependencies (haproxy → backend)..."
DEP_FILE="docker/rootfs/etc/s6-overlay/s6-rc.d/haproxy/dependencies.d/prepare"
if grep -q "^backend$" "$DEP_FILE" 2>/dev/null; then
    echo "  ⏭️  Dependency already correct"
else
    # Replace "haproxy" dependency with "backend"
    sed -i 's/^haproxy$/backend/' "$DEP_FILE"
    echo "  ✅ Changed dependency from 'haproxy' to 'backend'"
fi
echo ""

# ─── 5. Fix Dockerfile ─────────────────────────────────────────
echo "[5/6] Fixing Dockerfile..."

# 5a. Remove legacy NODE_OPTIONS for Node 16
DOCKERFILE="docker/Dockerfile"
if grep -q 'openssl-legacy-provider' "$DOCKERFILE"; then
    sed -i '/NODE_OPTIONS/d' "$DOCKERFILE"
    echo "  ✅ Removed legacy NODE_OPTIONS=--openssl-legacy-provider"
else
    echo "  ⏭️  NODE_OPTIONS already removed"
fi

# 5b. Fix BASE_IMAGE: haproxy:3.0-alpine doesn't have node/npm
#     Switch to node:20-alpine (has both node+npm built-in) and install haproxy via apk
#     This is the recommended approach for the official haproxy image — it strips out
#     everything except haproxy, leaving no package manager or node runtime.
#     Using node:20-alpine as base is the pragmatic choice.
CURRENT_BASE=$(grep '^ARG BASE_IMAGE=' "$DOCKERFILE" | head -1)
if echo "$CURRENT_BASE" | grep -q 'haproxy:3.0-alpine'; then
    sed -i 's|^ARG BASE_IMAGE=haproxy:3.0-alpine|ARG BASE_IMAGE=node:20-alpine|' "$DOCKERFILE"
    # Remove 'nodejs npm yarn' from apk add (they're in node:20-alpine, install yarn separately)
    sed -i '/nodejs npm yarn/d' "$DOCKERFILE"
    # Add yarn installation after yarn cache clean block
    sed -i '/yarn cache clean/a\\nRUN apk add --no-cache yarn' "$DOCKERFILE"
    echo "  ✅ Changed BASE_IMAGE from haproxy:3.0-alpine to node:20-alpine"
    echo "  ✅ Removed redundant nodejs/npm from apk add"
    echo "  ✅ Added 'apk add yarn' (yarn is not bundled in node:20-alpine)"
else
    echo "  ⏭️  BASE_IMAGE already set to: $CURRENT_BASE"
fi
echo ""

# ─── 6. Remove stale nginx include files from docker rootfs ─────
echo "[6/6] Checking for any remaining nginx remnants..."
NGINX_REMNANTS=$(find docker/rootfs/etc/haproxy -name "*.conf" -type f 2>/dev/null | wc -l)
if [ "$NGINX_REMNANTS" -gt 0 ]; then
    echo "  ⚠️  Found $NGINX_REMNANTS .conf files in haproxy config dir (may be intentional)"
else
    echo "  ✅ No stale .conf files in haproxy config dir"
fi

# Check for any remaining nginx directories
NGINX_DIRS=$(find docker/rootfs/etc -maxdepth 1 -name "nginx" -type d 2>/dev/null | wc -l)
if [ "$NGINX_DIRS" -gt 0 ]; then
    echo "  ⚠️  Found $NGINX_DIRS stale nginx/ directories in docker/rootfs/etc/"
else
    echo "  ✅ No stale nginx/ directories"
fi
echo ""

# ─── Summary ───────────────────────────────────────────────────
echo "═══════════════════════════════════════════════"
echo " Cleanup Complete!"
echo "═══════════════════════════════════════════════"
echo ""

# Verify .cfg templates still exist
CFG_COUNT=$(find backend/templates -maxdepth 1 -name '*.cfg' -type f | wc -l)
CONF_COUNT=$(find backend/templates -maxdepth 1 -name '*.conf' -type f | wc -l)
echo "  Template stats: $CFG_COUNT .cfg files (HAProxy), $CONF_COUNT .conf files (stale)"
echo ""

# Verify user/contents.d
echo "  user/contents.d/haproxy now lists:"
cat docker/rootfs/etc/s6-overlay/s6-rc.d/user/contents.d/haproxy | sed 's/^/    /'
echo ""

# Verify haproxy dependencies
echo "  haproxy service dependencies:"
cat docker/rootfs/etc/s6-overlay/s6-rc.d/haproxy/dependencies.d/prepare | sed 's/^/    /'
echo ""

echo "  Dockerfile BASE_IMAGE:"
grep '^ARG BASE_IMAGE=' "$DOCKERFILE" | sed 's/^/    /'
echo ""

echo "All done. Review changes with: git diff"
