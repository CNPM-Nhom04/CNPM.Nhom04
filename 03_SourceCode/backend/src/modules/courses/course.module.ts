import { Module } from "@nestjs/common";
import { IdentityModule } from "../identity/identity.module";
import { CourseRepository } from "./domain/course";
import { MysqlCourseRepository } from "./infrastructure/course.repository";
import { CourseService } from "./application/course.service";
import { CourseController } from "./presentation/course.controller";
import { CourseGuard } from "./presentation/course.guard";
@Module({
  imports: [IdentityModule],
  controllers: [CourseController],
  providers: [
    CourseService,
    CourseGuard,
    { provide: CourseRepository, useClass: MysqlCourseRepository },
  ],
})
export class CourseModule {}
