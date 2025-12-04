#!/bin/bash

# Setup Stripe CLI Webhook Forwarding
# This script helps you setup Stripe CLI to forward webhooks to localhost

echo "🔧 Stripe CLI Webhook Setup"
echo "============================"
echo ""

# Check if Stripe CLI is installed
if ! command -v stripe &> /dev/null; then
    echo "❌ Stripe CLI not found in PATH"
    echo "   Make sure ~/.local/bin is in your PATH or run: export PATH=\"\$HOME/.local/bin:\$PATH\""
    exit 1
fi

echo "✅ Stripe CLI found: $(stripe --version)"
echo ""

# Step 1: Login to Stripe
echo "📝 Step 1: Login to Stripe"
echo "   This will open a browser window for authentication"
echo "   Press Enter to continue or Ctrl+C to cancel..."
read

stripe login

if [ $? -ne 0 ]; then
    echo "❌ Stripe login failed"
    exit 1
fi

echo ""
echo "✅ Logged in to Stripe"
echo ""

# Step 2: Check if .env file exists
ENV_FILE=".env"
if [ ! -f "$ENV_FILE" ]; then
    echo "⚠️  .env file not found. Creating from .env.example if it exists..."
    if [ -f ".env.example" ]; then
        cp .env.example .env
        echo "✅ Created .env file from .env.example"
    else
        echo "❌ .env.example not found. Please create .env file manually."
        exit 1
    fi
fi

echo ""
echo "📝 Step 2: Forward webhook to localhost"
echo ""
echo "In the next step, Stripe CLI will:"
echo "  1. Listen for webhook events from Stripe"
echo "  2. Forward them to: http://localhost:3000/api/webhooks/stripe"
echo "  3. Display a webhook signing secret (starts with whsec_)"
echo ""
echo "⚠️  IMPORTANT: Copy the webhook signing secret when it appears!"
echo "   You'll need to add it to your .env file as STRIPE_WEBHOOK_SECRET"
echo ""
echo "Press Enter to start forwarding webhooks (Ctrl+C to cancel)..."
read

echo ""
echo "🚀 Starting webhook forwarding..."
echo "   (This will run in the foreground - press Ctrl+C to stop)"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Forward webhooks
stripe listen --forward-to localhost:3000/api/webhooks/stripe

