import { SQLDatabase } from "encore.dev/storage/sqldb";

// PostgreSQL database for avatar data
// Railway uses self-signed certificates, so we disable SSL verification
export const avatarDB = new SQLDatabase("avatar", {
  migrations: "./migrations",
});
