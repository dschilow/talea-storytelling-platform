#!/usr/bin/env node

/**
 * Run avatar migration via API (works with Railway)
 * This script calls the backend API endpoint instead of connecting directly to PostgreSQL
 */

const fs = require('fs');
const path = require('path');

// Your Railway backend URL
const BACKEND_URL = process.env.BACKEND_URL || "https://talea-storytelling-platform-production.up.railway.app";

async function checkSchema() {
    console.log('📊 Checking current avatar schema...\n');

    try {
        const response = await fetch(`${BACKEND_URL}/avatar/check-schema`);
        const result = await response.json();

        if (result.success) {
            console.log('✓ Current columns in avatars table:');
            result.columns.forEach(col => {
                console.log(`  - ${col.column_name} (${col.data_type}${col.column_default ? `, default: ${col.column_default}` : ''})`);
            });

            const hasInventory = result.columns.some(col => col.column_name === 'inventory');
            const hasSkills = result.columns.some(col => col.column_name === 'skills');

            return { hasInventory, hasSkills };
        } else {
            console.error('❌ Failed to check schema:', result.error);
            return { hasInventory: false, hasSkills: false };
        }
    } catch (error) {
        console.error('❌ Error checking schema:', error.message);
        throw error;
    }
}

async function runMigration() {
    console.log('\n🔄 Running Migration 8: add_inventory_and_skills...\n');

    const migrationFile = path.join(
        __dirname,
        'backend',
        'avatar',
        'migrations',
        '8_add_inventory_and_skills.up.sql'
    );

    if (!fs.existsSync(migrationFile)) {
        console.log(`⚠️  Migration file not found: ${migrationFile}`);
        return false;
    }

    const sql = fs.readFileSync(migrationFile, 'utf8');
    console.log('📄 SQL to execute:');
    console.log(sql);
    console.log('');

    try {
        const response = await fetch(`${BACKEND_URL}/avatar/run-migration-sql`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                migrationSql: sql,
                migrationName: '8_add_inventory_and_skills'
            })
        });

        const result = await response.json();

        if (result.success) {
            console.log(`✅ ${result.message}`);
            return true;
        } else {
            console.error(`❌ ${result.message}`);
            if (result.error) {
                console.error('Error details:', result.error);
            }
            return false;
        }
    } catch (error) {
        console.error('❌ Error running migration:', error.message);
        return false;
    }
}

async function main() {
    console.log('🚀 Talea Avatar Migration Runner (API Mode)\n');
    console.log('Backend URL:', BACKEND_URL, '\n');

    try {
        // Check current state
        const { hasInventory, hasSkills } = await checkSchema();

        if (hasInventory && hasSkills) {
            console.log('\n✅ Migration already applied. Columns "inventory" and "skills" already exist.');
            return;
        }

        console.log('\n📝 Need to add inventory and skills columns.');

        // Run migration
        const success = await runMigration();

        if (!success) {
            console.log('\n⚠️  Migration failed. Check errors above.');
            process.exit(1);
        }

        // Check final state
        console.log('\n📊 Verifying migration...');
        const finalState = await checkSchema();

        if (finalState.hasInventory && finalState.hasSkills) {
            console.log('\n🎉 SUCCESS! Migration completed. Inventory and skills columns added!');
        } else {
            console.log('\n⚠️  Warning: Migration may not have completed successfully.');
        }

    } catch (error) {
        console.error('\n❌ Fatal error:', error.message);
        process.exit(1);
    }
}

main();
