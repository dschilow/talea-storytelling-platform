import { Service } from "encore.dev/service";

// Import all API endpoints to register them
import "./analyze-personality";
import "./personality-tracker";
import "./analyze-avatar";
import "./avatar-generation";
import "./image-generation";

export default new Service("ai");
