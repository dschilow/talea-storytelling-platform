#!/bin/bash
set -e

echo "🚀 Starting Talea on Railway..."

# Disable the infra config file on Railway to use DATABASE_URL instead
if [ -f "/backend/railway-infra.config.json" ]; then
    echo "📝 Disabling railway-infra.config.json (using DATABASE_URL instead)"
    mv /backend/railway-infra.config.json /backend/railway-infra.config.json.disabled || true
fi

# Construct DATABASE_URL from Railway's individual environment variables
if [ -n "$PGHOST" ] && [ -n "$PGUSER" ] && [ -n "$PGPASSWORD" ] && [ -n "$PGDATABASE" ]; then
    # Railway's internal PostgreSQL doesn't require SSL
    export DATABASE_URL="postgresql://${PGUSER}:${PGPASSWORD}@${PGHOST}:${PGPORT:-5432}/${PGDATABASE}?sslmode=disable"
    echo "✅ Constructed DATABASE_URL from Railway environment variables"
    echo "   Host: $PGHOST"
    echo "   Database: $PGDATABASE"
    echo "   User: $PGUSER"
    echo "   SSL Mode: disable (Railway internal network)"
else
    echo "⚠️  No PGHOST/PGUSER/PGPASSWORD found, using existing DATABASE_URL"
fi

# Export DATABASE_URL for Encore to use
if [ -n "$DATABASE_URL" ]; then
    echo "✅ DATABASE_URL is set"
    # Don't print the full URL for security, just confirm it exists
else
    echo "❌ ERROR: No DATABASE_URL available!"
    exit 1
fi

# Print debug info for troubleshooting
echo "🔍 Environment check:"
echo "   PGHOST: ${PGHOST:-not set}"
echo "   PGDATABASE: ${PGDATABASE:-not set}"
echo "   PGUSER: ${PGUSER:-not set}"
echo "   PGPORT: ${PGPORT:-not set}"

# Start the Encore application
echo "🎯 Starting Encore runtime..."
exec /encore-runtime
