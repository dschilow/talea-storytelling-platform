import { SQLDatabase } from "encore.dev/storage/sqldb";

export const avatarDB = new SQLDatabase("avatar", {
  migrations: "./migrations",
});
