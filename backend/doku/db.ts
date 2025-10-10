import { SQLDatabase } from "encore.dev/storage/sqldb";

// Railway uses self-signed certificates, so we disable SSL verification
export const dokuDB = new SQLDatabase("doku", {
  migrations: "./migrations",
});
