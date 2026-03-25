require("dotenv").config({ path: ".env", quiet: true });

const fs = require("fs");
const path = require("path");
const { Client } = require("pg");

const driftPath = path.join(process.cwd(), "prisma-drift.sql");

function splitStatements(sql) {
  const statements = [];
  let buffer = "";

  for (const rawLine of sql.split(/\r?\n/)) {
    const line = rawLine.trimEnd();
    if (!line.trim() || line.trim().startsWith("--")) continue;

    buffer += `${line}\n`;
    if (line.trim().endsWith(";")) {
      statements.push(buffer.trim());
      buffer = "";
    }
  }

  if (buffer.trim()) statements.push(buffer.trim());
  return statements;
}

function sanitizeStatement(statement) {
  if (
    statement.includes("DROP COLUMN") ||
    statement.startsWith("DROP TABLE") ||
    statement.includes("ALTER COLUMN") ||
    statement.startsWith("CREATE INDEX") ||
    statement.startsWith("CREATE UNIQUE INDEX") ||
    statement.includes("ADD CONSTRAINT")
  ) {
    return null;
  }

  const createEnum = statement.match(/^CREATE TYPE "([^"]+)" AS ENUM \(([\s\S]+)\);$/);
  if (createEnum) {
    const [, typeName, values] = createEnum;
    return `
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = '${typeName}') THEN
    CREATE TYPE "${typeName}" AS ENUM (${values});
  END IF;
END
$$;
`.trim();
  }

  const alterEnum = statement.match(/^ALTER TYPE "([^"]+)" ADD VALUE '([^']+)';$/);
  if (alterEnum) {
    const [, typeName, value] = alterEnum;
    return `
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_enum e ON e.enumtypid = t.oid
    WHERE t.typname = '${typeName}' AND e.enumlabel = '${value}'
  ) THEN
    ALTER TYPE "${typeName}" ADD VALUE '${value}';
  END IF;
END
$$;
`.trim();
  }

  if (statement.startsWith('CREATE TABLE "')) {
    return statement.replace('CREATE TABLE "', 'CREATE TABLE IF NOT EXISTS "');
  }

  if (statement.startsWith('ALTER TABLE "') && statement.includes("ADD COLUMN")) {
    return statement.replace(/ADD COLUMN\s+/g, "ADD COLUMN IF NOT EXISTS ");
  }

  return null;
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required");
  }

  if (!fs.existsSync(driftPath)) {
    throw new Error("prisma-drift.sql not found. Run prisma migrate diff first.");
  }

  const drift = fs.readFileSync(driftPath, "utf8");
  const statements = splitStatements(drift)
    .map(sanitizeStatement)
    .filter(Boolean);

  fs.writeFileSync(
    path.join(process.cwd(), "prisma-drift-safe.sql"),
    statements.join("\n\n"),
    "utf8"
  );

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();

  let applied = 0;
  const errors = [];

  for (const statement of statements) {
    try {
      await client.query(statement);
      applied += 1;
    } catch (error) {
      errors.push({
        statement: statement.slice(0, 240),
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  await client.end();

  console.log(JSON.stringify({ applied, failed: errors.length, errors }, null, 2));

  if (errors.length > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
