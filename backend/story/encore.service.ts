import { Service } from "encore.dev/service";

export default new Service("story");

// Import all API endpoints
import "./generate";
import "./character-pool-api";
