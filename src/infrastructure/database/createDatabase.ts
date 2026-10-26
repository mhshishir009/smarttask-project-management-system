
import "dotenv/config";
import { Client } from "pg";

async function createDatabase(): Promise<void> {
  const databaseName = process.env.DB_NAME;

  if (!databaseName) {
    throw new Error("DB_NAME is missing in .env");
  }

  // Connect to PostgreSQL's default database
  const client = new Client({
    host: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT || 5432),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: "postgres",
  });

  try {
    await client.connect();

    // Check whether the database already exists
    const result = await client.query(
      "SELECT 1 FROM pg_database WHERE datname = $1",
      [databaseName]
    );

    if (result.rowCount && result.rowCount > 0) {
      console.log(`Database "${databaseName}" already exists.`);
      return;
    }

    // Validate database name before using it as an identifier
    if (!/^[a-z][a-z0-9_]*$/.test(databaseName)) {
      throw new Error("Invalid database name.");
    }

    // CREATE DATABASE cannot run inside a transaction
    await client.query(`CREATE DATABASE "${databaseName}"`);

    console.log(`Database "${databaseName}" created successfully!`);
  } catch (error) {
    console.error("Database creation failed:", error);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

void createDatabase();
