function migrationOrdinal(fileName: string): number {
  const match = /^(\d+)/.exec(fileName.trim());
  return match ? Number(match[1]) : Number.MAX_SAFE_INTEGER;
}

export function compareMigrationFiles(left: string, right: string): number {
  const byOrdinal = migrationOrdinal(left) - migrationOrdinal(right);
  return byOrdinal !== 0
    ? byOrdinal
    : left.localeCompare(right, "en", { numeric: true, sensitivity: "base" });
}

function readDollarTag(source: string, start: number): string | null {
  if (source[start] !== "$") return null;
  let cursor = start + 1;
  while (cursor < source.length && /[A-Za-z0-9_]/.test(source[cursor])) cursor += 1;
  return source[cursor] === "$" ? source.slice(start, cursor + 1) : null;
}

/**
 * Splits PostgreSQL migration files without dropping statements that follow
 * comments and without cutting semicolons inside strings or dollar blocks.
 */
export function splitMigrationStatements(sql: string): string[] {
  const statements: string[] = [];
  let current = "";
  let index = 0;
  let state: "normal" | "single" | "double" | "line-comment" | "block-comment" | "dollar" = "normal";
  let dollarTag = "";

  const finish = () => {
    const statement = current.trim();
    if (statement) statements.push(statement);
    current = "";
  };

  while (index < sql.length) {
    const char = sql[index];
    const next = sql[index + 1];

    if (state === "line-comment") {
      if (char === "\n") {
        current += "\n";
        state = "normal";
      }
      index += 1;
      continue;
    }

    if (state === "block-comment") {
      if (char === "*" && next === "/") {
        state = "normal";
        index += 2;
      } else {
        index += 1;
      }
      continue;
    }

    if (state === "single") {
      current += char;
      if (char === "'" && next === "'") {
        current += next;
        index += 2;
        continue;
      }
      if (char === "'") state = "normal";
      index += 1;
      continue;
    }

    if (state === "double") {
      current += char;
      if (char === '"' && next === '"') {
        current += next;
        index += 2;
        continue;
      }
      if (char === '"') state = "normal";
      index += 1;
      continue;
    }

    if (state === "dollar") {
      if (sql.startsWith(dollarTag, index)) {
        current += dollarTag;
        index += dollarTag.length;
        state = "normal";
      } else {
        current += char;
        index += 1;
      }
      continue;
    }

    if (char === "-" && next === "-") {
      state = "line-comment";
      index += 2;
      continue;
    }
    if (char === "/" && next === "*") {
      state = "block-comment";
      index += 2;
      continue;
    }
    if (char === "'") {
      current += char;
      state = "single";
      index += 1;
      continue;
    }
    if (char === '"') {
      current += char;
      state = "double";
      index += 1;
      continue;
    }

    const tag = char === "$" ? readDollarTag(sql, index) : null;
    if (tag) {
      current += tag;
      dollarTag = tag;
      state = "dollar";
      index += tag.length;
      continue;
    }

    if (char === ";") {
      finish();
      index += 1;
      continue;
    }

    current += char;
    index += 1;
  }

  finish();
  return statements;
}