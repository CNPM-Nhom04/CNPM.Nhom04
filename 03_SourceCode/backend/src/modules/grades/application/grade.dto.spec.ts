import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { CreateGradeDto, GradePolicyDto, LegacyGradeDto } from "./grade.dto";
describe("Grade DTO validation", () => {
  const valid = {
    registrationId: "1",
    attendanceScore: 0,
    midtermScore: null,
    examScore: 10,
    note: "Verified official academic record",
    reference: "TEST-ONLY",
  };
  it("accepts zero and null as distinct values", async () =>
    expect(await validate(plainToInstance(CreateGradeDto, valid))).toHaveLength(
      0,
    ));
  it.each([
    { attendanceScore: -1 },
    { attendanceScore: 10.01 },
    { attendanceScore: "8" },
    { attendanceScore: true },
    { examScore: 8.001 },
    { registrationId: "0" },
    { registrationId: 1 },
    { note: "short" },
    { reference: " " },
  ])("rejects malformed point data %j", async (extra) => {
    expect(
      (await validate(plainToInstance(CreateGradeDto, { ...valid, ...extra })))
        .length,
    ).toBeGreaterThan(0);
  });
  it("requires rounding/precision and threshold to be supplied, not defaulted", async () => {
    expect(
      (
        await validate(
          plainToInstance(GradePolicyDto, {
            revision: 0,
            attendanceWeight: 20,
            midtermWeight: 20,
            examWeight: 60,
            reference: "real",
          }),
        )
      ).length,
    ).toBeGreaterThan(0);
  });
  it("does not parse legacy letter grades into guessed numeric totals", async () => {
    expect(
      await validate(
        plainToInstance(LegacyGradeDto, {
          revision: 0,
          grade: "A",
          resultStatus: "PASSED",
          passedDate: "2026-01-20",
          note: valid.note,
          reference: valid.reference,
        }),
      ),
    ).toHaveLength(0);
  });
});
