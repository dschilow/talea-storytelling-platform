#!/bin/bash
set -e

echo "🔄 Running database migrations..."

# Construct DATABASE_URL from Railway's environment variables
if [ -n "$PGHOST" ] && [ -n "$PGUSER" ] && [ -n "$PGPASSWORD" ] && [ -n "$PGDATABASE" ]; then
    export DATABASE_URL="postgresql://${PGUSER}:${PGPASSWORD}@${PGHOST}:${PGPORT:-5432}/${PGDATABASE}?sslmode=disable"
    echo "✅ Constructed DATABASE_URL from Railway environment variables"
else
    echo "❌ ERROR: Required PostgreSQL environment variables not set!"
    exit 1
fi

# Wait for PostgreSQL to be ready
echo "⏳ Waiting for PostgreSQL to be ready..."
for i in {1..30}; do
    if psql "$DATABASE_URL" -c "SELECT 1" > /dev/null 2>&1; then
        echo "✅ PostgreSQL is ready!"
        break
    fi
    echo "   Attempt $i/30: PostgreSQL not ready yet, waiting..."
    sleep 2
done

# Function to run SQL file
run_migration() {
    local file=$1
    echo "   📄 Running: $file"
    if psql "$DATABASE_URL" -f "$file" 2>&1; then
        echo "   ✅ Success: $file"
    else
        echo "   ❌ Failed: $file"
        return 1
    fi
}

# Run migrations in order
echo ""
echo "📦 Running migrations..."

# User migrations
if [ -d "user/migrations" ]; then
    echo "👤 User migrations:"
    for file in user/migrations/*.up.sql; do
        [ -f "$file" ] && run_migration "$file"
    done
fi

# Avatar migrations
if [ -d "avatar/migrations" ]; then
    echo "🎭 Avatar migrations:"
    for file in avatar/migrations/*.up.sql; do
        [ -f "$file" ] && run_migration "$file"
    done
fi

# Story migrations
if [ -d "story/migrations" ]; then
    echo "📖 Story migrations:"
    for file in story/migrations/*.up.sql; do
        [ -f "$file" ] && run_migration "$file"
    done
fi

# Doku migrations
if [ -d "doku/migrations" ]; then
    echo "📚 Doku migrations:"
    for file in doku/migrations/*.up.sql; do
        [ -f "$file" ] && run_migration "$file"
    done
fi

# Log migrations
if [ -d "log/migrations" ]; then
    echo "📋 Log migrations:"
    for file in log/migrations/*.up.sql; do
        [ -f "$file" ] && run_migration "$file"
    done
fi

# Fairy tales migrations - IMPORTANT!
if [ -d "fairytales/migrations" ]; then
    echo "✨ Fairy Tales migrations:"
    for file in fairytales/migrations/*.up.sql; do
        [ -f "$file" ] && run_migration "$file"
    done
fi

echo ""
echo "✅ All migrations completed successfully!"
echo ""
