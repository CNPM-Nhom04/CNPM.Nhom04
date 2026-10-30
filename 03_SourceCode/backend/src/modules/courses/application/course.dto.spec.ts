import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { CreateCourseDto } from "./course.dto";
const valid = {
  unitId: "1",
  courseCode: "TEST101",
  courseName: "Học phần",
  credits: 0.25,
  theoryHours: 0,
  practiceHours: 1,
  effectiveFrom: "2026-10-30",
};
describe("CreateCourseDto SQL boundaries", () => {
  it("accepts fractional credits and zero lecture hours without converting hours", async () => {
    expect(
      await validate(plainToInstance(CreateCourseDto, valid)),
    ).toHaveLength(0);
  });
  it.each([
    { credits: 0 },
    { credits: "3" },
    { credits: null },
    { credits: true },
    { credits: 1.234 },
    { credits: 1000 },
    { theoryHours: -1 },
    { practiceHours: 65536 },
    { practiceHours: 0.5 },
    { courseName: "   " },
    { courseCode: " " },
    { unitId: 1 },
    { unitId: "1 OR 1=1" },
    { effectiveFrom: "2026-02-30" },
    { effectiveFrom: "2026-10-30T00:00:00Z" },
    { courseName: "a".repeat(256) },
  ])("rejects invalid catalog input %j", async (extra) => {
    expect(
      (await validate(plainToInstance(CreateCourseDto, { ...valid, ...extra })))
        .length,
    ).toBeGreaterThan(0);
  });
});
