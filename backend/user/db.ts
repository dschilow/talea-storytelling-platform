import { SQLDatabase } from "encore.dev/storage/sqldb";

// Centralized user database handle to avoid duplicate SQLDatabase registrations
export const userDB = new SQLDatabase("user", {
  migrations: "./migrations",
});
