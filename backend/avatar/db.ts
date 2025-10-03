import { SQLDatabase } from "encore.dev/storage/sqldb";

// PostgreSQL database for avatar data
export const avatarDB = new SQLDatabase("avatar", {
  migrations: "./migrations",
});
