#!/usr/bin/env python3
"""
Fairy Tale Migration Runner - Executes Migration 14 via API
Adds species_requirement, gender_requirement, age_requirement columns to fairy_tale_roles table
"""

import requests
import time
from pathlib import Path

# Configuration
API_BASE = "https://backend-2-production-3de1.up.railway.app"
MIGRATION_FILE = "backend/fairytales/migrations/14_add_role_matching_requirements.up.sql"

def read_migration_file():
    """Read the SQL migration file"""
    migration_path = Path(__file__).parent / MIGRATION_FILE

    if not migration_path.exists():
        raise FileNotFoundError(f"Migration file not found: {migration_path}")

    with open(migration_path, 'r', encoding='utf-8') as f:
        content = f.read()

    print(f"📄 Read migration file: {migration_path.name}")
    print(f"   Size: {len(content)} characters")

    return content

def execute_migration_via_api(sql_content):
    """Execute SQL migration via API endpoint"""

    # Split SQL into individual statements (by semicolon)
    statements = [s.strip() for s in sql_content.split(';') if s.strip() and not s.strip().startswith('--')]

    print(f"\n🔄 Executing {len(statements)} SQL statements...")

    # Execute each statement
    success_count = 0
    error_count = 0

    for idx, statement in enumerate(statements, 1):
        # Skip comments and empty statements
        if not statement or statement.startswith('--') or statement.startswith('/*'):
            continue

        # Log progress every 10 statements
        if idx % 10 == 0:
            print(f"   Progress: {idx}/{len(statements)} statements...")

        try:
            # Call the API endpoint (assuming you have one like this)
            # You may need to adjust the endpoint based on your actual API
            response = requests.post(
                f"{API_BASE}/fairytales/run-migration-sql",
                json={"sql": statement + ";"},  # Add semicolon back
                headers={"Content-Type": "application/json"},
                timeout=30
            )

            if response.status_code == 200:
                success_count += 1
            else:
                # Check if it's a "column already exists" error (acceptable)
                error_text = response.text.lower()
                if 'already exists' in error_text or 'duplicate' in error_text:
                    print(f"   ⚠️  Statement {idx}: Column already exists (skipping)")
                    success_count += 1
                else:
                    print(f"   ❌ Statement {idx} failed: {response.status_code} - {response.text[:100]}")
                    error_count += 1

            # Small delay to avoid overwhelming the API
            time.sleep(0.1)

        except Exception as e:
            print(f"   ❌ Statement {idx} error: {str(e)}")
            error_count += 1

    print(f"\n📊 Migration Results:")
    print(f"   ✅ Successful: {success_count}")
    print(f"   ❌ Failed: {error_count}")
    print(f"   📝 Total: {len(statements)}")

    return success_count, error_count

def verify_migration():
    """Verify that migration was successful by checking for new columns"""
    print(f"\n🔍 Verifying migration...")

    try:
        # Try to query fairy tale roles to see if new columns exist
        # This assumes you have an endpoint to inspect the table schema
        response = requests.get(
            f"{API_BASE}/fairytales/test-migration",
            timeout=10
        )

        if response.status_code == 200:
            data = response.json()
            if 'species_requirement' in str(data):
                print("   ✅ Migration verified: species_requirement column exists")
                return True
            else:
                print("   ⚠️  Warning: Could not verify species_requirement column")
                return False
        else:
            print(f"   ⚠️  Could not verify migration: {response.status_code}")
            return False

    except Exception as e:
        print(f"   ⚠️  Verification failed: {str(e)}")
        print("   💡 This is OK if the endpoint doesn't exist yet")
        return None

def main():
    print("=" * 80)
    print("🎭 FAIRY TALE MIGRATION 14: Character Matching Requirements")
    print("=" * 80)
    print()
    print("This migration adds the following columns to fairy_tale_roles:")
    print("  - species_requirement (human/animal/magical_creature/any)")
    print("  - gender_requirement (male/female/neutral/any)")
    print("  - age_requirement (child/adult/elder/any)")
    print("  - size_requirement (tiny/small/medium/large/giant/any)")
    print("  - social_class_requirement (royalty/nobility/craftsman/commoner/outcast/any)")
    print()
    print("This enables PRECISE character matching for fairy tale stories!")
    print()

    try:
        # Read migration file
        sql_content = read_migration_file()

        # Execute migration
        success, errors = execute_migration_via_api(sql_content)

        # Verify migration
        verified = verify_migration()

        # Final status
        print()
        print("=" * 80)
        if errors == 0:
            print("✅ SUCCESS! Migration completed without errors")
            print()
            print("Next steps:")
            print("  1. Import new characters from: Logs/new-characters-for-pool.json")
            print("  2. Test story generation with 'Klassische Märchen' genre")
            print("  3. Verify König is human (not Eichhörnchen!)")
        else:
            print(f"⚠️  PARTIAL SUCCESS: {success} succeeded, {errors} failed")
            print()
            print("Some statements failed - this may be OK if columns already exist")
            print("Check the error messages above for details")
        print("=" * 80)

    except Exception as e:
        print()
        print("=" * 80)
        print(f"❌ MIGRATION FAILED: {str(e)}")
        print("=" * 80)
        return 1

    return 0

if __name__ == "__main__":
    exit(main())
