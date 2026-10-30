import { BadRequestException, Injectable } from "@nestjs/common";
import {
  CourseActor,
  CourseRepository,
  CourseVersionInput,
  CreateCourseInput,
  RevisionInput,
  CourseQuery,
} from "../domain/course";
@Injectable()
export class CourseService {
  constructor(private readonly repository: CourseRepository) {}
  private id(id: string) {
    if (!/^[1-9]\d{0,19}$/.test(id) || BigInt(id) > 18446744073709551615n)
      throw new BadRequestException("ID không hợp lệ.");
  }
  private validate(input: CourseVersionInput) {
    if (
      input.effectiveFrom < "1000-01-01" ||
      (input.effectiveTo && input.effectiveTo < input.effectiveFrom)
    )
      throw new BadRequestException(
        "Ngày kết thúc phải từ ngày bắt đầu; năm từ 1000 trở lên.",
      );
  }
  list(query: CourseQuery, actor: CourseActor) {
    return this.repository.list(query, actor);
  }
  units(actor: CourseActor) {
    return this.repository.units(actor);
  }
  detail(id: string, actor: CourseActor) {
    this.id(id);
    return this.repository.detail(id, actor);
  }
  create(input: CreateCourseInput, actor: CourseActor) {
    this.validate(input);
    this.id(input.unitId);
    return this.repository.create(input, actor);
  }
  revise(id: string, input: RevisionInput, actor: CourseActor) {
    this.id(id);
    if (input.expectedLatestVersionId !== "0")
      this.id(input.expectedLatestVersionId);
    this.validate(input);
    return this.repository.revise(id, input, actor);
  }
  activate(id: string, versionId: string, actor: CourseActor) {
    this.id(id);
    this.id(versionId);
    return this.repository.activate(id, versionId, actor);
  }
  setStatus(
    id: string,
    status: string,
    expectedStatus: string,
    actor: CourseActor,
  ) {
    this.id(id);
    return this.repository.setStatus(id, status, expectedStatus, actor);
  }
}
