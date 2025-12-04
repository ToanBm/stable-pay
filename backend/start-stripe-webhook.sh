#!/bin/bash

# Start Stripe CLI webhook forwarding in background
# This script starts stripe listen in the background and logs output

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_FILE="$SCRIPT_DIR/stripe-webhook.log"
PID_FILE="$SCRIPT_DIR/stripe-webhook.pid"

# Add Stripe CLI to PATH
export PATH="$HOME/.local/bin:$PATH"

# Check if already running
if [ -f "$PID_FILE" ]; then
    OLD_PID=$(cat "$PID_FILE")
    if ps -p "$OLD_PID" > /dev/null 2>&1; then
        echo "Stripe webhook is already running (PID: $OLD_PID)"
        echo "To stop it, run: ./stop-stripe-webhook.sh"
        exit 1
    else
        rm "$PID_FILE"
    fi
fi

echo "Starting Stripe webhook forwarding..."
echo "Logs will be written to: $LOG_FILE"
echo ""

# Start in background
nohup stripe listen --forward-to localhost:3000/api/webhooks/stripe > "$LOG_FILE" 2>&1 &
PID=$!

# Save PID
echo $PID > "$PID_FILE"

echo "✅ Stripe webhook started (PID: $PID)"
echo "📝 View logs: tail -f $LOG_FILE"
echo "🛑 Stop webhook: ./stop-stripe-webhook.sh"
echo ""
echo "To view webhook events in real-time:"
echo "  tail -f $LOG_FILE"

