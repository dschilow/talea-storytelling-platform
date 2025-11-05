import { Service } from "encore.dev/service";

export default new Service("health");

// Import endpoints
import "./health";
import "./db-status";
import "./run-migrations";
