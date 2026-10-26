import "reflect-metadata";
import "dotenv/config";
import { DataSource } from "typeorm";
import pg from "pg";

import { UserOrmEntity } from "./entities/UserOrmEntity";
import { RoleOrmEntity } from "./entities/RoleOrmEntity";
import { ProjectOrmEntity } from "./entities/ProjectOrmEntity";
import { TaskOrmEntity } from "./entities/TaskOrmEntity";
import { ProjectMessageOrmEntity } from "./entities/ProjectMessageOrmEntity";

export const AppDataSource = new DataSource({
  type: "postgres",

  // Explicitly include the PostgreSQL driver in the deployment bundle.
  driver: pg,

  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT || 5432),
  username: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,

  // Enable verified TLS for Neon when DB_SSL is true.
  ssl:
    process.env.DB_SSL === "true"
      ? { rejectUnauthorized: true }
      : false,

  synchronize: false,
  logging: false,

  // Register entity classes explicitly for the deployment bundle.
  entities: [
    UserOrmEntity,
    RoleOrmEntity,
    ProjectOrmEntity,
    TaskOrmEntity,
    ProjectMessageOrmEntity,
  ],

  migrations: [__dirname + "/migrations/*.{js,ts}"],
});
