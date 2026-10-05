// Creates the tables. Safe to run again.
import { readFile } from "node:fs/promises";
import { closePool, query } from "../lib/db.js";

export async function applySchema() {
  const schema = await readFile(new URL("../lib/schema.sql", import.meta.url), "utf8");
  const statements = schema.replace(/--.*$/gm, "").split(";").map((s) => s.trim()).filter(Boolean);
  for (const statement of statements) await query(statement);
  return statements.length;
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith("db-setup.js")) {
  try {
    const count = await applySchema();
    console.log(`Database ready (${count} tables checked).`);
  } catch (error) {
    console.error(`Could not set up the database: ${error.message}`);
    console.error("Check the MYSQL_ values in .env.local and that MySQL is running.");
    process.exitCode = 1;
  } finally {
    await closePool();
  }
}
