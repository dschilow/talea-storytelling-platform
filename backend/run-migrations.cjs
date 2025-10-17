#!/usr/bin/env node
// Simplified migrations check for Encore.ts
// Encore handles migrations automatically, this just verifies DB connectivity

const { Client } = require('pg');

async function checkDatabase() {
  console.log('=== Checking Database Connection ===');

  const client = new Client({
    host: process.env.PGHOST || 'postgres.railway.internal',
    port: parseInt(process.env.PGPORT || '5432'),
    database: process.env.PGDATABASE || 'railway',
    user: process.env.PGUSER || 'postgres',
    password: process.env.PGPASSWORD,
    ssl: false
  });

  try {
    await client.connect();
    console.log(`✓ Connected to database: ${client.host}:${client.port}/${client.database}`);

    // Check if database is accessible
    const result = await client.query('SELECT version()');
    console.log(`✓ PostgreSQL version: ${result.rows[0].version.split(' ')[1]}`);

    // Encore will run migrations automatically when it starts
    console.log('✓ Database connection verified - Encore will handle migrations automatically');

    await client.end();
  } catch (error) {
    console.error('✗ Database connection failed:', error.message);
    console.log('⚠️  Continuing anyway - Encore will retry on startup');
    await client.end();
    // Don't exit with error - let Encore handle it
  }
}

checkDatabase();
