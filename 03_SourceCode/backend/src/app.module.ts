import { GraduationModule } from "./modules/graduation/graduation.module";
import { ApprovalModule } from "./modules/approvals/approval.module";
import { ComparisonModule } from "./modules/comparisons/comparison.module";
import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { IdentityModule } from "./modules/identity/identity.module";
import { ReportsModule } from "./modules/reports/reports.module";
import { ThesisDefenseModule } from "./modules/thesis-defense/thesis-defense.module";
import { ProgramModule } from "./modules/programs/program.module";
import { ThesisTopicModule } from "./modules/thesis-topic/thesis-topic.module";
import { GradeModule } from "./modules/grades/grade.module";
import { CourseModule } from "./modules/courses/course.module";
import { AdminModule } from "./modules/admin/admin.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: "mysql",
        host: configService.get<string>("DB_HOST"),
        port: configService.get<number>("DB_PORT"),
        username: configService.get<string>("DB_USERNAME"),
        password: configService.get<string>("DB_PASSWORD"),
        database: configService.get<string>("DB_DATABASE"),
        autoLoadEntities: true,
        synchronize: false,
        timezone: "Z",
      }),
    }),
    IdentityModule,
    ReportsModule,
    AdminModule,
    ProgramModule,
    ThesisDefenseModule,
    CourseModule,
    GradeModule,
    ThesisTopicModule,
    ComparisonModule,
    ApprovalModule,
    GraduationModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
