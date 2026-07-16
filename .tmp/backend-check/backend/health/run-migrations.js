// @bun
var __using = (stack, value, async) => {
  if (value != null) {
    if (typeof value !== "object" && typeof value !== "function")
      throw TypeError('Object expected to be assigned to "using" declaration');
    let dispose;
    if (async)
      dispose = value[Symbol.asyncDispose];
    if (dispose === undefined)
      dispose = value[Symbol.dispose];
    if (typeof dispose !== "function")
      throw TypeError("Object not disposable");
    stack.push([async, dispose, value]);
  } else if (async) {
    stack.push([async]);
  }
  return value;
};
var __callDispose = (stack, error, hasError) => {
  let fail = (e) => error = hasError ? new SuppressedError(e, error, "An error was suppressed during disposal") : (hasError = true, e), next = (it) => {
    while (it = stack.pop()) {
      try {
        var result = it[1] && it[1].call(it[2]);
        if (it[0])
          return Promise.resolve(result).then(next, (e) => (fail(e), next()));
      } catch (e) {
        fail(e);
      }
    }
    if (hasError)
      throw error;
  };
  return next();
};

// backend/health/run-migrations.ts
import { api, APIError } from "encore.dev/api";
import { storyDB } from "../story/db";
import { avatarDB } from "../avatar/db";
import { fairytalesDB } from "../fairytales/db";
import { userDB } from "../user/db";
import fs from "fs";
import path from "path";
import { compareMigrationFiles, splitMigrationStatements } from "./migration-order";
function isExpectedIdempotencyError(error) {
  const candidate = error;
  if (["42P07", "42701", "23505"].includes(candidate?.code || ""))
    return true;
  const message = String(candidate?.message || "").toLowerCase();
  return message.includes("already exists") || message.includes("duplicate column") || message.includes("duplicate key");
}
var runMigrations = api({ expose: false, method: "POST", path: "/health/run-migrations", auth: false }, async () => {
  const migrationsRun = [];
  const errors = [];
  console.log("\uD83D\uDD04 Starting manual migrations...");
  try {
    const runSqlFile = async (filePath, db) => {
      try {
        const sql = fs.readFileSync(filePath, "utf-8");
        const statements = splitMigrationStatements(sql);
        for (const statement of statements) {
          if (statement.length > 0) {
            try {
              await db.exec(statement + ";");
            } catch (stmtErr) {
              if (isExpectedIdempotencyError(stmtErr)) {
                console.log(`  Migration statement already applied: ${String(stmtErr.message).substring(0, 100)}`);
                continue;
              }
              throw stmtErr;
            }
          }
        }
        migrationsRun.push(filePath);
        console.log(`\u2705 Success: ${filePath}`);
      } catch (err) {
        const errorMsg = `Failed ${filePath}: ${err.message}`;
        errors.push(errorMsg);
        console.error(`\u274C ${errorMsg}`);
      }
    };
    const basePath = process.cwd();
    console.log("\uD83D\uDC64 Running user migrations...");
    const userMigrationsPath = path.join(basePath, "user", "migrations");
    if (fs.existsSync(userMigrationsPath)) {
      const userFiles = fs.readdirSync(userMigrationsPath).filter((f) => f.endsWith(".up.sql")).sort(compareMigrationFiles);
      for (const file of userFiles) {
        await runSqlFile(path.join(userMigrationsPath, file), userDB);
      }
    }
    console.log("\uD83C\uDFAD Running avatar migrations...");
    const avatarMigrationsPath = path.join(basePath, "avatar", "migrations");
    if (fs.existsSync(avatarMigrationsPath)) {
      const avatarFiles = fs.readdirSync(avatarMigrationsPath).filter((f) => f.endsWith(".up.sql")).sort(compareMigrationFiles);
      for (const file of avatarFiles) {
        await runSqlFile(path.join(avatarMigrationsPath, file), avatarDB);
      }
    }
    console.log("\uD83D\uDCD6 Running story migrations...");
    const storyMigrationsPath = path.join(basePath, "story", "migrations");
    if (fs.existsSync(storyMigrationsPath)) {
      const storyFiles = fs.readdirSync(storyMigrationsPath).filter((f) => f.endsWith(".up.sql")).sort(compareMigrationFiles);
      for (const file of storyFiles) {
        await runSqlFile(path.join(storyMigrationsPath, file), storyDB);
      }
    }
    console.log("\u2728 Running fairy tales migrations...");
    const fairytalesMigrationsPath = path.join(basePath, "fairytales", "migrations");
    if (fs.existsSync(fairytalesMigrationsPath)) {
      const fairytalesFiles = fs.readdirSync(fairytalesMigrationsPath).filter((f) => f.endsWith(".up.sql")).sort(compareMigrationFiles);
      for (const file of fairytalesFiles) {
        await runSqlFile(path.join(fairytalesMigrationsPath, file), fairytalesDB);
      }
    }
    console.log(`\u2705 Migrations completed: ${migrationsRun.length} successful, ${errors.length} failed`);
    return {
      success: errors.length === 0,
      message: errors.length === 0 ? `Successfully ran ${migrationsRun.length} migrations` : `Ran ${migrationsRun.length} migrations with ${errors.length} errors`,
      migrationsRun,
      errors
    };
  } catch (err) {
    console.error("\u274C Migration failed:", err);
    throw APIError.internal(`Migration failed: ${err.message}`);
  }
});
export {
  runMigrations
};
