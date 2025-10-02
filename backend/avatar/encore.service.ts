import { Service } from "encore.dev/service";

// Import all API endpoints to register them
import "./create";
import "./get";
import "./list";
import "./update";
import "./delete";
import "./updatePersonality";
import "./addMemory";
import "./getMemories";
import "./resetPersonalityTraits";
import "./upgradePersonalityTraits";
import "./debugPersonality";
import "./deleteMemory";
import "./reducePersonalityTrait";
import "./resetDokuHistory";

export default new Service("avatar");
