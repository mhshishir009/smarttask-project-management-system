
import { pool } from "./db";

async function testConnection(): Promise<void> {
  try {
    const result = await pool.query("SELECT 1 AS connected");

    console.log("PostgreSQL connected successfully!");
    console.log("Query Result:", result.rows[0]);
  } catch (error) {
    console.error("PostgreSQL connection failed:", error);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

void testConnection();
