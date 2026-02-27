import { Service } from "encore.dev/service";

export default new Service("story");

// Import all API endpoints
import "./generate";
import "./generate-from-fairytale";
import "./studio-api";
import "./character-pool-api";
import "./artifact-pool-api";
import "./test-story-generation";
import "./analyze-phase-logs";
// REMOVED for security: analyze-recent-stories, auto-test-endpoint, test-artifacts, show-artifacts
import "./run-migration-sql";
import "./debug-last-error";
import "./debug-recent-stories";
import "./proxy-image";
import "./audio-cache";
import "./audio-library";
