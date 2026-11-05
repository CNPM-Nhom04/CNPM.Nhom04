import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { ProgramInputDto } from "../application/program.dto";
import { normalizeTrainingDuration } from "./program-form-values";
describe("Training duration expressed in years", () => {
  it.each([
    ["2", "2 năm"],
    ["2 năm", "2 năm"],
    ["1,5", "1.5 năm"],
    ["0.5 năm", "0.5 năm"],
    ["", ""],
    [" 3 năm ", "3 năm"],
  ])("normalizes %s without inventing a duration", (value, expected) =>
    expect(normalizeTrainingDuration(value)).toBe(expected),
  );
  it.each([
    "abc",
    "0",
    "-1",
    "2 năm dài",
    "2.555 năm",
    "0.25 năm",
    "1.25 năm",
    "0.01 năm",
  ])("rejects invalid year input %s", async (value) => {
    const dto = plainToInstance(ProgramInputDto, { thoiGianDaoTao: value });
    expect(
      (await validate(dto)).some(
        (error) => error.property === "thoiGianDaoTao",
      ),
    ).toBe(true);
  });
});
