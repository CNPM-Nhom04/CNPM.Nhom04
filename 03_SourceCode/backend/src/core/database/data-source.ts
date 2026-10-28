import "reflect-metadata";
import "dotenv/config";
import { DataSource } from "typeorm";
import { AdminSupport1793059200000 } from "./migrations/1793059200000-AdminSupport";

import { AuthSessions1793208000000 } from "./migrations/1793208000000-AuthSessions";

export default new DataSource({
  type: "mysql",
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 3306),
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  timezone: "Z",
  synchronize: false,
  migrations: [AdminSupport1793059200000, AuthSessions1793208000000],
  migrationsTransactionMode: "none",
});
