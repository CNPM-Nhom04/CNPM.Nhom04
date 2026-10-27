import "reflect-metadata";
import "dotenv/config";
import { DataSource } from "typeorm";
import { ThesisDefenses1793059201000 } from "./migrations/1793059201000-ThesisDefenses";
export default new DataSource({
  type: "mysql",
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 3306),
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  timezone: "Z",
  synchronize: false,
  migrationsTransactionMode: "none",
  migrations: [ThesisDefenses1793059201000],
});
