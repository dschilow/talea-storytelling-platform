import { Service } from "encore.dev/service";

export default new Service("health");

// Import endpoints
import "./health";
// REMOVED for security: db-status, run-migrations, test-clerk (unauthenticated debug/admin endpoints)
// REMOVED for security: create-fairy-tales-table, complete-fairy-tales-setup, import-150-fairy-tales, check-fairy-tale-stats, fix-usage-count-column
