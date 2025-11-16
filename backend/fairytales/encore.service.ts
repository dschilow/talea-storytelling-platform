// Fairy Tales Service
// Professional story generation system with avatar integration

import { Service } from "encore.dev/service";

export default new Service("fairytales");

// Import all API endpoints
import "./catalog";      // List/get fairy tales catalog
import "./generator";    // Generate personalized stories
import "./management";   // Admin management (export/import/update/delete)
import "./trigger-migrations";  // Trigger database migrations
import "./run-migration-sql";   // Execute raw SQL migrations
