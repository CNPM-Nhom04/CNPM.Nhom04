import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { LinkStudentAccountDto } from "./student-accounts.dto";
const input = {
  userId: "12",
  studentId: "34",
  revision: 1,
  confirmed: true,
  reason: "Đã xác minh đúng hồ sơ",
};
describe("LinkStudentAccountDto", () => {
  it("requires explicit identity confirmation and a nonempty reason", async () => {
    for (const value of [
      { ...input, confirmed: false },
      { ...input, confirmed: "true" },
      { ...input, confirmed: undefined },
      { ...input, reason: " " },
    ]) {
      expect(
        (await validate(plainToInstance(LinkStudentAccountDto, value))).length,
      ).toBeGreaterThan(0);
    }
  });
  it("rejects malformed identity IDs, class revision and profile code", async () => {
    for (const value of [
      { ...input, userId: "0" },
      { ...input, studentId: "1 OR 1=1" },
      { ...input, revision: 0 },
      { ...input, revision: "1" },
      { ...input, studentCode: "HV có dấu" },
    ]) {
      expect(
        (await validate(plainToInstance(LinkStudentAccountDto, value))).length,
      ).toBeGreaterThan(0);
    }
  });
  it("accepts a confirmed existing SQL profile selection", async () => {
    expect(
      await validate(plainToInstance(LinkStudentAccountDto, input)),
    ).toEqual([]);
  });
});
