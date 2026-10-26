import "reflect-metadata";
import "dotenv/config";
import { DataSource } from "typeorm";
import pg from "pg";

export const AppDataSource = new DataSource({
  type: "postgres",

  // Explicit driver import helps deployment include PostgreSQL support.
  driver: pg,

  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT || 5432),
  username: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,

  // Enable verified TLS for the hosted database when configured.
  ssl:
    process.env.DB_SSL === "true"
      ? { rejectUnauthorized: true }
      : false,

  synchronize: false,
  logging: false,

  entities: [__dirname + "/entities/*.{js,ts}"],
  migrations: [__dirname + "/migrations/*.{js,ts}"],
});
