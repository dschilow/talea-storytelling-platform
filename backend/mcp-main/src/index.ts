import { validateConfig } from './config.js';
import { testConnection } from './db.js';
import { startServer } from './server.js';

async function main() {
  try {
    console.log('🚀 Starting Talea MCP Main Server...');

    // Validate configuration
    validateConfig();

    // Test database connection
    await testConnection();

    // Start HTTP server
    startServer();

    console.log('✅ MCP Main Server started successfully');
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Shutting down gracefully...');
  process.exit(0);
});

main();
