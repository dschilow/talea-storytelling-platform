import { Service } from "encore.dev/service";

export default new Service("health");

// Import endpoints
import "./health";
import "./db-status";
import "./run-migrations";
import "./create-fairy-tales-table";
import "./complete-fairy-tales-setup";
import "./import-150-fairy-tales";
import "./check-fairy-tale-stats";
import "./fix-usage-count-column";
