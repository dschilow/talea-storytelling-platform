import { SQLDatabase } from "encore.dev/storage/sqldb";

export const dokuDB = new SQLDatabase("doku", {
  migrations: "./migrations",
});
