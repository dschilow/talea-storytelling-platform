import { SQLDatabase } from "encore.dev/storage/sqldb";

export const aiDB = new SQLDatabase("ai", {
  migrations: "./migrations",
});
