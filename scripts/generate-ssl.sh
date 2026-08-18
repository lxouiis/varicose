#!/bin/bash
# ══════════════════════════════════════════════════════════════════════════════
# Generate Self-Signed SSL Certificate for Hospital Intranet Deployment
#
# Usage:
#   bash scripts/generate-ssl.sh 192.168.1.100 cevi.hospital.local
# ══════════════════════════════════════════════════════════════════════════════

set -e

SERVER_IP="${1:-192.168.1.100}"
DOMAIN="${2:-cevi.hospital.local}"

CERTS_DIR="$(pwd)/nginx/certs"
mkdir -p "$CERTS_DIR"

echo "Generating SSL Certificate for IP: $SERVER_IP, Domain: $DOMAIN..."

openssl req -x509 -nodes -days 3650 -newkey rsa:2048 \
  -keyout "$CERTS_DIR/server.key" \
  -out "$CERTS_DIR/server.crt" \
  -subj "/C=IN/ST=Karnataka/L=Belagavi/O=JNMC Hospital/OU=Interventional Radiology/CN=$DOMAIN" \
  -addext "subjectAltName = IP:$SERVER_IP,DNS:$DOMAIN,DNS:localhost"

chmod 600 "$CERTS_DIR/server.key"
chmod 644 "$CERTS_DIR/server.crt"

echo "✅ SSL Certificate successfully created at:"
echo "   $CERTS_DIR/server.crt"
echo "   $CERTS_DIR/server.key"
