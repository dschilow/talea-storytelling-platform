import { Service } from "encore.dev/service";

export default new Service("story");

// Import all API endpoints
import "./generate";
import "./generate-from-fairytale";
import "./character-pool-api";
import "./test-story-generation";
import "./analyze-phase-logs";
import "./analyze-recent-stories";
import "./auto-test-endpoint";
import "./run-migration-sql";
import "./test-artifacts";
import "./show-artifacts";
