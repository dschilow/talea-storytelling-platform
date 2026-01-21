#!/usr/bin/env python3
"""
Execute artifact pool migrations via Railway API
Reads SQL files and sends them to the backend API endpoint
"""

import requests
import json
import os
from pathlib import Path

# Backend API URL
BACKEND_URL = "https://backend-2-production-3de1.up.railway.app"
API_ENDPOINT = f"{BACKEND_URL}/story/run-migration-sql"

def run_migration(migration_path: str, migration_name: str) -> bool:
    """Run a single migration file"""
    print(f"\n🔄 Running {migration_name}...")

    try:
        # Read SQL file
        with open(migration_path, 'r', encoding='utf-8') as f:
            sql = f.read()

        print(f"  📄 SQL file size: {len(sql)} characters")

        # Send to API
        response = requests.post(
            API_ENDPOINT,
            headers={"Content-Type": "application/json"},
            json={"sql": sql, "migrationName": migration_name},
            timeout=120  # 2 minutes timeout for large migrations
        )

        if response.ok:
            result = response.json()
            if result.get('success'):
                print(f"  ✅ {migration_name} completed successfully")
                print(f"     {result.get('message', '')}")
                return True
            else:
                print(f"  ❌ {migration_name} failed")
                print(f"     {result.get('message', '')}")
                return False
        else:
            print(f"  ❌ HTTP Error {response.status_code}")
            print(f"     {response.text}")
            return False

    except Exception as e:
        print(f"  ❌ Error: {str(e)}")
        return False

def main():
    print("🚀 Talea Artifact Pool Migration Runner (API Mode)\n")

    # Define migrations in order
    script_dir = Path(__file__).parent
    migrations_dir = script_dir / "backend" / "story" / "migrations"

    migrations = [
        {"file": "9_create_artifact_pool.up.sql", "name": "9_create_artifact_pool"},
        {"file": "10_seed_artifact_pool.up.sql", "name": "10_seed_artifact_pool"},
    ]

    print("📡 Testing API connection...")
    try:
        response = requests.post(
            API_ENDPOINT,
            headers={"Content-Type": "application/json"},
            json={"sql": "SELECT 1 as test;", "migrationName": "connection_test"},
            timeout=10
        )
        if response.ok:
            print("  ✅ API connection successful!\n")
        else:
            print(f"  ⚠️  API returned status {response.status_code}")
            print("  Continuing anyway...\n")
    except Exception as e:
        print(f"  ⚠️  Connection test failed: {e}")
        print("  Continuing anyway...\n")

    # Run each migration
    success_count = 0
    for migration in migrations:
        migration_path = migrations_dir / migration["file"]

        if not migration_path.exists():
            print(f"\n❌ Migration file not found: {migration_path}")
            continue

        success = run_migration(str(migration_path), migration["name"])
        if success:
            success_count += 1
        else:
            print(f"\n⚠️  Migration failed. Stopping here.")
            break

    # Final summary
    print(f"\n📊 Final Results:")
    print(f"  Migrations executed: {success_count}/{len(migrations)}")

    if success_count == len(migrations):
        print("\n🎉 SUCCESS! Artifact pool system is now set up with 100 artifacts!")
        print("\n📦 The artifact system includes:")
        print("   - artifact_pool table with 100 predefined artifacts")
        print("   - story_artifacts table for tracking artifact assignments")
        print("   - Bilingual support (German & English)")
        print("   - 4 rarity tiers: common, uncommon, rare, legendary")
        print("   - 11 categories: weapon, magic, tool, clothing, book, potion, jewelry, etc.")
        print("\n🚀 Next steps:")
        print("   1. Generate a new story on talea.website")
        print("   2. Complete reading the story")
        print("   3. See the artifact celebration modal! 🎁")
    else:
        print(f"\n⚠️  Warning: Only {success_count}/{len(migrations)} migrations completed.")
        print("   Please check the error messages above.")

if __name__ == "__main__":
    main()
