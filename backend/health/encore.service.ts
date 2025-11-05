import { Service } from "encore.dev/service";

export default new Service("health");

// Import endpoints
import "./health";
import "./db-status";
import "./run-migrations";
import "./create-fairy-tales-table";
import "./complete-fairy-tales-setup";
