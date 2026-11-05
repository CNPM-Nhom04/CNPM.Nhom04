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
      !Number.isInteger(input.credits) ||
      input.credits < 1 ||
      input.credits > 15
    )
      throw new BadRequestException(
        "Số tín chỉ phải là số nguyên từ 1 đến 15.",
      );
    if (input.effectiveFrom < "1000-01-01")
      throw new BadRequestException(
        "Ngày bắt đầu hiệu lực phải có năm từ 1000 trở lên.",
      );
    if (input.effectiveTo && input.effectiveTo <= input.effectiveFrom)
      throw new BadRequestException(
        "Ngày kết thúc hiệu lực phải lớn hơn ngày bắt đầu hiệu lực.",
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
