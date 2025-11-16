#!/usr/bin/env python3
"""
Run fairy tale migrations via API
Reads SQL files and sends them to the backend API endpoint
"""

import requests
import sys
from pathlib import Path

# Backend API URL
BACKEND_URL = "https://backend-2-production-3de1.up.railway.app"
API_ENDPOINT = f"{BACKEND_URL}/fairytales/run-migration-sql"

def run_migration(migration_file: Path):
    """Execute a single migration file via API"""
    print(f"\n🔄 Running {migration_file.name}...")

    try:
        # Read SQL file
        sql = migration_file.read_text(encoding='utf-8')
        print(f"  📄 SQL file size: {len(sql)} characters")

        # Send to API
        response = requests.post(
            API_ENDPOINT,
            json={
                "sql": sql,
                "migrationName": migration_file.name
            },
            timeout=120  # 2 minutes timeout for large migrations
        )

        if response.status_code == 200:
            result = response.json()
            if result.get("success"):
                print(f"  ✅ {migration_file.name} completed successfully")
                print(f"     {result.get('message', '')}")
                return True
            else:
                print(f"  ❌ {migration_file.name} failed")
                print(f"     {result.get('message', '')}")
                return False
        else:
            print(f"  ❌ HTTP Error {response.status_code}")
            print(f"     {response.text}")
            return False

    except Exception as e:
        print(f"  ❌ Error: {e}")
        return False

def main():
    print("🚀 Talea Fairy Tales Migration Runner (API Mode)\n")

    # Define migrations in order
    migrations_dir = Path(__file__).parent / "backend" / "fairytales" / "migrations"
    migrations = [
        migrations_dir / "10_add_47_classic_fairy_tales.up.sql",
        migrations_dir / "11_add_andersen_fairy_tales.up.sql",
        migrations_dir / "12_add_russian_arabian_fairy_tales.up.sql",
        migrations_dir / "13_add_classics_legends_fables.up.sql",
    ]

    # Check current count
    print("📊 Checking current fairy tale count...")
    try:
        response = requests.get(f"{BACKEND_URL}/fairytales/trigger-migrations")
        if response.status_code == 200:
            data = response.json()
            current_count = data.get("taleCount", 0)
            print(f"  Current count: {current_count} tales\n")

            if current_count >= 50:
                print("✅ Database already has 50+ fairy tales. No migrations needed.")
                return
        else:
            print(f"  ⚠️  Could not check current count (continuing anyway)")
    except Exception as e:
        print(f"  ⚠️  Error checking count: {e} (continuing anyway)\n")

    # Run each migration
    success_count = 0
    for migration_file in migrations:
        if not migration_file.exists():
            print(f"⚠️  Migration file not found: {migration_file}")
            continue

        if run_migration(migration_file):
            success_count += 1
        else:
            print(f"\n⚠️  Migration failed. Stopping here.")
            break

    # Check final count
    print(f"\n📊 Final Results:")
    print(f"  Migrations executed: {success_count}/{len(migrations)}")

    try:
        response = requests.get(f"{BACKEND_URL}/fairytales/trigger-migrations")
        if response.status_code == 200:
            data = response.json()
            final_count = data.get("taleCount", 0)
            print(f"  Final fairy tale count: {final_count}")

            if final_count == 50:
                print("\n🎉 SUCCESS! Database now has exactly 50 fairy tales!")
            elif final_count > 50:
                print(f"\n⚠️  Warning: Database has {final_count} tales (expected 50)")
            else:
                print(f"\n⚠️  Warning: Only {final_count} tales found (expected 50)")
    except Exception as e:
        print(f"\n⚠️  Could not check final count: {e}")

if __name__ == "__main__":
    main()
