#!/usr/bin/env python3
"""
Direct migration runner for Railway PostgreSQL
Executes fairy tale SQL migrations 10-13
"""

import psycopg2
import sys
from pathlib import Path

# Railway PostgreSQL connection string
DATABASE_URL = "postgresql://postgres:HqJVXXiJiVtiCOJuOmEatCjuTEULvpjr@autorack.proxy.rlwy.net:42832/railway"

def run_migration(cursor, migration_file):
    """Execute a single migration file"""
    print(f"\n🔄 Running {migration_file.name}...")

    try:
        sql = migration_file.read_text(encoding='utf-8')
        cursor.execute(sql)
        print(f"✅ {migration_file.name} completed successfully")
        return True
    except Exception as e:
        print(f"❌ Error in {migration_file.name}: {e}")
        return False

def main():
    print("🚀 Talea Fairy Tales Migration Runner\n")

    # Connect to database
    try:
        print(f"Connecting to Railway PostgreSQL...")
        conn = psycopg2.connect(DATABASE_URL)
        conn.autocommit = False
        cursor = conn.cursor()
        print("✅ Connected successfully\n")
    except Exception as e:
        print(f"❌ Connection failed: {e}")
        sys.exit(1)

    try:
        # Check current count
        cursor.execute("SELECT COUNT(*) FROM fairy_tales")
        current_count = cursor.fetchone()[0]
        print(f"📊 Current fairy tale count: {current_count}\n")

        if current_count >= 50:
            print("✅ Database already has 50+ fairy tales. No migrations needed.")
            return

        # Define migrations in order
        migrations_dir = Path(__file__).parent / "backend" / "fairytales" / "migrations"
        migrations = [
            migrations_dir / "10_add_47_classic_fairy_tales.up.sql",
            migrations_dir / "11_add_andersen_fairy_tales.up.sql",
            migrations_dir / "12_add_russian_arabian_fairy_tales.up.sql",
            migrations_dir / "13_add_classics_legends_fables.up.sql",
        ]

        # Run each migration
        success_count = 0
        for migration_file in migrations:
            if not migration_file.exists():
                print(f"⚠️  Migration file not found: {migration_file}")
                continue

            if run_migration(cursor, migration_file):
                success_count += 1
                conn.commit()
                print(f"   Committed transaction")
            else:
                conn.rollback()
                print(f"   Rolled back transaction")
                print("\n⚠️  Migration failed. Stopping here.")
                break

        # Check final count
        cursor.execute("SELECT COUNT(*) FROM fairy_tales")
        final_count = cursor.fetchone()[0]

        print(f"\n📊 Final Results:")
        print(f"  Migrations executed: {success_count}/4")
        print(f"  Final fairy tale count: {final_count}")

        if final_count == 50:
            print("\n🎉 SUCCESS! Database now has exactly 50 fairy tales!")
        elif final_count > 50:
            print(f"\n⚠️  Warning: Database has {final_count} tales (expected 50)")
        else:
            print(f"\n⚠️  Warning: Only {final_count} tales found (expected 50)")

    except Exception as e:
        print(f"\n❌ Fatal error: {e}")
        conn.rollback()
        sys.exit(1)
    finally:
        cursor.close()
        conn.close()
        print("\n🔌 Database connection closed")

if __name__ == "__main__":
    main()
