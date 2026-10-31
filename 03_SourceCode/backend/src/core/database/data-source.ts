import { Graduation1793451600000 } from "./migrations/1793451600000-Graduation";
import { Approvals1793448000000 } from "./migrations/1793448000000-Approvals";
import "reflect-metadata";
import "dotenv/config";
import { DataSource } from "typeorm";
import { AdminSupport1793059200000 } from "./migrations/1793059200000-AdminSupport";

import { AuthSessions1793208000000 } from "./migrations/1793208000000-AuthSessions";

import { ProgramUi1793145600000 } from "./migrations/1793145600000-ProgramUi";

import { ThesisDefenses1793293200000 } from "./migrations/1793293200000-ThesisDefenses";

import { ThesisTopics1793340000000 } from "./migrations/1793340000000-ThesisTopics";
import { Grades1793350800000 } from "./migrations/1793350800000-Grades";
export default new DataSource({
  type: "mysql",
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 3306),
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  timezone: "Z",
  synchronize: false,
  migrations: [
    AdminSupport1793059200000,
    AuthSessions1793208000000,
    ProgramUi1793145600000,
    ThesisDefenses1793293200000,
    ThesisTopics1793340000000,
    Grades1793350800000,
    Approvals1793448000000,
    Graduation1793451600000,
  ],
  migrationsTransactionMode: "none",
});
