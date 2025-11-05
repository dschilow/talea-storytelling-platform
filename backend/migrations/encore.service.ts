import { Service } from "encore.dev/service";

// Define the migrations service
export default new Service("migrations");

// Import the migration endpoints
import "./run-migrations";
