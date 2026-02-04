import { Service } from "encore.dev/service";

// Import all API endpoints to register them
import "./generate";
import "./get";
import "./list";
import "./list-public";
import "./audio-doku";
import "./markRead";
import "./delete";
import "./update";

export default new Service("doku");
