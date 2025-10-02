import { Service } from "encore.dev/service";

// Import all API endpoints to register them
import "./generate";
import "./get";
import "./list";
import "./markRead";

export default new Service("doku");
