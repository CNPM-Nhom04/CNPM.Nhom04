import { AdminReportExport1794200000000 } from "./migrations/1794200000000-AdminReportExport";
import { AguProgramCatalog1794100000000 } from "./migrations/1794100000000-AguProgramCatalog";
import { LecturerGradeRead1794000000000 } from "./migrations/1794000000000-LecturerGradeRead";
import { RemoveBachelorDemo1793746800000 } from "./migrations/1793746800000-RemoveBachelorDemo";
import { DoctoralEducationLevel1793743200000 } from "./migrations/1793743200000-DoctoralEducationLevel";
import { StudentClasses1793700000000 } from "./migrations/1793700000000-StudentClasses";
import { PublicPortal1793653200000 } from "./migrations/1793653200000-PublicPortal";
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
    PublicPortal1793653200000,
    StudentClasses1793700000000,
    DoctoralEducationLevel1793743200000,
    RemoveBachelorDemo1793746800000,
    LecturerGradeRead1794000000000,
    AguProgramCatalog1794100000000,
    AdminReportExport1794200000000,
  ],
  migrationsTransactionMode: "none",
});
