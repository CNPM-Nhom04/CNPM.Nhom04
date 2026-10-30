import { BadRequestException } from "@nestjs/common";
import { CourseService } from "./course.service";
import { CourseRepository } from "../domain/course";
describe("CourseService protects SQL date ranges and IDs", () => {
  const create = jest.fn();
  const service = new CourseService({ create } as unknown as CourseRepository);
  const actor = { id: "1", username: "staff", canManage: true, ip: "" };
  const input = {
    unitId: "1",
    courseCode: "TEST101",
    courseName: "Course",
    credits: 3,
    theoryHours: 0,
    practiceHours: 0,
    effectiveFrom: "2026-10-30",
  };
  beforeEach(() => create.mockReset());
  it("rejects reversed effective dates before opening a transaction", () => {
    expect(() =>
      service.create({ ...input, effectiveTo: "2026-10-29" }, actor),
    ).toThrow(BadRequestException);
    expect(create).not.toHaveBeenCalled();
  });
  it("rejects dates outside MariaDB DATE's supported year range", () => {
    expect(() =>
      service.create({ ...input, effectiveFrom: "0999-12-31" }, actor),
    ).toThrow(BadRequestException);
  });
  it("rejects unsigned BIGINT overflow", () => {
    expect(() => service.detail("18446744073709551616", actor)).toThrow(
      BadRequestException,
    );
  });
  it("passes real user input without deriving credit/hour defaults", () => {
    service.create(input, actor);
    expect(create).toHaveBeenCalledWith(input, actor);
  });
});
