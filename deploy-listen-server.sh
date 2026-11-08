#!/bin/bash
# Build & deploy the listen-server to the local machine (assumes this runs on the VPS).
set -euo pipefail

REPO_DIR="$(cd "$(dirname "$0")" && pwd)"
TARGET_DIR=/var/www/listen-server
ENV_FILE=/etc/listen-server.env

if [ ! -f "$ENV_FILE" ]; then
    echo "Missing $ENV_FILE. Create it from server/.env.example (mode 600)." >&2
    exit 1
fi

sudo mkdir -p "$TARGET_DIR"
sudo rsync -a --delete \
    --exclude node_modules \
    --exclude .env \
    "$REPO_DIR/server/" "$TARGET_DIR/"

cd "$TARGET_DIR"
sudo npm ci --omit=dev

sudo cp "$REPO_DIR/server/listen-server.service" /etc/systemd/system/listen-server.service
sudo systemctl daemon-reload
sudo systemctl enable listen-server
sudo systemctl restart listen-server

echo "Deployed. Status:"
sudo systemctl --no-pager status listen-server | head -n 5
