import "reflect-metadata";
import "dotenv/config";
import { DataSource } from "typeorm";
import { ProgramUi1793145600000 } from "./migrations/1793145600000-ProgramUi";
import { ProgramTestFixtures1793145601000 } from "./migrations/1793145601000-ProgramTestFixtures";
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
  migrations: [ProgramUi1793145600000, ProgramTestFixtures1793145601000],
});
