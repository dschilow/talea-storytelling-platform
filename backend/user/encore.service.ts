import { Service } from "encore.dev/service";

// Import all API endpoints to register them
import "./profile";
import "./preferences";

export default new Service("user");
