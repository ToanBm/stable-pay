#!/bin/bash

# Stop Stripe CLI webhook forwarding

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PID_FILE="$SCRIPT_DIR/stripe-webhook.pid"

if [ ! -f "$PID_FILE" ]; then
    echo "Stripe webhook is not running (no PID file found)"
    exit 1
fi

PID=$(cat "$PID_FILE")

if ! ps -p "$PID" > /dev/null 2>&1; then
    echo "Stripe webhook process not found (PID: $PID)"
    rm "$PID_FILE"
    exit 1
fi

echo "Stopping Stripe webhook (PID: $PID)..."
kill "$PID"

# Wait for process to stop
sleep 2

if ps -p "$PID" > /dev/null 2>&1; then
    echo "⚠️  Process still running, forcing kill..."
    kill -9 "$PID"
fi

rm "$PID_FILE"
echo "✅ Stripe webhook stopped"

