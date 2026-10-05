import mysql from "mysql2/promise";

// Outside Next.js (scripts, tests) nothing loads .env.local for us.
if (!process.env.MYSQL_DATABASE) {
  try {
    process.loadEnvFile(".env.local"); // scripts and tests run from the project folder
  } catch {
    // no .env.local: rely on real environment variables
  }
}

/**
 * One connection pool for the whole process. It is kept on globalThis because
 * Next.js reloads modules while you develop, and a new pool on every reload
 * would run the database out of connections.
 */
export function getPool() {
  if (!globalThis.__moneyBookPool) {
    const env = process.env;
    globalThis.__moneyBookPool = mysql.createPool({
      host: env.MYSQL_HOST || "localhost",
      port: Number(env.MYSQL_PORT || 3306),
      user: env.MYSQL_USER || "moneybook",
      password: env.MYSQL_PASSWORD || "",
      database: env.MYSQL_DATABASE || "moneybook",
      // On a serverless host every running copy has its own pool; keep it small there.
      connectionLimit: Number(env.MYSQL_CONNECTION_LIMIT || 5),
      charset: "utf8mb4",
      dateStrings: true, // dates come back as "2026-09-30", never shifted by a time zone
      // Hosted databases such as TiDB Cloud only accept encrypted connections.
      ssl: env.MYSQL_SSL === "true" ? { minVersion: "TLSv1.2", rejectUnauthorized: true } : undefined,
    });
  }
  return globalThis.__moneyBookPool;
}

/** Run a query with placeholders and return its rows (or its result, for writes). */
export async function query(sql, params = []) {
  const [rows] = await getPool().query(sql, params);
  return rows;
}

export async function closePool() {
  await globalThis.__moneyBookPool?.end();
  globalThis.__moneyBookPool = undefined;
}

/**
 * Run several statements as one unit: either all of them happen or none do.
 * `work` gets a query function bound to a single connection.
 */
export async function withTransaction(work) {
  const connection = await getPool().getConnection();
  try {
    await connection.beginTransaction();
    const result = await work(async (sql, params = []) => (await connection.query(sql, params))[0]);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
