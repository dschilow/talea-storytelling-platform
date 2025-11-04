import { SQLDatabase } from "encore.dev/storage/sqldb";

// Fairy Tales Database Connection
export const fairytalesDB = new SQLDatabase("fairytales", {
  migrations: "./migrations",
});
