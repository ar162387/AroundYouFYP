#!/usr/bin/env bash
set -euo pipefail

# Pull the current VPS self-signed certificate into Android resources.
# Usage:
#   ./scripts/sync-vps-cert.sh [user@host] [ssh_key_path]
# Example:
#   ./scripts/sync-vps-cert.sh ubuntu@193.123.68.165 ./aroundyou-ssh-oracle-priv.key

TARGET="${1:-ubuntu@193.123.68.165}"
KEY_PATH="${2:-./aroundyou-ssh-oracle-priv.key}"
OUT_FILE="android/app/src/main/res/raw/ay_backend_cert.pem"

echo "Syncing certificate from ${TARGET}..."
ssh -i "${KEY_PATH}" "${TARGET}" "sudo cat /etc/ssl/ay/ay-selfsigned.crt" > "${OUT_FILE}"

echo "Saved certificate to ${OUT_FILE}"
echo "Next: rebuild Android app so new cert is bundled."
