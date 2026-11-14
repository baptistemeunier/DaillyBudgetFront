#!/usr/bin/env bash
# Push the project files to the VM (no build, no restart).
#   bin/deploy.sh
# Env overrides: VM (ssh host, default deploy@192.168.50.12), VM_DIR (default /var/www/daily-budget-front).
set -euo pipefail

cd "$(dirname "$0")/.."
VM=${VM:-deploy@192.168.50.12}
VM_DIR=${VM_DIR:-/var/www/daily-budget-front}

rsync -az --delete --info=stats1 \
  --exclude .git/ \
  --exclude node_modules/ \
  --exclude .nuxt/ \
  --exclude .output/ \
  --exclude .data/ \
  --exclude .idea/ \
  --exclude .claude/ \
  --exclude /.env \
  ./ "$VM:$VM_DIR/"

echo "==> Files pushed to $VM:$VM_DIR"
