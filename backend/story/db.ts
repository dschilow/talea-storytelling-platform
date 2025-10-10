import { SQLDatabase } from "encore.dev/storage/sqldb";

export const storyDB = new SQLDatabase("story", {
  migrations: "./migrations",
});
